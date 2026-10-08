import React from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  MoreVertical
} from "lucide-react";
import { LocationRecord, parseCombinedLocationString } from "../utils/validation";
import { CanonicalField, ColumnSchema } from "../utils/normalizeHeaders";
import { getGoogleMapsUrl } from "../utils/coordinateUtils";
import { Loading } from "./Loading";

interface DataTableProps {
  records: LocationRecord[];
  schemas: ColumnSchema[];
  visibleColumns: string[];
  activeSheetName?: string;
  selectedRecordId: string | null;
  onSelectRecord: (record: LocationRecord) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCsvModal: () => void;
  pageSizeOptions: number[];
  defaultPageSize: number;
}

type SortDirection = "asc" | "desc" | null;

const LEFT_MAIN_ROLES: CanonicalField[] = ["dil", "nama", "alamat"];

const KOORDINAT_GROUP_ROLES: CanonicalField[] = [
  "koordinat_dil",
  "lokasi_juni",
  "lokasi_juli",
  "lokasi_agustus",
  "lokasi_september",
  "lokasi_oktober",
  "lokasi_november",
  "lokasi_desember"
];

const JARAK_DIL_GROUP_ROLES: CanonicalField[] = [
  "jarak_dil_juni",
  "jarak_dil_juli",
  "jarak_dil_agustus",
  "jarak_dil_september",
  "jarak_dil_oktober",
  "jarak_dil_november",
  "jarak_dil_desember"
];

const JARAK_BULAN_GROUP_ROLES: CanonicalField[] = [
  "jarak_juli",
  "jarak_agustus",
  "jarak_september",
  "jarak_oktober",
  "jarak_november",
  "jarak_desember"
];

const SUB_HEADER_LABELS: Partial<Record<CanonicalField, string>> = {
  sampling: "SAMPLING",
  dil: "IDPEL",
  nama: "NAMA",
  alamat: "ALAMAT",
  koordinat_dil: "DIL",
  lokasi_juni: "JUNI",
  lokasi_juli: "JULI",
  lokasi_agustus: "AGUSTUS",
  lokasi_september: "SEPTEMBER",
  lokasi_oktober: "OKTOBER",
  lokasi_november: "NOVEMBER",
  lokasi_desember: "DESEMBER",
  jarak_dil_sampling: "DIL",
  jarak_dil_juni: "JUNI",
  jarak_dil_juli: "JULI",
  jarak_dil_agustus: "AGUSTUS",
  jarak_dil_september: "SEPTEMBER",
  jarak_dil_oktober: "OKTOBER",
  jarak_dil_november: "NOVEMBER",
  jarak_dil_desember: "DESEMBER",
  jarak_juli: "JUNI - JULI",
  jarak_agustus: "JULI - AGUSTUS",
  jarak_september: "AGUSTUS SEPTEMBER",
  jarak_oktober: "SEPTEMBER - OKTOBER",
  jarak_november: "OKTOBER - NOVEMBER",
  jarak_desember: "NOVEMBER - DESEMBER"
};

const SAMPLING_JARAK_BULAN_SUB_LABELS: Partial<Record<CanonicalField, string>> = {
  jarak_juli: "SAMPLING - JUNI",
  jarak_agustus: "SAMPLING - JULI",
  jarak_september: "SAMPLING - AGUSTUS",
  jarak_oktober: "SAMPLING - SEPTEMBER",
  jarak_november: "SAMPLING - OKTOBER",
  jarak_desember: "SAMPLING - NOVEMBER"
};

