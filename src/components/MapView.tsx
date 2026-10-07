import React from "react";
import L from "leaflet";
import { Maximize2, Minimize2, Compass, ExternalLink, X } from "lucide-react";
import {
  LocationRecord,
  MonthlyCoord,
  parseCombinedLocationString
} from "../utils/validation";
import { getGoogleMapsUrl } from "../utils/coordinateUtils";

interface MapViewProps {
  records: LocationRecord[];
  selectedRecord: LocationRecord | null;
  onSelectRecordFromMap: (record: LocationRecord) => void;
  onCloseMap?: () => void;
  defaultCenter: [number, number];
  defaultZoom: number;
}

interface CoordGroup {
  key: string;
  lat: number;
  lng: number;
  items: LocationRecord[];
}

interface MonthlyPointInfo {
  month: "DIL" | "JUNI" | "JULI" | "AGUSTUS" | "SEPTEMBER";
  color: string;
  coord: MonthlyCoord;
  label: string;
}

export const MapView: React.FC<MapViewProps> = ({
  records,
  selectedRecord,
  onSelectRecordFromMap,
  onCloseMap,
  defaultCenter,
  defaultZoom
}) => {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);
  const markersLayerRef = React.useRef<L.LayerGroup | null>(null);
  const monthlyLayerRef = React.useRef<L.LayerGroup | null>(null);
  const markerMapRef = React.useRef<Map<string, L.CircleMarker>>(new Map());
  const hasInitialFittedRef = React.useRef(false);

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const validRecords = React.useMemo(
    () => records.filter((r) => r.hasValidCoords && r.latitude !== null && r.longitude !== null),
    [records]
  );

  // Extract the 4 coordinates (DIL, JUNI, JULI, AGUSTUS) for the currently selected record
  const selectedMonthlyPoints = React.useMemo<MonthlyPointInfo[]>(() => {
    if (!selectedRecord) return [];
    const points: MonthlyPointInfo[] = [];

    const resolvedCoordDil: MonthlyCoord | null =
      selectedRecord.coordDil ||
      (() => {
        const p1 = parseCombinedLocationString(selectedRecord.koordinatDil);
        if (p1.isValid && p1.lat !== null && p1.lng !== null) {
          return { lat: p1.lat, lng: p1.lng };
        }
        const p2 = parseCombinedLocationString(selectedRecord.dil);
        if (p2.isValid && p2.lat !== null && p2.lng !== null) {
          return { lat: p2.lat, lng: p2.lng };
        }
        return null;
      })();

    if (resolvedCoordDil) {
      points.push({
        month: "DIL",
        color: "#7c3aed", // Violet / Indigo
        coord: resolvedCoordDil,
        label:
          selectedRecord.koordinatDil !== "-"
            ? selectedRecord.koordinatDil
            : `${resolvedCoordDil.lat}, ${resolvedCoordDil.lng}`
      });
    }
    if (selectedRecord.coordJuni) {
      points.push({
        month: "JUNI",
        color: "#2563eb", // Blue
        coord: selectedRecord.coordJuni,
        label: selectedRecord.lokasiJuni
      });
    }
    if (selectedRecord.coordJuli) {
      points.push({
        month: "JULI",
        color: "#d97706", // Amber
        coord: selectedRecord.coordJuli,
        label: selectedRecord.lokasiJuli
      });
    }
    if (selectedRecord.coordAgustus) {
      points.push({
        month: "AGUSTUS",
        color: "#16a34a", // Green
        coord: selectedRecord.coordAgustus,
        label: selectedRecord.lokasiAgustus
      });
    }
    if (selectedRecord.coordSeptember) {
      points.push({
        month: "SEPTEMBER",
        color: "#0891b2", // Cyan / Teal
        coord: selectedRecord.coordSeptember,
        label: selectedRecord.lokasiSeptember
      });
    }
    return points;
  }, [selectedRecord]);

  // Group records that share the exact same coordinates
  const coordGroups = React.useMemo<CoordGroup[]>(() => {
    const groups = new Map<string, CoordGroup>();
    for (const rec of validRecords) {
      const lat = rec.latitude!;
      const lng = rec.longitude!;
      const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(rec);
      } else {
        groups.set(key, {
          key,
          lat,
          lng,
          items: [rec]
        });
      }
    }
    return Array.from(groups.values());
  }, [validRecords]);

  // Initialize Leaflet map once
  React.useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      preferCanvas: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    const monthlyLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = layerGroup;
    monthlyLayerRef.current = monthlyLayer;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      monthlyLayerRef.current = null;
    };
  }, []);

  // Build popup HTML content safely
  const createPopupContent = React.useCallback(
    (group: CoordGroup, activeId: string | null) => {
      const container = document.createElement("div");
      container.className = "p-3 min-w-[250px] max-w-[300px] text-xs text-slate-800";

      let targetRecord =
        group.items.find((it) => it._rowId === activeId) || group.items[0];

      if (group.items.length > 1) {
        const badgeHeader = document.createElement("div");
        badgeHeader.className =
          "mb-2 pb-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-blue-700";
        badgeHeader.textContent = `${group.items.length} Data pada Lokasi Ini`;
        container.appendChild(badgeHeader);

        const listEl = document.createElement("div");
        listEl.className = "flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto";
        group.items.forEach((item, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          const isCurrent = item._rowId === targetRecord._rowId;
          btn.className = `px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
            isCurrent
              ? "bg-blue-600 text-white font-semibold"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`;
          btn.textContent = item.id !== "-" ? item.id : `#${i + 1}`;
          btn.onclick = (e) => {
            e.stopPropagation();
            onSelectRecordFromMap(item);
          };
          listEl.appendChild(btn);
        });
        container.appendChild(listEl);
      }

      const titleEl = document.createElement("div");
      titleEl.className = "font-bold text-sm text-slate-900 mb-1 leading-snug";
      titleEl.textContent =
        targetRecord.nama !== "-" ? targetRecord.nama : `Data #${targetRecord._rowNumber}`;
      container.appendChild(titleEl);

      const fields: [string, string, boolean, MonthlyCoord | null][] = [
        [
          "DIL",
          targetRecord.dil !== "-" ? targetRecord.dil : targetRecord.id,
          true,
          (() => {
            const p = parseCombinedLocationString(targetRecord.dil);
            return p.isValid && p.lat !== null && p.lng !== null
              ? { lat: p.lat, lng: p.lng }
              : null;
          })()
        ],
        ["ID / IDPEL", targetRecord.id, true, null],
        ["Alamat", targetRecord.alamat, false, null],
        ["Koordinat DIL", targetRecord.koordinatDil, true, targetRecord.coordDil],
        ["Koordinat JUNI", targetRecord.lokasiJuni, true, targetRecord.coordJuni],
        ["Koordinat JULI", targetRecord.lokasiJuli, true, targetRecord.coordJuli],
        ["Koordinat AGUSTUS", targetRecord.lokasiAgustus, true, targetRecord.coordAgustus],
        ["Koordinat SEPTEMBER", targetRecord.lokasiSeptember, true, targetRecord.coordSeptember],
        ["Jarak DIL - JUNI", targetRecord.jarakDilJuni, true, null],
        ["Jarak DIL - JULI", targetRecord.jarakDilJuli, true, null],
        ["Jarak DIL - AGUSTUS", targetRecord.jarakDilAgustus, true, null],
        ["Jarak DIL - SEPTEMBER", targetRecord.jarakDilSeptember, true, null],
        ["Jarak JUNI - JULI", targetRecord.jarakJuli, true, null],
        ["Jarak JULI - AGUSTUS", targetRecord.jarakAgustus, true, null],
        ["Jarak AGUSTUS - SEPTEMBER", targetRecord.jarakSeptember, true, null]
      ];

      const dl = document.createElement("div");
      dl.className = "space-y-1 mt-2 pt-2 border-t border-slate-100";

      fields.forEach(([label, val, isMono, coordObj]) => {
        const row = document.createElement("div");
        row.className = "flex justify-between gap-2 text-[11px]";

        const dt = document.createElement("span");
        dt.className = "text-slate-500 shrink-0";
        dt.textContent = `${label}:`;

        row.appendChild(dt);

        if (coordObj && val && val !== "-") {
          const link = document.createElement("a");
          link.href = getGoogleMapsUrl(coordObj.lat, coordObj.lng);
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = `Buka ${label} (${val}) di Google Maps`;
          link.className =
            "font-mono tabular-nums font-semibold text-right text-blue-600 hover:text-blue-800 underline break-words";
          link.textContent = val;
          row.appendChild(link);
        } else {
          const dd = document.createElement("span");
          dd.className = `font-medium text-right break-words ${
            isMono ? "font-mono tabular-nums text-slate-900" : "text-slate-800"
          }`;
          dd.textContent = val || "-";
          row.appendChild(dd);
        }

        dl.appendChild(row);
      });

      container.appendChild(dl);

      if (targetRecord.latitude !== null && targetRecord.longitude !== null) {
        const footer = document.createElement("div");
        footer.className = "mt-3 pt-2 border-t border-slate-100";

        const gmapsLink = document.createElement("a");
        gmapsLink.href = getGoogleMapsUrl(targetRecord.latitude, targetRecord.longitude);
        gmapsLink.target = "_blank";
        gmapsLink.rel = "noopener noreferrer";
        gmapsLink.className =
          "w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors no-underline";
        gmapsLink.textContent = "Buka Google Maps";

        footer.appendChild(gmapsLink);
        container.appendChild(footer);
      }

      return container;
    },
    [onSelectRecordFromMap]
  );

  // Render all dataset markers on canvas layer
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markerMapRef.current.clear();

    const groupsToRender =
      coordGroups.length > 3000 ? coordGroups.slice(0, 3000) : coordGroups;

    groupsToRender.forEach((group) => {
      const isSelectedGroup = group.items.some(
        (it) => it._rowId === selectedRecord?._rowId
      );

      const marker = L.circleMarker([group.lat, group.lng], {
        radius: isSelectedGroup ? 9 : group.items.length > 1 ? 8 : 6,
        fillColor: isSelectedGroup ? "#1e293b" : "#0284c7",
        color: "#ffffff",
        weight: isSelectedGroup ? 3 : 2,
        opacity: 1,
        fillOpacity: isSelectedGroup ? 0.95 : 0.75
      });

      marker.on("click", () => {
        const primaryItem = group.items[0];
        onSelectRecordFromMap(primaryItem);
      });

      marker.bindPopup(() => createPopupContent(group, selectedRecord?._rowId || null), {
        maxWidth: 310
      });

      marker.addTo(layerGroup);

      group.items.forEach((item) => {
        markerMapRef.current.set(item._rowId, marker);
      });
    });

    if (!hasInitialFittedRef.current && groupsToRender.length > 0) {
      hasInitialFittedRef.current = true;
      const bounds = L.latLngBounds(groupsToRender.map((g) => [g.lat, g.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      }
    }
  }, [coordGroups, selectedRecord, createPopupContent, onSelectRecordFromMap]);

  // Render the 3 Monthly Markers (Koordinat JUNI, JULI, AGUSTUS) when a record is clicked/selected
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const monthlyLayer = monthlyLayerRef.current;
    if (!map || !monthlyLayer) return;

    monthlyLayer.clearLayers();

    if (!selectedRecord) return;

    const allBoundsPoints: [number, number][] = [];

    if (
      selectedRecord.hasValidCoords &&
      selectedRecord.latitude !== null &&
      selectedRecord.longitude !== null
    ) {
      allBoundsPoints.push([selectedRecord.latitude, selectedRecord.longitude]);
    }

    // If the record has monthly coordinates (JUNI, JULI, AGUSTUS), draw a connecting dashed path and 3 distinct labeled pins
    if (selectedMonthlyPoints.length > 0) {
      const polylineCoords = selectedMonthlyPoints.map(
        (p) => [p.coord.lat, p.coord.lng] as [number, number]
      );

      if (polylineCoords.length > 1) {
        L.polyline(polylineCoords, {
          color: "#475569",
          weight: 2.5,
          dashArray: "5, 6",
          opacity: 0.85
        }).addTo(monthlyLayer);
      }

      // Check if some monthly coordinates are identical so we can slightly offset the badge or stack cleanly
      selectedMonthlyPoints.forEach((pt, idx) => {
        allBoundsPoints.push([pt.coord.lat, pt.coord.lng]);

        // Slight visual offset in pixels via divIcon when two months have the exact same lat/lng
        const duplicateIndex = selectedMonthlyPoints
          .slice(0, idx)
          .filter(
            (prev) =>
              Math.abs(prev.coord.lat - pt.coord.lat) < 0.00001 &&
              Math.abs(prev.coord.lng - pt.coord.lng) < 0.00001
          ).length;

        const offsetY = duplicateIndex * -26;

        const iconHtml = `
          <div style="transform: translate(-50%, calc(-100% + ${offsetY}px)); display: inline-flex; align-items: center; gap: 4px; background: ${pt.color}; color: #ffffff; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono', monospace; white-space: nowrap; box-shadow: 0 4px 10px rgba(15,23,42,0.25); border: 1.5px solid #ffffff;">
            <span>${pt.month}</span>
          </div>
        `;

        const badgeIcon = L.divIcon({
          className: "monthly-coord-pin",
          html: iconHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });

        const circlePin = L.circleMarker([pt.coord.lat, pt.coord.lng], {
          radius: 8,
          fillColor: pt.color,
          color: "#ffffff",
          weight: 2.5,
          opacity: 1,
          fillOpacity: 1
        }).addTo(monthlyLayer);

        const labelMarker = L.marker([pt.coord.lat, pt.coord.lng], {
          icon: badgeIcon,
          zIndexOffset: 1000 + idx * 10
        }).addTo(monthlyLayer);

        const buildMonthPopup = () => {
          const wrap = document.createElement("div");
          wrap.className = "p-3 min-w-[230px] text-xs text-slate-800";

          const header = document.createElement("div");
          header.className = "font-bold text-xs mb-1";
          header.style.color = pt.color;
          header.textContent = `TITIK KOORDINAT ${pt.month}`;
          wrap.appendChild(header);

          const nameEl = document.createElement("div");
          nameEl.className = "font-semibold text-slate-900 mb-2";
          nameEl.textContent =
            selectedRecord.nama !== "-"
              ? selectedRecord.nama
              : `DIL: ${selectedRecord.dil}`;
          wrap.appendChild(nameEl);

          const infoRows: [string, string, MonthlyCoord | null][] = [
            [
              "DIL",
              selectedRecord.dil !== "-" ? selectedRecord.dil : selectedRecord.id,
              (() => {
                const p = parseCombinedLocationString(selectedRecord.dil);
                return p.isValid && p.lat !== null && p.lng !== null
                  ? { lat: p.lat, lng: p.lng }
                  : null;
              })()
            ],
            ["IDPEL", selectedRecord.id, null],
            ["Koordinat DIL", selectedRecord.koordinatDil, selectedRecord.coordDil],
            ["Koordinat JUNI", selectedRecord.lokasiJuni, selectedRecord.coordJuni],
            ["Koordinat JULI", selectedRecord.lokasiJuli, selectedRecord.coordJuli],
            ["Koordinat AGUSTUS", selectedRecord.lokasiAgustus, selectedRecord.coordAgustus],
            ["Koordinat SEPTEMBER", selectedRecord.lokasiSeptember, selectedRecord.coordSeptember]
          ];

          const list = document.createElement("div");
          list.className = "space-y-1 pt-1.5 border-t border-slate-100 font-mono text-[11px]";
          infoRows.forEach(([k, v, cObj]) => {
            const r = document.createElement("div");
            r.className = "flex justify-between gap-2";
            const kSpan = document.createElement("span");
            kSpan.className = "font-sans text-slate-500";
            kSpan.textContent = `${k}:`;
            r.appendChild(kSpan);

            if (cObj && v && v !== "-") {
              const vLink = document.createElement("a");
              vLink.href = getGoogleMapsUrl(cObj.lat, cObj.lng);
              vLink.target = "_blank";
              vLink.rel = "noopener noreferrer";
              vLink.title = `Buka ${k} (${v}) di Google Maps`;
              vLink.className = k.includes(pt.month)
                ? "font-bold text-blue-700 hover:text-blue-900 underline"
                : "text-blue-600 hover:text-blue-800 underline";
              vLink.textContent = v;
              r.appendChild(vLink);
            } else {
              const vSpan = document.createElement("span");
              vSpan.className = k.includes(pt.month)
                ? "font-bold text-slate-950"
                : "text-slate-700";
              vSpan.textContent = v || "-";
              r.appendChild(vSpan);
            }
            list.appendChild(r);
          });
          wrap.appendChild(list);

          const linkWrap = document.createElement("div");
          linkWrap.className = "mt-2.5 pt-2 border-t border-slate-100";
          const a = document.createElement("a");
          a.href = getGoogleMapsUrl(pt.coord.lat, pt.coord.lng);
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.className =
            "w-full inline-flex items-center justify-center px-2.5 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded no-underline";
          a.textContent = `Buka Titik ${pt.month} di Google Maps`;
          linkWrap.appendChild(a);
          wrap.appendChild(linkWrap);

          return wrap;
        };

        circlePin.bindPopup(buildMonthPopup, { maxWidth: 280 });
        labelMarker.bindPopup(buildMonthPopup, { maxWidth: 280 });
      });
    }

    // Fit or pan map to show all 3 monthly coordinates (or primary coordinate)
    if (allBoundsPoints.length > 1) {
      const bounds = L.latLngBounds(allBoundsPoints);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [55, 55],
          maxZoom: 17,
          animate: true
        });
      }
    } else if (allBoundsPoints.length === 1) {
      map.setView(allBoundsPoints[0], Math.max(map.getZoom(), 16), {
        animate: true
      });
    }

    const mainMarker = markerMapRef.current.get(selectedRecord._rowId);
    if (mainMarker) {
      mainMarker.bringToFront();
      mainMarker.openPopup();
    }
  }, [selectedRecord, selectedMonthlyPoints]);

  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || coordGroups.length === 0) return;
    const bounds = L.latLngBounds(coordGroups.map((g) => [g.lat, g.lng]));
    if (bounds.isValid()) {
      map.closePopup();
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
  };

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden ${
        isFullscreen
          ? "fixed inset-3 z-50 shadow-2xl"
          : "h-[420px] lg:h-full relative"
      }`}
    >
      {/* Map Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <span>Peta Lokasi</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums text-slate-500">
            {validRecords.length} titik aktif
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {selectedRecord &&
            selectedRecord.hasValidCoords &&
            selectedRecord.latitude !== null &&
            selectedRecord.longitude !== null && (
              <a
                href={getGoogleMapsUrl(
                  selectedRecord.latitude,
                  selectedRecord.longitude
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                <span>Buka Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

          <button
            type="button"
            onClick={handleFitAllBounds}
            disabled={coordGroups.length === 0}
            title="Kembali ke semua lokasi (Center Map)"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>Kembali ke semua lokasi</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh peta"}
            title={isFullscreen ? "Keluar layar penuh" : "Layar penuh peta"}
            className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {onCloseMap && (
            <button
              type="button"
              onClick={onCloseMap}
              aria-label="Tutup Peta"
              title="Tutup Peta"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup Peta</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Record 3 Monthly Coordinates Info Bar */}
      {selectedRecord && (
        <div className="px-3.5 py-2 bg-slate-900 text-white border-b border-slate-800 text-[11px] space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold truncate max-w-[260px]">
              DIL: <span className="font-mono">{selectedRecord.dil}</span> — {selectedRecord.nama}
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
              <span>
                Jarak JULI (JUNI&rarr;JULI):{" "}
                <strong className="text-amber-400">{selectedRecord.jarakJuli}</strong>
              </span>
              <span>·</span>
              <span>
                Jarak AGUSTUS (JULI&rarr;AGUSTUS):{" "}
                <strong className="text-emerald-400">{selectedRecord.jarakAgustus}</strong>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums pt-1 border-t border-slate-800">
            {selectedRecord.coordDil ? (
              <a
                href={getGoogleMapsUrl(
                  selectedRecord.coordDil.lat,
                  selectedRecord.coordDil.lng
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (selectedRecord.coordDil && mapInstanceRef.current) {
                    mapInstanceRef.current.setView(
                      [selectedRecord.coordDil.lat, selectedRecord.coordDil.lng],
                      17,
                      { animate: true }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 text-violet-300 hover:text-white hover:underline cursor-pointer"
                title="Klik untuk membuka Koordinat DIL di Google Maps"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block shrink-0" />
                <span>DIL: {selectedRecord.koordinatDil}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block shrink-0" />
                <span>DIL: {selectedRecord.koordinatDil}</span>
              </span>
            )}

            {selectedRecord.coordJuni ? (
              <a
                href={getGoogleMapsUrl(
                  selectedRecord.coordJuni.lat,
                  selectedRecord.coordJuni.lng
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (selectedRecord.coordJuni && mapInstanceRef.current) {
                    mapInstanceRef.current.setView(
                      [selectedRecord.coordJuni.lat, selectedRecord.coordJuni.lng],
                      17,
                      { animate: true }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 text-blue-300 hover:text-white hover:underline cursor-pointer"
                title="Klik untuk membuka Koordinat JUNI di Google Maps"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shrink-0" />
                <span>JUNI: {selectedRecord.lokasiJuni}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shrink-0" />
                <span>JUNI: {selectedRecord.lokasiJuni}</span>
              </span>
            )}

            {selectedRecord.coordJuli ? (
              <a
                href={getGoogleMapsUrl(
                  selectedRecord.coordJuli.lat,
                  selectedRecord.coordJuli.lng
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (selectedRecord.coordJuli && mapInstanceRef.current) {
                    mapInstanceRef.current.setView(
                      [selectedRecord.coordJuli.lat, selectedRecord.coordJuli.lng],
                      17,
                      { animate: true }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 text-amber-300 hover:text-white hover:underline cursor-pointer"
                title="Klik untuk membuka Koordinat JULI di Google Maps"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
                <span>JULI: {selectedRecord.lokasiJuli}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
                <span>JULI: {selectedRecord.lokasiJuli}</span>
              </span>
            )}

            {selectedRecord.coordAgustus ? (
              <a
                href={getGoogleMapsUrl(
                  selectedRecord.coordAgustus.lat,
                  selectedRecord.coordAgustus.lng
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (selectedRecord.coordAgustus && mapInstanceRef.current) {
                    mapInstanceRef.current.setView(
                      [selectedRecord.coordAgustus.lat, selectedRecord.coordAgustus.lng],
                      17,
                      { animate: true }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-white hover:underline cursor-pointer"
                title="Klik untuk membuka Koordinat AGUSTUS di Google Maps"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>AGUSTUS: {selectedRecord.lokasiAgustus}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>AGUSTUS: {selectedRecord.lokasiAgustus}</span>
              </span>
            )}

            {selectedRecord.coordSeptember ? (
              <a
                href={getGoogleMapsUrl(
                  selectedRecord.coordSeptember.lat,
                  selectedRecord.coordSeptember.lng
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (selectedRecord.coordSeptember && mapInstanceRef.current) {
                    mapInstanceRef.current.setView(
                      [selectedRecord.coordSeptember.lat, selectedRecord.coordSeptember.lng],
                      17,
                      { animate: true }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 text-cyan-300 hover:text-white hover:underline cursor-pointer"
                title="Klik untuk membuka Koordinat SEPTEMBER di Google Maps"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block shrink-0" />
                <span>SEPTEMBER: {selectedRecord.lokasiSeptember}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block shrink-0" />
                <span>SEPTEMBER: {selectedRecord.lokasiSeptember}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Leaflet Map Canvas & Empty Overlay */}
      <div className="relative flex-1 w-full min-h-[340px]">
        <div
          ref={mapContainerRef}
          data-testid="leaflet-map-container"
          className="w-full h-full"
        />

        {validRecords.length === 0 && (
          <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-sm text-center shadow-lg">
              <p className="text-sm font-semibold text-slate-900">
                Tidak ada lokasi yang dapat ditampilkan.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Data belum memiliki koordinat Latitude dan Longitude yang valid.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
