import React from "react";
import { RefreshCw, Upload, Download, Database, Calendar, MapPin } from "lucide-react";

interface HeaderProps {
  onOpenCsvModal: () => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onOpenConfigModal: () => void;
  isLoading: boolean;
  lastUpdated: string | null;
  activeSheetName: string;
  availableSheets: string[];
  onSelectSheet: (sheet: string) => void;
  canExport: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCsvModal,
  onRefresh,
  onExportCsv,
  onOpenConfigModal,
  isLoading,
  lastUpdated,
  activeSheetName,
  availableSheets,
  onSelectSheet,
  canExport
}) => {
  const formattedTime = React.useMemo(() => {
    if (!lastUpdated) return null;
    try {
      const date = new Date(lastUpdated);
      const datePart = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(date);
      const timePart = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
        .format(date)
        .replace(":", ".");
      return `${datePart} pukul ${timePart} WIB`;
    } catch {
      return lastUpdated;
    }
  }, [lastUpdated]);

  const uniqueSheets = React.useMemo(
    () =>
      Array.from(
        new Set(availableSheets.map((s) => String(s || "").trim()).filter(Boolean))
      ),
    [availableSheets]
  );

  return (
    <header className="sticky top-0 z-30 relative overflow-hidden flex flex-wrap items-center justify-between px-4 lg:px-6 py-3 bg-gradient-to-r from-white via-[#f8fbff] to-[#eaf2ff] border-b border-blue-100/80 shadow-xs gap-3">
      {/* Decorative subtle mountain/wave silhouette on the right side of header */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 90"
        preserveAspectRatio="none"
        className="pointer-events-none absolute right-0 top-0 h-full w-80 opacity-45 hidden lg:block"
      >
        <path
          d="M120 90 L210 25 L275 68 L335 12 L400 65 L400 90 Z"
          fill="#dbeafe"
        />
        <path
          d="M200 90 L285 35 L350 75 L400 30 L400 90 Z"
          fill="#bfdbfe"
        />
      </svg>

      {/* Left: PLN Logo + Divider + Blue Pin + KOMPARA Title & Subtitle */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="relative z-10 flex items-center gap-3 shrink-0 group"
      >
        {/* PLN Electricity Service Logo matching plnes.png */}
        <div className="flex items-center gap-2.5 pr-3.5 border-r border-slate-200">
          <svg
            viewBox="0 0 100 100"
            className="w-10 h-10 shrink-0"
            aria-label="Logo PLN Electricity Service"
          >
            {/* Yellow square background */}
            <rect x="0" y="0" width="100" height="100" fill="#fff200" />
            {/* 3 Blue wavy lines */}
            <path
              d="M 14 43 Q 23 36, 32 43 T 50 43 T 68 43 T 86 43"
              fill="none"
              stroke="#00a2e9"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            <path
              d="M 14 58 Q 23 51, 32 58 T 50 58 T 68 58 T 86 58"
              fill="none"
              stroke="#00a2e9"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            <path
              d="M 14 73 Q 23 66, 32 73 T 50 73 T 68 73 T 86 73"
              fill="none"
              stroke="#00a2e9"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            {/* Red lightning bolt */}
            <polygon
              points="46,14 62,14 45,51 67,44 42,91 50,56 30,62"
              fill="#ed1c24"
            />
          </svg>
          <div className="flex flex-col justify-center leading-none">
            <span className="text-[22px] font-black tracking-[0.14em] text-[#00a2e9] leading-none">
              PLN
            </span>
            <span className="text-[11px] font-normal tracking-tight text-[#00a2e9] mt-1 whitespace-nowrap">
              Electricity Service
            </span>
          </div>
        </div>

        {/* Blue MapPin + KOMPARA Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <MapPin className="w-4.5 h-4.5 fill-white text-blue-600" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg lg:text-xl font-black tracking-tight text-[#0f2942] group-hover:text-blue-800 transition-colors">
                KOMPARA
              </span>
              <span className="text-slate-400 font-bold">—</span>
              <span className="text-xs lg:text-sm font-bold text-[#1e3a5f]">
                Koordinat Pelanggan Antar Periode
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#2b547e] leading-tight">
              PLN Electricity Services Unit Layanan Bukittinggi
            </span>
          </div>
        </div>
      </a>

      {/* Right: Last Updated + Sheet Selector + Action Buttons */}
      <div className="relative z-10 flex flex-wrap items-center gap-2.5 lg:gap-3">
        {/* Terakhir diperbarui */}
        <div className="hidden xl:flex items-center gap-2 pr-2 text-xs text-slate-600">
          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] text-slate-400 font-medium">
              Terakhir diperbarui:
            </span>
            {isLoading ? (
              <span className="text-xs font-bold text-blue-600">
                Memuat data...
              </span>
            ) : formattedTime ? (
              <span className="text-xs font-bold text-slate-800 tabular-nums">
                {formattedTime}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">
                Belum disinkronkan
              </span>
            )}
          </div>
        </div>

        {/* Sheet Selector */}
        <div className="flex items-center gap-1.5 bg-white/90 border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-2xs">
          <label
            htmlFor="header-sheet-select"
            className="text-[11px] font-semibold text-slate-500"
          >
            Sheet:
          </label>
          {uniqueSheets.length > 1 ? (
            <select
              id="header-sheet-select"
              value={activeSheetName}
              onChange={(e) => onSelectSheet(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {uniqueSheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-slate-800">
              {activeSheetName || "Data"}
            </span>
          )}
        </div>

        {/* Konfigurasi Database */}
        <button
          type="button"
          onClick={onOpenConfigModal}
          title="Konfigurasi Database & Apps Script"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-lg shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Konfigurasi Database</span>
        </button>

        {/* Refresh Data */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh Data"
          title="Ambil data terbaru dari Google Spreadsheet"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-lg shadow-2xs hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-blue-600 ${
              isLoading ? "animate-spin" : ""
            }`}
          />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>

        {/* Export Excel */}
        <button
          type="button"
          onClick={onExportCsv}
          disabled={!canExport}
          aria-label="Export Excel"
          title="Export data yang sedang ditampilkan ke file Excel (.xlsx)"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1f9d6a] border border-[#19875b] rounded-lg shadow-xs hover:bg-[#19875b] disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Excel</span>
        </button>

        {/* Upload CSV */}
        <button
          type="button"
          onClick={onOpenCsvModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#2563eb] border border-[#1d4ed8] rounded-lg shadow-xs hover:bg-[#1d4ed8] transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload CSV</span>
        </button>
      </div>
    </header>
  );
};
