import React from "react";
import { RotateCcw, SlidersHorizontal, Check } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { ColumnSchema } from "../utils/normalizeHeaders";

interface FilterPanelProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  unitOptions: string[];
  selectedUnit: string;
  onUnitChange: (unit: string) => void;
  petugasOptions: string[];
  selectedPetugas: string;
  onPetugasChange: (petugas: string) => void;
  statusOptions: string[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  coordFilter: "all" | "valid" | "missing";
  onCoordFilterChange: (val: "all" | "valid" | "missing") => void;
  onResetFilters: () => void;
  schemas: ColumnSchema[];
  visibleColumns: string[];
  onToggleColumn: (normalizedKey: string) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  searchQuery,
  onSearchChange,
  unitOptions,
  selectedUnit,
  onUnitChange,
  petugasOptions,
  selectedPetugas,
  onPetugasChange,
  statusOptions,
  selectedStatus,
  onStatusChange,
  coordFilter,
  onCoordFilterChange,
  onResetFilters,
  schemas,
  visibleColumns,
  onToggleColumn
}) => {
  const [showColumnMenu, setShowColumnMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(selectedUnit) ||
    Boolean(selectedPetugas) ||
    Boolean(selectedStatus) ||
    coordFilter !== "all";

  return (
    <section
      aria-label="Filter dan Pencarian Data"
      className="bg-white border-b border-slate-200 px-4 lg:px-6 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBar value={searchQuery} onChange={onSearchChange} />

        {/* Filter Unit (hanya tampil jika kolom Unit tersedia dan punya nilai) */}
        {unitOptions.length > 0 && (
          <div className="flex items-center">
            <label htmlFor="filter-unit-select" className="sr-only">
              Filter Unit
            </label>
            <select
              id="filter-unit-select"
              value={selectedUnit}
              onChange={(e) => onUnitChange(e.target.value)}
              className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[160px] truncate cursor-pointer"
            >
              <option value="">Semua Unit ({unitOptions.length})</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Petugas */}
        {petugasOptions.length > 0 && (
          <div className="flex items-center">
            <label htmlFor="filter-petugas-select" className="sr-only">
              Filter Petugas
            </label>
            <select
              id="filter-petugas-select"
              value={selectedPetugas}
              onChange={(e) => onPetugasChange(e.target.value)}
              className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[160px] truncate cursor-pointer"
            >
              <option value="">Semua Petugas ({petugasOptions.length})</option>
              {petugasOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Status */}
        {statusOptions.length > 0 && (
          <div className="flex items-center">
            <label htmlFor="filter-status-select" className="sr-only">
              Filter Status
            </label>
            <select
              id="filter-status-select"
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[165px] truncate cursor-pointer"
            >
              <option value="">Semua Status ({statusOptions.length})</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Ketersediaan Koordinat */}
        <div className="flex items-center">
          <label htmlFor="filter-coord-select" className="sr-only">
            Filter Koordinat
          </label>
          <select
            id="filter-coord-select"
            value={coordFilter}
            onChange={(e) =>
              onCoordFilterChange(e.target.value as "all" | "valid" | "missing")
            }
            className="py-1.5 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="all">Semua Lokasi</option>
            <option value="valid">Ada Koordinat</option>
            <option value="missing">Tanpa Koordinat</option>
          </select>
        </div>

        {/* Tombol Pemilih Kolom */}
        {schemas.length > 0 && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowColumnMenu((prev) => !prev)}
              aria-expanded={showColumnMenu}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Kolom ({visibleColumns.length})</span>
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-40 max-h-72 overflow-y-auto">
                <div className="px-3 py-1 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                  Pilih Kolom Tabel
                </div>
                {schemas.map((col) => {
                  const isChecked = visibleColumns.includes(col.normalizedKey);
                  return (
                    <button
                      key={col.normalizedKey}
                      type="button"
                      onClick={() => onToggleColumn(col.normalizedKey)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="truncate pr-2">{col.label}</span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tombol Reset Filter */}
        <button
          type="button"
          onClick={onResetFilters}
          disabled={!hasActiveFilters}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filter</span>
        </button>
      </div>
    </section>
  );
};
