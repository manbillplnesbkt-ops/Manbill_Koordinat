/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AlertCircle, CheckCircle2, Info, X, Upload, Settings2, RefreshCw } from "lucide-react";
import {
  AppConfig,
  loadConfig,
  saveConfig,
  resetConfig
} from "./config/config";
import { CanonicalField, ColumnSchema, TargetMonthlySheet } from "./utils/normalizeHeaders";
import { LocationRecord } from "./utils/validation";
import {
  fetchSpreadsheetData,
  importCsvToSpreadsheet,
  ImportMode
} from "./services/spreadsheetService";
import { exportRecordsToExcel } from "./services/csvService";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { FilterPanel } from "./components/FilterPanel";
import { DataTable } from "./components/DataTable";
import { MapView } from "./components/MapView";
import { CsvUploader } from "./components/CsvUploader";
import { ConfigModal } from "./components/ConfigModal";

interface ToastNotification {
  id: number;
  type: "info" | "warning" | "success" | "error";
  message: string;
}

export default function App() {
  const [config, setConfig] = React.useState<AppConfig>(() => loadConfig());
  const [records, setRecords] = React.useState<LocationRecord[]>([]);
  const [schemas, setSchemas] = React.useState<ColumnSchema[]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = React.useState<string[]>(() =>
    Array.from(
      new Set([
        config.SHEET_NAME || "Data",
        "Data",
        "DIL",
        "JUNI",
        "JULI",
        "AGUSTUS",
        "SEPTEMBER",
        "OKTOBER",
        "NOVEMBER",
        "DESEMBER",
        "SAMPLING"
      ])
    )
  );
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [warningBanner, setWarningBanner] = React.useState<string | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedUnit, setSelectedUnit] = React.useState<string>("");
  const [selectedPetugas, setSelectedPetugas] = React.useState<string>("");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("");
  const [coordFilter, setCoordFilter] = React.useState<"all" | "valid" | "missing">("all");

  // Active Row / Marker Selection
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);

  // Modals
  const [isCsvModalOpen, setIsCsvModalOpen] = React.useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = React.useState<boolean>(false);

  // Toast Notifications (e.g., "Data ini belum memiliki koordinat lokasi.")
  const [toast, setToast] = React.useState<ToastNotification | null>(null);

  const showToast = React.useCallback(
    (type: ToastNotification["type"], message: string) => {
      setToast({
        id: Date.now(),
        type,
        message
      });
    },
    []
  );

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load Data from Google Spreadsheet
  const handleLoadSpreadsheet = React.useCallback(
    async (activeConfig: AppConfig, preserveFilters = true) => {
      setIsLoading(true);
      setFetchError(null);
      setWarningBanner(null);

      try {
        const data = await fetchSpreadsheetData(activeConfig);
        setRecords(data.records);
        setSchemas(data.schemas);
        setHeaders(data.headers);
        setAvailableSheets(
          data.availableSheets.length > 0
            ? Array.from(new Set(data.availableSheets.map((s) => s.trim()).filter(Boolean)))
            : [activeConfig.SHEET_NAME || "Data"]
        );
        setLastUpdated(data.updatedAt);

        if (data.warningMessage) {
          setWarningBanner(data.warningMessage);
        }

        // Initialize visible columns on first load or if schema changed
        const isSamplingActive =
          (activeConfig.SHEET_NAME || "").trim().toUpperCase() === "SAMPLING";
        setVisibleColumns((prev) => {
          const validPrev = prev.filter((k) =>
            data.schemas.some((s) => s.normalizedKey === k)
          );
          const defaultKeys = data.schemas
            .filter(
              (s) =>
                s.isDefaultVisible ||
                (isSamplingActive && s.canonicalRole === "sampling")
            )
            .map((s) => s.normalizedKey);

          if (validPrev.length > 0) {
            const combined = Array.from(new Set([...defaultKeys, ...validPrev]));
            if (!isSamplingActive) {
              const samplingKey = data.schemas.find(
                (s) => s.canonicalRole === "sampling"
              )?.normalizedKey;
              return samplingKey ? combined.filter((k) => k !== samplingKey) : combined;
            }
            return combined;
          }
          return defaultKeys;
        });

        if (!preserveFilters) {
          setSearchQuery("");
          setSelectedUnit("");
          setSelectedPetugas("");
          setSelectedStatus("");
          setCoordFilter("all");
        }
      } catch (err: any) {
        console.error("Spreadsheet load error:", err);
        setFetchError(
          err.message ||
            "Gagal mengambil data dari Spreadsheet. Periksa Spreadsheet ID, Nama Sheet, Koneksi API, dan Permission Spreadsheet."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    handleLoadSpreadsheet(config, true);
  }, [config, handleLoadSpreadsheet]);

  // Compute unique dynamic filter options from loaded records
  const filterOptions = React.useMemo(() => {
    const units = new Set<string>();
    const petugasSet = new Set<string>();
    const statuses = new Set<string>();

    const hasUnitCol = schemas.some((s) => s.canonicalRole === "unit");
    const hasPetugasCol = schemas.some((s) => s.canonicalRole === "petugas");
    const hasStatusCol = schemas.some((s) => s.canonicalRole === "status");

    for (const r of records) {
      if (hasUnitCol && r.unit && r.unit !== "-") units.add(r.unit);
      if (hasPetugasCol && r.petugas && r.petugas !== "-") petugasSet.add(r.petugas);
      if (hasStatusCol && r.status && r.status !== "-") statuses.add(r.status);
    }

    return {
      unitOptions: Array.from(units).sort((a, b) => a.localeCompare(b, "id")),
      petugasOptions: Array.from(petugasSet).sort((a, b) => a.localeCompare(b, "id")),
      statusOptions: Array.from(statuses).sort((a, b) => a.localeCompare(b, "id")),
      hasStatusCol
    };
  }, [records, schemas]);

  // Filter & Search records
  const filteredRecords = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return records.filter((rec) => {
      if (selectedUnit && rec.unit !== selectedUnit) return false;
      if (selectedPetugas && rec.petugas !== selectedPetugas) return false;
      if (
        selectedStatus &&
        rec.status.toUpperCase() !== selectedStatus.toUpperCase()
      ) {
        return false;
      }

      if (coordFilter === "valid" && !rec.hasValidCoords) return false;
      if (coordFilter === "missing" && rec.hasValidCoords) return false;

      if (q) {
        const matchCore =
          rec.dil.toLowerCase().includes(q) ||
          rec.id.toLowerCase().includes(q) ||
          rec.nama.toLowerCase().includes(q) ||
          rec.alamat.toLowerCase().includes(q) ||
          rec.koordinatDil.toLowerCase().includes(q) ||
          rec.lokasiSampling.toLowerCase().includes(q) ||
          rec.unit.toLowerCase().includes(q) ||
          rec.petugas.toLowerCase().includes(q) ||
          rec.status.toLowerCase().includes(q) ||
          rec.keterangan.toLowerCase().includes(q) ||
          rec.lokasiJuni.toLowerCase().includes(q) ||
          rec.lokasiJuli.toLowerCase().includes(q) ||
          rec.lokasiAgustus.toLowerCase().includes(q) ||
          rec.lokasiSeptember.toLowerCase().includes(q);

        if (matchCore) return true;

        // Also search across any other dynamic columns
        return Object.values(rec.rawValues).some((v) =>
          v.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    records,
    searchQuery,
    selectedUnit,
    selectedPetugas,
    selectedStatus,
    coordFilter
  ]);

  const selectedRecord = React.useMemo(
    () => records.find((r) => r._rowId === selectedRecordId) || null,
    [records, selectedRecordId]
  );

  // Interaction: Click Row in Table -> Pan/Zoom Map or show missing coordinates notice
  const handleSelectRecordFromTable = React.useCallback(
    (rec: LocationRecord) => {
      setSelectedRecordId(rec._rowId);
      if (!rec.hasValidCoords || rec.latitude === null || rec.longitude === null) {
        showToast("warning", "Data ini belum memiliki koordinat lokasi.");
      }
    },
    [showToast]
  );

  // Interaction: Click Marker in Map -> Highlight & Scroll to Row in Table
  const handleSelectRecordFromMap = React.useCallback((rec: LocationRecord) => {
    setSelectedRecordId(rec._rowId);
  }, []);

  const handleToggleColumn = (normalizedKey: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(normalizedKey)) {
        if (prev.length <= 1) return prev; // Keep at least 1 column visible
        return prev.filter((k) => k !== normalizedKey);
      }
      return [...prev, normalizedKey];
    });
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedUnit("");
    setSelectedPetugas("");
    setSelectedStatus("");
    setCoordFilter("all");
  };

  const handleConfirmCsvImport = async (params: {
    targetSheet: TargetMonthlySheet;
    mode: ImportMode;
    headers: string[];
    recordsToImport: LocationRecord[];
    rawCsvContent: string;
    fileName: string;
    saveToDrive: boolean;
  }) => {
    const { result, updatedPayload } = await importCsvToSpreadsheet({
      config,
      targetSheet: params.targetSheet,
      mode: params.mode,
      incomingHeaders: params.headers,
      incomingRecords: params.recordsToImport,
      existingRecords: records,
      existingHeaders: headers,
      rawCsvContent: params.rawCsvContent,
      fileName: params.fileName,
      saveToDrive: params.saveToDrive
    });

    setRecords(updatedPayload.records);
    setSchemas(updatedPayload.schemas);
    setHeaders(updatedPayload.headers);
    setLastUpdated(updatedPayload.updatedAt);
    setFetchError(null);

    const monthRoleMap: Record<TargetMonthlySheet, CanonicalField[]> = {
      DIL: ["dil", "nama", "alamat", "koordinat_dil"],
      JUNI: ["lokasi_juni", "jarak_dil_juni"],
      JULI: ["lokasi_juli", "jarak_dil_juli", "jarak_juli"],
      AGUSTUS: ["lokasi_agustus", "jarak_dil_agustus", "jarak_agustus"],
      SEPTEMBER: ["lokasi_september", "jarak_dil_september", "jarak_september"],
      OKTOBER: ["lokasi_oktober", "jarak_dil_oktober", "jarak_oktober"],
      NOVEMBER: ["lokasi_november", "jarak_dil_november", "jarak_november"],
      DESEMBER: ["lokasi_desember", "jarak_dil_desember", "jarak_desember"],
      SAMPLING: ["sampling"]
    };

    const targetRoles = monthRoleMap[params.targetSheet] || [];

    setVisibleColumns((prev) => {
      const defaultKeys = updatedPayload.schemas
        .filter((s) => s.isDefaultVisible)
        .map((s) => s.normalizedKey);
      const targetSheetKeys = updatedPayload.schemas
        .filter((s) => s.canonicalRole && targetRoles.includes(s.canonicalRole))
        .map((s) => s.normalizedKey);
      return Array.from(new Set([...defaultKeys, ...prev, ...targetSheetKeys]));
    });

    showToast("success", result.message);
  };

  const handleSaveConfig = (updated: Partial<AppConfig>) => {
    const next = saveConfig(updated);
    setConfig(next);
  };

  const handleResetDefaultConfig = () => {
    const def = resetConfig();
    setConfig(def);
    setIsConfigModalOpen(false);
  };

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-gradient-to-b from-[#f0f6ff] via-[#f5f8fc] to-[#eef4fb] text-slate-900"
    >
      {/* Top Bar */}
      <Header
        onOpenCsvModal={() => setIsCsvModalOpen(true)}
        onRefresh={() => handleLoadSpreadsheet(config, true)}
        onExportCsv={() =>
          exportRecordsToExcel(
            filteredRecords,
            schemas,
            config.SHEET_NAME,
            visibleColumns
          )
        }
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        activeSheetName={config.SHEET_NAME}
        availableSheets={availableSheets}
        onSelectSheet={(sheet) => handleSaveConfig({ SHEET_NAME: sheet })}
        canExport={filteredRecords.length > 0}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-md flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-medium bg-slate-900 text-white border-slate-700"
        >
          {toast.type === "warning" && (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          {toast.type === "success" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          {toast.type === "error" && (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          {toast.type === "info" && (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Statistics Cards */}
      <StatsCards
        allRecords={records}
        filteredRecords={filteredRecords}
        hasStatusColumn={filterOptions.hasStatusCol}
        activeStatusFilter={selectedStatus}
        onSelectStatusFilter={(status) => setSelectedStatus(status)}
      />

      {/* Search & Filter Panel */}
      <FilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unitOptions={filterOptions.unitOptions}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        petugasOptions={filterOptions.petugasOptions}
        selectedPetugas={selectedPetugas}
        onPetugasChange={setSelectedPetugas}
        statusOptions={filterOptions.statusOptions}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        coordFilter={coordFilter}
        onCoordFilterChange={setCoordFilter}
        onResetFilters={handleResetFilters}
        schemas={schemas}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
      />

      {/* Warning or Error Banner if Spreadsheet permission requires setup */}
      {fetchError && records.length === 0 && (
        <div className="mx-4 lg:mx-6 mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">
                Gagal mengambil data dari Spreadsheet.
              </p>
              <p className="text-amber-800 whitespace-pre-line">{fetchError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Konfigurasi Apps Script</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV Sekarang</span>
            </button>
            <button
              type="button"
              onClick={() => handleLoadSpreadsheet(config, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100/70 rounded-lg hover:bg-amber-200/70 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {warningBanner && (
        <div className="mx-4 lg:mx-6 mt-3 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between gap-2">
          <span>{warningBanner}</span>
          <button
            type="button"
            onClick={() => setWarningBanner(null)}
            aria-label="Tutup info"
            className="text-blue-500 hover:text-blue-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace: Table takes full width until a row is clicked; when a row is clicked, Map appears */}
      <main className="flex-1 p-4 lg:px-6 lg:py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-12.5rem)] lg:min-h-[520px]">
        {/* Left / Top: Data Table */}
        <section
          aria-label="Tabel Data Lokasi"
          className={`${
            selectedRecord ? "lg:col-span-7" : "lg:col-span-12"
          } flex flex-col h-[500px] lg:h-full overflow-hidden transition-all`}
        >
          <DataTable
            records={filteredRecords}
            schemas={schemas}
            visibleColumns={visibleColumns}
            activeSheetName={config.SHEET_NAME}
            selectedRecordId={selectedRecordId}
            onSelectRecord={handleSelectRecordFromTable}
            isLoading={isLoading}
            onRefresh={() => handleLoadSpreadsheet(config, true)}
            onOpenCsvModal={() => setIsCsvModalOpen(true)}
            pageSizeOptions={config.PAGE_SIZE_OPTIONS}
            defaultPageSize={config.DEFAULT_PAGE_SIZE}
          />
        </section>

        {/* Right / Bottom: Interactive Leaflet Map (Hanya tampil jika Baris data diklik) */}
        {selectedRecord && (
          <section
            aria-label="Peta Lokasi Interaktif"
            className="lg:col-span-5 flex flex-col h-[440px] lg:h-full overflow-hidden"
          >
            <MapView
              records={filteredRecords}
              selectedRecord={selectedRecord}
              onSelectRecordFromMap={handleSelectRecordFromMap}
              onCloseMap={() => setSelectedRecordId(null)}
              defaultCenter={config.DEFAULT_MAP_CENTER}
              defaultZoom={config.DEFAULT_MAP_ZOOM}
            />
          </section>
        )}
      </main>

      {/* CSV Uploader Modal */}
      <CsvUploader
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onConfirmImport={handleConfirmCsvImport}
        folderId={config.FOLDER_ID}
        spreadsheetId={config.SPREADSHEET_ID}
        sheetName={config.SHEET_NAME}
      />

      {/* Database & Apps Script Configuration Modal */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onResetDefault={handleResetDefaultConfig}
      />
    </div>
  );
}