export const DataTable: React.FC<DataTableProps> = ({
  records,
  schemas,
  visibleColumns,
  activeSheetName,
  selectedRecordId,
  onSelectRecord,
  isLoading,
  onRefresh,
  onOpenCsvModal,
  pageSizeOptions,
  defaultPageSize
}) => {
  const [sortColumnKey, setSortColumnKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const rowRefs = React.useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Click-and-drag scrolling state for the table container
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [isDraggingScroll, setIsDraggingScroll] = React.useState(false);
  const dragStateRef = React.useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    hasMoved: false
  });

  const handleMouseDownScroll = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Ignore drag start if user clicked directly on a button, link, or input
    const target = e.target as HTMLElement;
    if (target.closest("a, button, select, input")) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    dragStateRef.current = {
      isDown: true,
      startX: e.pageX - container.offsetLeft,
      startY: e.pageY - container.offsetTop,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      hasMoved: false
    };
  };

  const handleMouseMoveScroll = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDown) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = x - dragStateRef.current.startX;
    const walkY = y - dragStateRef.current.startY;

    if (Math.abs(walkX) > 4 || Math.abs(walkY) > 4) {
      if (!dragStateRef.current.hasMoved) {
        dragStateRef.current.hasMoved = true;
        setIsDraggingScroll(true);
      }
      e.preventDefault();
      container.scrollLeft = dragStateRef.current.scrollLeft - walkX * 1.25;
      container.scrollTop = dragStateRef.current.scrollTop - walkY * 1.1;
    }
  };

  const stopDraggingScroll = () => {
    if (dragStateRef.current.isDown) {
      dragStateRef.current.isDown = false;
      setIsDraggingScroll(false);
    }
  };

  const isSamplingSheetSelected =
    (activeSheetName || "").trim().toUpperCase() === "SAMPLING";

  const {
    leftCols,
    coordCols,
    jarakDilCols,
    jarakBulanCols,
    extraCols,
    activeSchemas
  } = React.useMemo(() => {
    const filtered = schemas.filter((s) => visibleColumns.includes(s.normalizedKey));
    const baseList = filtered.length > 0 ? filtered : schemas.slice(0, 15);

    const pickByRoles = (roles: CanonicalField[]) =>
      roles
        .map((role) => baseList.find((s) => s.canonicalRole === role))
        .filter((s): s is ColumnSchema => Boolean(s));

    // Guarantee column order:
    // Left main columns: DIL, NAMA, ALAMAT
    // Under KOORDINAT group: [SAMPLING (before Koordinat DIL when SAMPLING sheet is active)], DIL (Koordinat DIL), JUNI..DESEMBER
    let samplingColSchemas: ColumnSchema[] = [];
    if (isSamplingSheetSelected) {
      const foundSampling =
        schemas.find((s) => s.canonicalRole === "sampling") ||
        baseList.find((s) => s.canonicalRole === "sampling");
      if (foundSampling) {
        samplingColSchemas = [foundSampling];
      }
    } else {
      samplingColSchemas = pickByRoles(["sampling"]);
    }

    // Under JARAK DENGAN DIL / JARAK DENGAN SAMPLING:
    // If SAMPLING sheet is selected, place DIL (jarak_dil_sampling) before JUNI
    let jarakDilSamplingCol: ColumnSchema[] = [];
    if (isSamplingSheetSelected) {
      const foundJarakSamplingDil =
        schemas.find((s) => s.canonicalRole === "jarak_dil_sampling") ||
        baseList.find((s) => s.canonicalRole === "jarak_dil_sampling");
      if (foundJarakSamplingDil) {
        jarakDilSamplingCol = [foundJarakSamplingDil];
      }
    }

    // Under JARAK ANTAR BULAN:
    // If SAMPLING sheet is selected, ensure the 4 columns SAMPLING - JUNI, SAMPLING - JULI, SAMPLING - AGUSTUS, SAMPLING - SEPTEMBER are included
    let jarakBulan: ColumnSchema[] = [];
    if (isSamplingSheetSelected) {
      const samplingBulanRoles: CanonicalField[] = [
        "jarak_juli",
        "jarak_agustus",
        "jarak_september",
        "jarak_oktober"
      ];
      jarakBulan = samplingBulanRoles
        .map(
          (role) =>
            baseList.find((s) => s.canonicalRole === role) ||
            schemas.find((s) => s.canonicalRole === role)
        )
        .filter((s): s is ColumnSchema => Boolean(s));
    } else {
      jarakBulan = pickByRoles(JARAK_BULAN_GROUP_ROLES);
    }

    const left = pickByRoles(LEFT_MAIN_ROLES);
    const coord = [...samplingColSchemas, ...pickByRoles(KOORDINAT_GROUP_ROLES)];
    const jarakDil = [...jarakDilSamplingCol, ...pickByRoles(JARAK_DIL_GROUP_ROLES)];

    const allGroupedRoles = new Set<CanonicalField>([
      "sampling",
      "jarak_dil_sampling",
      ...LEFT_MAIN_ROLES,
      ...KOORDINAT_GROUP_ROLES,
      ...JARAK_DIL_GROUP_ROLES,
      ...JARAK_BULAN_GROUP_ROLES
    ]);

    const extra = baseList.filter(
      (s) => !s.canonicalRole || !allGroupedRoles.has(s.canonicalRole)
    );

    return {
      leftCols: left,
      coordCols: coord,
      jarakDilCols: jarakDil,
      jarakBulanCols: jarakBulan,
      extraCols: extra,
      activeSchemas: [...left, ...coord, ...jarakDil, ...jarakBulan, ...extra]
    };
  }, [schemas, visibleColumns, isSamplingSheetSelected]);

  // Sort records
  const sortedRecords = React.useMemo(() => {
    if (!sortColumnKey || !sortDirection) {
      return [...records].sort((a, b) => {
        const aHasMonthly =
          (a.lokasiJuni && a.lokasiJuni !== "-") ||
          (a.lokasiJuli && a.lokasiJuli !== "-") ||
          (a.lokasiAgustus && a.lokasiAgustus !== "-") ||
          (a.lokasiSeptember && a.lokasiSeptember !== "-");
        const bHasMonthly =
          (b.lokasiJuni && b.lokasiJuni !== "-") ||
          (b.lokasiJuli && b.lokasiJuli !== "-") ||
          (b.lokasiAgustus && b.lokasiAgustus !== "-") ||
          (b.lokasiSeptember && b.lokasiSeptember !== "-");

        if (aHasMonthly !== bHasMonthly) {
          return aHasMonthly ? -1 : 1;
        }
        if (a.hasValidCoords !== b.hasValidCoords) {
          return a.hasValidCoords ? -1 : 1;
        }
        return a._rowNumber - b._rowNumber;
      });
    }

    const targetSchema = schemas.find((s) => s.normalizedKey === sortColumnKey);
    if (!targetSchema) return records;

    return [...records].sort((a, b) => {
      const role = targetSchema.canonicalRole;

      // Numeric distance sorting
      if (role === "jarak_dil_sampling") {
        const dA = a.jarakSamplingDilMeters ?? -1;
        const dB = b.jarakSamplingDilMeters ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_juni") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingJuniMeters : a.jarakDilJuniMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingJuniMeters : b.jarakDilJuniMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_juli") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingJuliMeters : a.jarakDilJuliMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingJuliMeters : b.jarakDilJuliMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_agustus") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingAgustusMeters : a.jarakDilAgustusMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingAgustusMeters : b.jarakDilAgustusMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_september") {
        const dA =
          (isSamplingSheetSelected
            ? a.jarakSamplingSeptemberMeters
            : a.jarakDilSeptemberMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected
            ? b.jarakSamplingSeptemberMeters
            : b.jarakDilSeptemberMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_oktober") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingOktoberMeters : a.jarakDilOktoberMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingOktoberMeters : b.jarakDilOktoberMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_november") {
        const dA =
          (isSamplingSheetSelected
            ? a.jarakSamplingNovemberMeters
            : a.jarakDilNovemberMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected
            ? b.jarakSamplingNovemberMeters
            : b.jarakDilNovemberMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_dil_desember") {
        const dA =
          (isSamplingSheetSelected
            ? a.jarakSamplingDesemberMeters
            : a.jarakDilDesemberMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected
            ? b.jarakSamplingDesemberMeters
            : b.jarakDilDesemberMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_juli") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingJuniMeters : a.jarakJuliMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingJuniMeters : b.jarakJuliMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_agustus") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingJuliMeters : a.jarakAgustusMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingJuliMeters : b.jarakAgustusMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_september") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingAgustusMeters : a.jarakSeptemberMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingAgustusMeters : b.jarakSeptemberMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_oktober") {
        const dA =
          (isSamplingSheetSelected ? a.jarakSamplingSeptemberMeters : a.jarakOktoberMeters) ?? -1;
        const dB =
          (isSamplingSheetSelected ? b.jarakSamplingSeptemberMeters : b.jarakOktoberMeters) ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_november") {
        const dA = a.jarakNovemberMeters ?? -1;
        const dB = b.jarakNovemberMeters ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }
      if (role === "jarak_desember") {
        const dA = a.jarakDesemberMeters ?? -1;
        const dB = b.jarakDesemberMeters ?? -1;
        return sortDirection === "asc" ? dA - dB : dB - dA;
      }

      let valA = a.rawValues[targetSchema.originalHeader] ?? "";
      let valB = b.rawValues[targetSchema.originalHeader] ?? "";

      if (role === "sampling") {
        valA = a.lokasiSampling !== "-" ? a.lokasiSampling : "";
        valB = b.lokasiSampling !== "-" ? b.lokasiSampling : "";
      } else if (role === "dil") {
        valA = a.dil !== "-" ? a.dil : "";
        valB = b.dil !== "-" ? b.dil : "";
      } else if (role === "nama") {
        valA = a.nama !== "-" ? a.nama : "";
        valB = b.nama !== "-" ? b.nama : "";
      } else if (role === "alamat") {
        valA = a.alamat !== "-" ? a.alamat : "";
        valB = b.alamat !== "-" ? b.alamat : "";
      } else if (role === "koordinat_dil") {
        valA = a.koordinatDil !== "-" ? a.koordinatDil : "";
        valB = b.koordinatDil !== "-" ? b.koordinatDil : "";
      } else if (role === "lokasi_juni") {
        valA = a.lokasiJuni !== "-" ? a.lokasiJuni : "";
        valB = b.lokasiJuni !== "-" ? b.lokasiJuni : "";
      } else if (role === "lokasi_juli") {
        valA = a.lokasiJuli !== "-" ? a.lokasiJuli : "";
        valB = b.lokasiJuli !== "-" ? b.lokasiJuli : "";
      } else if (role === "lokasi_agustus") {
        valA = a.lokasiAgustus !== "-" ? a.lokasiAgustus : "";
        valB = b.lokasiAgustus !== "-" ? b.lokasiAgustus : "";
      } else if (role === "lokasi_september") {
        valA = a.lokasiSeptember !== "-" ? a.lokasiSeptember : "";
        valB = b.lokasiSeptember !== "-" ? b.lokasiSeptember : "";
      }

      const numA = Number(valA);
      const numB = Number(valB);
      if (valA !== "" && valB !== "" && Number.isFinite(numA) && Number.isFinite(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      const cmp = valA.localeCompare(valB, "id", { sensitivity: "base", numeric: true });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [records, sortColumnKey, sortDirection, schemas]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [sortedRecords.length, totalPages, currentPage]);

  React.useEffect(() => {
    if (!selectedRecordId) return;
    const idx = sortedRecords.findIndex((r) => r._rowId === selectedRecordId);
    if (idx === -1) return;

    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }

    setTimeout(() => {
      const rowEl = rowRefs.current.get(selectedRecordId);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 60);
  }, [selectedRecordId, sortedRecords, pageSize]);

  const paginatedRecords = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (normalizedKey: string) => {
    if (sortColumnKey !== normalizedKey) {
      setSortColumnKey(normalizedKey);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortColumnKey(null);
      setSortDirection(null);
    }
  };

  const renderSortIcon = (normalizedKey: string, isDarkBg = false) => {
    const isSorted = sortColumnKey === normalizedKey;
    if (!isSorted) {
      return (
        <ArrowUpDown
          className={`w-3 h-3 shrink-0 ${
            isDarkBg ? "text-blue-200/75" : "text-slate-400"
          }`}
        />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp
        className={`w-3 h-3 shrink-0 ${
          isDarkBg ? "text-white" : "text-blue-700"
        }`}
      />
    ) : (
      <ArrowDown
        className={`w-3 h-3 shrink-0 ${
          isDarkBg ? "text-white" : "text-blue-700"
        }`}
      />
    );
  };

  const getCoordHeaderPinColor = (role: CanonicalField | null, key: string) => {
    if (role === "sampling") return "text-blue-600 fill-blue-600/20";
    if (role === "koordinat_dil") return "text-purple-600 fill-purple-600/20";
    if (role === "lokasi_juni" || key === "juni") return "text-blue-600 fill-blue-600/20";
    if (role === "lokasi_juli" || key === "juli") return "text-amber-500 fill-amber-500/20";
    if (role === "lokasi_agustus" || key === "agustus")
      return "text-emerald-600 fill-emerald-600/20";
    if (role === "lokasi_september" || key === "september")
      return "text-cyan-600 fill-cyan-600/20";
    if (role === "lokasi_oktober" || key === "oktober")
      return "text-rose-600 fill-rose-600/20";
    if (role === "lokasi_november" || key === "november")
      return "text-indigo-600 fill-indigo-600/20";
    if (role === "lokasi_desember" || key === "desember")
      return "text-teal-600 fill-teal-600/20";
    return "text-blue-600 fill-blue-600/20";
  };

  const getCoordPillTheme = (role: CanonicalField | null, key: string) => {
    if (role === "koordinat_dil") {
      return {
        pillBg: "bg-[#f3e8ff] border-[#e9d5ff] text-[#6b21a8] hover:bg-[#e9d5ff]/80",
        pinBg: "bg-[#9333ea] text-white"
      };
    }
    if (role === "lokasi_juli" || key === "juli") {
      return {
        pillBg: "bg-[#fef3c7]/85 border-[#fde68a] text-[#b45309] hover:bg-[#fde68a]/70",
        pinBg: "bg-[#f59e0b] text-white"
      };
    }
    if (role === "lokasi_agustus" || key === "agustus") {
      return {
        pillBg: "bg-[#d1fae5]/80 border-[#a7f3d0] text-[#047857] hover:bg-[#a7f3d0]/70",
        pinBg: "bg-[#10b981] text-white"
      };
    }
    if (role === "lokasi_september" || key === "september") {
      return {
        pillBg: "bg-[#cffafe]/80 border-[#a5f3fc] text-[#0e7490] hover:bg-[#a5f3fc]/70",
        pinBg: "bg-[#06b6d4] text-white"
      };
    }
    // Default (SAMPLING, JUNI, etc.): Blue theme
    return {
      pillBg: "bg-[#e0f2fe]/85 border-[#bae6fd] text-[#1d4ed8] hover:bg-[#bae6fd]/70",
      pinBg: "bg-[#2563eb] text-white"
    };
  };

  const renderStatusText = (val: string) => {
    const upper = val.toUpperCase();
    if (
      upper.includes("SUDAH") ||
      upper.includes("VALID") ||
      upper.includes("AKTIF") ||
      upper.includes("SELESAI") ||
      upper.includes("SESUAI")
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{val}</span>
        </span>
      );
    }
    if (
      upper.includes("BELUM") ||
      upper.includes("PENDING") ||
      upper.includes("PROSES")
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{val}</span>
        </span>
      );
    }
    if (
      upper.includes("TIDAK") ||
      upper.includes("GAGAL") ||
      upper.includes("ERROR") ||
      upper.includes("INVALID")
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{val}</span>
        </span>
      );
    }
    return <span className="text-slate-700">{val}</span>;
  };

  // Generate page numbers for pagination bar (1 2 3 4 5 ... N)
  const pageNumbers = React.useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages
        );
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  if (isLoading && records.length === 0) {
    return (
      <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <Loading />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg p-8 text-center min-h-[340px]">
        <p className="text-base font-semibold text-slate-800">Belum ada data</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Silakan refresh database atau upload file CSV untuk menampilkan daftar lokasi.
        </p>
        <div className="flex items-center gap-2.5 mt-4">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Database</span>
          </button>
          <button
            type="button"
            onClick={onOpenCsvModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
          </button>
        </div>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, sortedRecords.length);

  const hasSubHeaderGroups =
    coordCols.length > 0 || jarakDilCols.length > 0 || jarakBulanCols.length > 0;

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
      {/* Table Scroll Container (Hold & Drag left/right to pan) */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDownScroll}
        onMouseMove={handleMouseMoveScroll}
        onMouseUp={stopDraggingScroll}
        onMouseLeave={stopDraggingScroll}
        className={`flex-1 overflow-auto ${
          isDraggingScroll ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 text-[11px] font-bold select-none">
            {/* Row 1: Main Columns (rowSpan=2) + Group Headers (KOORDINAT, JARAK DENGAN DIL, JARAK ANTAR BULAN) + AKSI */}
            <tr>
              <th
                rowSpan={hasSubHeaderGroups ? 2 : 1}
                className="py-3 px-3.5 w-12 text-center font-bold text-white bg-[#2c5278] border-r border-[#3b6691] align-middle"
              >
                No.
              </th>

              {leftCols.map((col) => {
                const displayLabel =
                  (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) || col.label;
                return (
                  <th
                    key={col.normalizedKey}
                    rowSpan={hasSubHeaderGroups ? 2 : 1}
                    className="py-3 px-3.5 bg-[#2c5278] text-white border-r border-[#3b6691] text-left align-middle"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.normalizedKey)}
                      className="inline-flex items-center gap-1.5 font-bold text-white hover:text-blue-100 transition-colors cursor-pointer whitespace-nowrap tracking-wide"
                    >
                      <span>{displayLabel}</span>
                      {renderSortIcon(col.normalizedKey, true)}
                    </button>
                  </th>
                );
              })}

              {coordCols.length > 0 && (
                <th
                  colSpan={coordCols.length}
                  className="py-2 px-3 text-center font-extrabold text-[#1e3a5f] bg-[#bfd6f6] border-b border-r border-[#a5c3ec] tracking-wider uppercase"
                >
                  KOORDINAT
                </th>
              )}

              {jarakDilCols.length > 0 && (
                <th
                  colSpan={jarakDilCols.length}
                  className="py-2 px-3 text-center font-extrabold text-amber-950 bg-[#fde68a] border-b border-r border-amber-300 tracking-wider uppercase"
                >
                  {isSamplingSheetSelected ? "JARAK DENGAN SAMPLING" : "JARAK DENGAN DIL"}
                </th>
              )}

              {jarakBulanCols.length > 0 && (
                <th
                  colSpan={jarakBulanCols.length}
                  className="py-2 px-3 text-center font-extrabold text-emerald-950 bg-[#bbf7d0] border-b border-r border-emerald-300 tracking-wider uppercase"
                >
                  JARAK ANTAR BULAN
                </th>
              )}

              {extraCols.map((col) => (
                <th
                  key={col.normalizedKey}
                  rowSpan={hasSubHeaderGroups ? 2 : 1}
                  className="py-3 px-3 bg-[#dbe7f6] text-[#1e3a5f] border-b border-r border-slate-300 text-center align-middle"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.normalizedKey)}
                    className="inline-flex items-center justify-center gap-1 font-bold text-[#1e3a5f] hover:text-blue-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{col.label}</span>
                    {renderSortIcon(col.normalizedKey)}
                  </button>
                </th>
              ))}

              {/* AKSI column on the right */}
              <th
                rowSpan={hasSubHeaderGroups ? 2 : 1}
                className="py-3 px-3.5 bg-[#dbe7f6] text-[#1e3a5f] border-b border-l border-slate-300 text-center align-middle font-extrabold tracking-wider"
              >
                AKSI
              </th>
            </tr>

            {/* Row 2: Sub-columns under KOORDINAT, JARAK DENGAN DIL, JARAK ANTAR BULAN */}
            {hasSubHeaderGroups && (
              <tr>
                {coordCols.map((col) => {
                  const subLabel =
                    (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) || col.label;
                  const pinColor = getCoordHeaderPinColor(
                    col.canonicalRole,
                    col.normalizedKey
                  );
                  return (
                    <th
                      key={col.normalizedKey}
                      className="py-2 px-3.5 bg-[#e5effc] border-b border-r border-[#cbdcf5] text-left align-middle"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col.normalizedKey)}
                        className="inline-flex items-center gap-1.5 font-extrabold text-[#1e3a5f] hover:text-blue-800 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <MapPin className={`w-3.5 h-3.5 shrink-0 ${pinColor}`} />
                        <span>{subLabel}</span>
                        {renderSortIcon(col.normalizedKey)}
                      </button>
                    </th>
                  );
                })}

                {jarakDilCols.map((col) => {
                  const subLabel =
                    (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) || col.label;
                  return (
                    <th
                      key={col.normalizedKey}
                      className="py-2 px-3 bg-[#fef3c7] border-b border-r border-amber-200 text-center align-middle"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col.normalizedKey)}
                        className="inline-flex items-center justify-center gap-1 font-extrabold text-amber-950 hover:text-amber-800 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>{subLabel}</span>
                        {renderSortIcon(col.normalizedKey)}
                      </button>
                    </th>
                  );
                })}

                {jarakBulanCols.map((col) => {
                  const subLabel =
                    (isSamplingSheetSelected &&
                      col.canonicalRole &&
                      SAMPLING_JARAK_BULAN_SUB_LABELS[col.canonicalRole]) ||
                    (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) ||
                    col.label;
                  return (
                    <th
                      key={col.normalizedKey}
                      className="py-2 px-3 bg-[#dcfce7] border-b border-r border-emerald-200 text-center align-middle"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col.normalizedKey)}
                        className="inline-flex items-center justify-center gap-1 font-extrabold text-emerald-950 hover:text-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span className="leading-tight">{subLabel}</span>
                        {renderSortIcon(col.normalizedKey)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-slate-200/80 text-xs">
            {paginatedRecords.map((rec, idx) => {
              const rowNumber = startIdx + idx;
              const isSelected = selectedRecordId === rec._rowId;

              return (
                <tr
                  key={rec._rowId}
                  ref={(el) => {
                    if (el) rowRefs.current.set(rec._rowId, el);
                    else rowRefs.current.delete(rec._rowId);
                  }}
                  onClick={() => {
                    if (dragStateRef.current.hasMoved) {
                      dragStateRef.current.hasMoved = false;
                      return;
                    }
                    onSelectRecord(rec);
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectRecord(rec);
                    }
                  }}
                  aria-selected={isSelected}
                  className={`transition-colors ${
                    isDraggingScroll ? "cursor-grabbing" : "cursor-pointer"
                  } ${
                    isSelected
                      ? "bg-blue-50/90 hover:bg-blue-100/70 font-medium"
                      : "hover:bg-slate-50/90"
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-semibold tabular-nums text-slate-600 border-r border-slate-100">
                    {rowNumber}
                  </td>

                  {activeSchemas.map((col) => {
                    const role = col.canonicalRole;
                    let val = rec.rawValues[col.originalHeader] || "-";

                    if (role === "sampling") {
                      val =
                        rec.lokasiSampling && rec.lokasiSampling !== "-"
                          ? rec.lokasiSampling
                          : val;
                    } else if (role === "dil") {
                      val = rec.dil && rec.dil !== "-" ? rec.dil : val !== "-" ? val : rec.id;
                    } else if (role === "nama") {
                      val = rec.nama && rec.nama !== "-" ? rec.nama : val;
                    } else if (role === "alamat") {
                      val = rec.alamat && rec.alamat !== "-" ? rec.alamat : val;
                    } else if (role === "koordinat_dil") {
                      val = rec.koordinatDil && rec.koordinatDil !== "-" ? rec.koordinatDil : val;
                    } else if (role === "lokasi_juni" || col.normalizedKey === "juni") {
                      val = rec.lokasiJuni && rec.lokasiJuni !== "-" ? rec.lokasiJuni : val;
                    } else if (role === "lokasi_juli" || col.normalizedKey === "juli") {
                      val = rec.lokasiJuli && rec.lokasiJuli !== "-" ? rec.lokasiJuli : val;
                    } else if (role === "lokasi_agustus" || col.normalizedKey === "agustus") {
                      val = rec.lokasiAgustus && rec.lokasiAgustus !== "-" ? rec.lokasiAgustus : val;
                    } else if (role === "lokasi_september" || col.normalizedKey === "september") {
                      val =
                        rec.lokasiSeptember && rec.lokasiSeptember !== "-"
                          ? rec.lokasiSeptember
                          : val;
                    } else if (role === "lokasi_oktober" || col.normalizedKey === "oktober") {
                      val =
                        rec.lokasiOktober && rec.lokasiOktober !== "-"
                          ? rec.lokasiOktober
                          : val;
                    } else if (role === "lokasi_november" || col.normalizedKey === "november") {
                      val =
                        rec.lokasiNovember && rec.lokasiNovember !== "-"
                          ? rec.lokasiNovember
                          : val;
                    } else if (role === "lokasi_desember" || col.normalizedKey === "desember") {
                      val =
                        rec.lokasiDesember && rec.lokasiDesember !== "-"
                          ? rec.lokasiDesember
                          : val;
                    } else if (role === "jarak_dil_sampling") {
                      val =
                        rec.jarakSamplingDil && rec.jarakSamplingDil !== "-"
                          ? rec.jarakSamplingDil
                          : val;
                    } else if (role === "jarak_dil_juni") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingJuni && rec.jarakSamplingJuni !== "-"
                          ? rec.jarakSamplingJuni
                          : "-"
                        : rec.jarakDilJuni && rec.jarakDilJuni !== "-"
                        ? rec.jarakDilJuni
                        : val;
                    } else if (role === "jarak_dil_juli") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingJuli && rec.jarakSamplingJuli !== "-"
                          ? rec.jarakSamplingJuli
                          : "-"
                        : rec.jarakDilJuli && rec.jarakDilJuli !== "-"
                        ? rec.jarakDilJuli
                        : val;
                    } else if (role === "jarak_dil_agustus") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingAgustus && rec.jarakSamplingAgustus !== "-"
                          ? rec.jarakSamplingAgustus
                          : "-"
                        : rec.jarakDilAgustus && rec.jarakDilAgustus !== "-"
                        ? rec.jarakDilAgustus
                        : val;
                    } else if (role === "jarak_dil_september") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingSeptember && rec.jarakSamplingSeptember !== "-"
                          ? rec.jarakSamplingSeptember
                          : "-"
                        : rec.jarakDilSeptember && rec.jarakDilSeptember !== "-"
                        ? rec.jarakDilSeptember
                        : val;
                    } else if (role === "jarak_dil_oktober") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingOktober && rec.jarakSamplingOktober !== "-"
                          ? rec.jarakSamplingOktober
                          : "-"
                        : rec.jarakDilOktober && rec.jarakDilOktober !== "-"
                        ? rec.jarakDilOktober
                        : val;
                    } else if (role === "jarak_dil_november") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingNovember && rec.jarakSamplingNovember !== "-"
                          ? rec.jarakSamplingNovember
                          : "-"
                        : rec.jarakDilNovember && rec.jarakDilNovember !== "-"
                        ? rec.jarakDilNovember
                        : val;
                    } else if (role === "jarak_dil_desember") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingDesember && rec.jarakSamplingDesember !== "-"
                          ? rec.jarakSamplingDesember
                          : "-"
                        : rec.jarakDilDesember && rec.jarakDilDesember !== "-"
                        ? rec.jarakDilDesember
                        : val;
                    } else if (role === "jarak_juli") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingJuni && rec.jarakSamplingJuni !== "-"
                          ? rec.jarakSamplingJuni
                          : "-"
                        : rec.jarakJuli && rec.jarakJuli !== "-"
                        ? rec.jarakJuli
                        : val;
                    } else if (role === "jarak_agustus") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingJuli && rec.jarakSamplingJuli !== "-"
                          ? rec.jarakSamplingJuli
                          : "-"
                        : rec.jarakAgustus && rec.jarakAgustus !== "-"
                        ? rec.jarakAgustus
                        : val;
                    } else if (role === "jarak_september") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingAgustus && rec.jarakSamplingAgustus !== "-"
                          ? rec.jarakSamplingAgustus
                          : "-"
                        : rec.jarakSeptember && rec.jarakSeptember !== "-"
                        ? rec.jarakSeptember
                        : val;
                    } else if (role === "jarak_oktober") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingSeptember && rec.jarakSamplingSeptember !== "-"
                          ? rec.jarakSamplingSeptember
                          : "-"
                        : rec.jarakOktober && rec.jarakOktober !== "-"
                        ? rec.jarakOktober
                        : val;
                    } else if (role === "jarak_november") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingOktober && rec.jarakSamplingOktober !== "-"
                          ? rec.jarakSamplingOktober
                          : "-"
                        : rec.jarakNovember && rec.jarakNovember !== "-"
                        ? rec.jarakNovember
                        : val;
                    } else if (role === "jarak_desember") {
                      val = isSamplingSheetSelected
                        ? rec.jarakSamplingNovember && rec.jarakSamplingNovember !== "-"
                          ? rec.jarakSamplingNovember
                          : "-"
                        : rec.jarakDesember && rec.jarakDesember !== "-"
                        ? rec.jarakDesember
                        : val;
                    }

                    const isDistanceCol =
                      role === "jarak_dil_sampling" ||
                      Boolean(role && JARAK_DIL_GROUP_ROLES.includes(role)) ||
                      Boolean(role && JARAK_BULAN_GROUP_ROLES.includes(role));

                    // Resolve numeric distance in meters to check if > 100 meters
                    let distanceMeters: number | null = null;
                    if (role === "jarak_dil_sampling") {
                      distanceMeters = rec.jarakSamplingDilMeters;
                    } else if (role === "jarak_dil_juni") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingJuniMeters
                        : rec.jarakDilJuniMeters;
                    } else if (role === "jarak_dil_juli") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingJuliMeters
                        : rec.jarakDilJuliMeters;
                    } else if (role === "jarak_dil_agustus") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingAgustusMeters
                        : rec.jarakDilAgustusMeters;
                    } else if (role === "jarak_dil_september") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingSeptemberMeters
                        : rec.jarakDilSeptemberMeters;
                    } else if (role === "jarak_dil_oktober") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingOktoberMeters
                        : rec.jarakDilOktoberMeters;
                    } else if (role === "jarak_dil_november") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingNovemberMeters
                        : rec.jarakDilNovemberMeters;
                    } else if (role === "jarak_dil_desember") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingDesemberMeters
                        : rec.jarakDilDesemberMeters;
                    } else if (role === "jarak_juli") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingJuniMeters
                        : rec.jarakJuliMeters;
                    } else if (role === "jarak_agustus") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingJuliMeters
                        : rec.jarakAgustusMeters;
                    } else if (role === "jarak_september") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingAgustusMeters
                        : rec.jarakSeptemberMeters;
                    } else if (role === "jarak_oktober") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingSeptemberMeters
                        : rec.jarakOktoberMeters;
                    } else if (role === "jarak_november") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingOktoberMeters
                        : rec.jarakNovemberMeters;
                    } else if (role === "jarak_desember") {
                      distanceMeters = isSamplingSheetSelected
                        ? rec.jarakSamplingNovemberMeters
                        : rec.jarakDesemberMeters;
                    }

                    // Fallback parser if formatted string is present (e.g. "125,4 m" or "1.250 m")
                    if (distanceMeters === null && isDistanceCol && val && val !== "-") {
                      const cleaned = val
                        .replace(/\s*m$/i, "")
                        .replace(/\./g, "")
                        .replace(",", ".")
                        .trim();
                      const parsedNum = Number(cleaned);
                      if (Number.isFinite(parsedNum)) {
                        distanceMeters = parsedNum;
                      }
                    }

                    const isOver100Meters =
                      isDistanceCol && distanceMeters !== null && distanceMeters > 100;

                    const isCoordCol = Boolean(
                      role && (role === "sampling" || KOORDINAT_GROUP_ROLES.includes(role))
                    );

                    const isMonospace =
                      role === "sampling" ||
                      role === "dil" ||
                      role === "id" ||
                      role === "latitude" ||
                      role === "longitude" ||
                      isCoordCol ||
                      isDistanceCol ||
                      role === "tanggal" ||
                      role === "waktu";

                    // Resolve clickable coordinate if this cell represents a coordinate point
                    let cellCoord: { lat: number; lng: number } | null = null;
                    if (role === "sampling" && rec.coordSampling) {
                      cellCoord = rec.coordSampling;
                    } else if (role === "koordinat_dil" && rec.coordDil) {
                      cellCoord = rec.coordDil;
                    } else if (
                      (role === "lokasi_juni" || col.normalizedKey === "juni") &&
                      rec.coordJuni
                    ) {
                      cellCoord = rec.coordJuni;
                    } else if (
                      (role === "lokasi_juli" || col.normalizedKey === "juli") &&
                      rec.coordJuli
                    ) {
                      cellCoord = rec.coordJuli;
                    } else if (
                      (role === "lokasi_agustus" || col.normalizedKey === "agustus") &&
                      rec.coordAgustus
                    ) {
                      cellCoord = rec.coordAgustus;
                    } else if (
                      (role === "lokasi_september" || col.normalizedKey === "september") &&
                      rec.coordSeptember
                    ) {
                      cellCoord = rec.coordSeptember;
                    } else if (
                      (role === "lokasi_oktober" || col.normalizedKey === "oktober") &&
                      rec.coordOktober
                    ) {
                      cellCoord = rec.coordOktober;
                    } else if (
                      (role === "lokasi_november" || col.normalizedKey === "november") &&
                      rec.coordNovember
                    ) {
                      cellCoord = rec.coordNovember;
                    } else if (
                      (role === "lokasi_desember" || col.normalizedKey === "desember") &&
                      rec.coordDesember
                    ) {
                      cellCoord = rec.coordDesember;
                    } else if (
                      (role === "latitude" || role === "longitude") &&
                      rec.coordDil
                    ) {
                      cellCoord = rec.coordDil;
                    } else if (val !== "-") {
                      const parsed = parseCombinedLocationString(val);
                      if (parsed.isValid && parsed.lat !== null && parsed.lng !== null) {
                        cellCoord = { lat: parsed.lat, lng: parsed.lng };
                      }
                    }

                    const pillTheme = getCoordPillTheme(role, col.normalizedKey);

                    return (
                      <td
                        key={col.normalizedKey}
                        className={`py-2 px-3 border-r border-slate-100 ${
                          isCoordCol || cellCoord
                            ? "whitespace-nowrap min-w-[200px]"
                            : isDistanceCol
                            ? "whitespace-nowrap text-right font-semibold min-w-[100px]"
                            : role === "dil" || role === "nama"
                            ? "whitespace-nowrap font-semibold text-[#1e3a5f]"
                            : "max-w-[230px] truncate text-[#334155]"
                        } ${
                          isOver100Meters
                            ? "font-mono tabular-nums text-red-600 font-bold"
                            : isMonospace && !cellCoord
                            ? "font-mono tabular-nums text-slate-800"
                            : ""
                        }`}
                        title={
                          cellCoord
                            ? `Klik untuk buka di Google Maps (${val})`
                            : isOver100Meters
                            ? `Jarak > 100 Meter (${val})`
                            : val
                        }
                      >
                        {role === "status" ? (
                          renderStatusText(val)
                        ) : cellCoord && val !== "-" ? (
                          <div className="flex items-center justify-between gap-1.5">
                            <a
                              href={getGoogleMapsUrl(cellCoord.lat, cellCoord.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectRecord(rec);
                              }}
                              title={`Buka titik koordinat (${val}) di Google Maps`}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-mono font-semibold transition-all ${pillTheme.pillBg}`}
                            >
                              <span
                                className={`w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 ${pillTheme.pinBg}`}
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </span>
                              <span className="truncate max-w-[145px]">{val}</span>
                            </a>
                            <a
                              href={getGoogleMapsUrl(cellCoord.lat, cellCoord.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectRecord(rec);
                              }}
                              title="Buka di Google Maps"
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : isOver100Meters ? (
                          <span className="text-red-600 font-bold">{val}</span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}

                  {/* AKSI cell on the right */}
                  <td className="py-2 px-3 text-center whitespace-nowrap border-l border-slate-100">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord(rec);
                        }}
                        title="Lihat titik lokasi pada Peta Aplikasi"
                        className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </button>
                      {rec.latitude !== null && rec.longitude !== null ? (
                        <a
                          href={getGoogleMapsUrl(rec.latitude, rec.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Buka koordinat utama di Google Maps"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 inline-flex items-center justify-center border border-slate-200/80 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRecord(rec);
                          }}
                          title="Detail baris"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 inline-flex items-center justify-center border border-slate-200/80 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer matching the mockup image */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-t border-slate-200/90 text-xs text-slate-600">
        {/* Left: Menampilkan 1 - 9 dari 203 data */}
        <div className="tabular-nums text-slate-600">
          Menampilkan <strong className="font-bold text-slate-800">{startIdx}</strong> -{" "}
          <strong className="font-bold text-slate-800">{endIdx}</strong> dari{" "}
          <strong className="font-bold text-slate-800">{sortedRecords.length}</strong> data
        </div>

        {/* Center/Right: Numbered Pagination + Tampilkan per halaman */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Halaman sebelumnya"
              className="w-7 h-7 inline-flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-slate-400 font-semibold select-none"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`min-w-7 h-7 px-2 inline-flex items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                    currentPage === p
                      ? "bg-blue-600 text-white border border-blue-600 shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Halaman berikutnya"
              className="w-7 h-7 inline-flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="table-page-size" className="text-slate-500 font-medium">
              Tampilkan per halaman:
            </label>
            <select
              id="table-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs font-bold tabular-nums text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
