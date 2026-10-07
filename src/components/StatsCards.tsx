import React from "react";
import { LocationRecord } from "../utils/validation";

interface StatsCardsProps {
  allRecords: LocationRecord[];
  filteredRecords: LocationRecord[];
  hasStatusColumn: boolean;
  activeStatusFilter: string;
  onSelectStatusFilter: (status: string) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  allRecords,
  filteredRecords,
  hasStatusColumn,
  activeStatusFilter,
  onSelectStatusFilter
}) => {
  const stats = React.useMemo(() => {
    const total = allRecords.length;
    let withCoords = 0;
    const statusMap = new Map<string, number>();

    for (const r of allRecords) {
      if (r.hasValidCoords) withCoords++;
      if (hasStatusColumn && r.status && r.status !== "-") {
        const key = r.status.trim().toUpperCase();
        statusMap.set(key, (statusMap.get(key) || 0) + 1);
      }
    }

    const withoutCoords = total - withCoords;
    const displayed = filteredRecords.length;

    // Top 2 status values to keep the dashboard clean & uncluttered
    const topStatuses = Array.from(statusMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    return {
      total,
      withCoords,
      withoutCoords,
      displayed,
      topStatuses
    };
  }, [allRecords, filteredRecords, hasStatusColumn]);

  const formatNum = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <section
      aria-label="Ringkasan Statistik Data"
      className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Card 1: TOTAL DATA */}
        <div className="border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-50/50">
          <p className="text-[11px] font-medium text-slate-500">Total Data</p>
          <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {formatNum(stats.total)}
          </p>
        </div>

        {/* Card 2: ADA KOORDINAT */}
        <div className="border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-50/50">
          <p className="text-[11px] font-medium text-slate-500">Ada Koordinat</p>
          <div className="flex items-baseline justify-between mt-0.5">
            <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
              {formatNum(stats.withCoords)}
            </p>
            {stats.total > 0 && (
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {Math.round((stats.withCoords / stats.total) * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Card 3: TANPA KOORDINAT */}
        <div className="border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-50/50">
          <p className="text-[11px] font-medium text-slate-500">Tanpa Koordinat</p>
          <div className="flex items-baseline justify-between mt-0.5">
            <p className="text-lg font-bold text-amber-700 font-mono tabular-nums">
              {formatNum(stats.withoutCoords)}
            </p>
            {stats.total > 0 && (
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {Math.round((stats.withoutCoords / stats.total) * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Card 4: DATA DITAMPILKAN */}
        <div className="border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-50/50">
          <p className="text-[11px] font-medium text-slate-500">Data Ditampilkan</p>
          <p className="text-lg font-bold text-blue-700 font-mono tabular-nums mt-0.5">
            {formatNum(stats.displayed)}
          </p>
        </div>

        {/* Dynamic Status Summary Cards (up to 2) */}
        {stats.topStatuses.map(([statusLabel, count]) => {
          const isSelected = activeStatusFilter.toUpperCase() === statusLabel;
          return (
            <button
              key={statusLabel}
              type="button"
              onClick={() =>
                onSelectStatusFilter(isSelected ? "" : statusLabel)
              }
              title={`Filter berdasarkan status: ${statusLabel}`}
              className={`text-left border rounded-lg px-3.5 py-2.5 transition-colors cursor-pointer ${
                isSelected
                  ? "border-blue-600 bg-blue-50/60"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70"
              }`}
            >
              <p className="text-[11px] font-medium text-slate-500 truncate">
                Status: {statusLabel}
              </p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {formatNum(count)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
};
