import React from "react";
import { Database, Plus, AlertTriangle, FileText, BarChart3 } from "lucide-react";
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
  filteredRecords
}) => {
  const stats = React.useMemo(() => {
    const total = allRecords.length;
    let withCoords = 0;

    for (const r of allRecords) {
      if (r.hasValidCoords) withCoords++;
    }

    const withoutCoords = total - withCoords;
    const displayed = filteredRecords.length;

    const validPct = total > 0 ? Math.round((withCoords / total) * 100) : 0;
    const missingPct = total > 0 ? Math.round((withoutCoords / total) * 100) : 0;

    return {
      total,
      withCoords,
      withoutCoords,
      displayed,
      validPct,
      missingPct
    };
  }, [allRecords, filteredRecords]);

  const formatNum = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <section
      aria-label="Ringkasan Statistik Data"
      className="relative overflow-hidden px-4 lg:px-6 pt-3.5 pb-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Card 1: Total Data */}
        <div className="lg:col-span-2 sm:col-span-1 bg-white/95 border border-slate-200/80 rounded-xl px-4 py-3 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#1e40af]">Total Data</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                {formatNum(stats.total)}
              </p>
              <Database className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Card 2: Ada Koordinat */}
        <div className="lg:col-span-3 sm:col-span-1 bg-white/95 border border-slate-200/80 rounded-xl px-4 py-3 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#047857]">Ada Koordinat</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                {formatNum(stats.withCoords)}
              </p>
              <span className="px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-md tabular-nums">
                {stats.validPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Tanpa Koordinat */}
        <div className="lg:col-span-2 sm:col-span-1 bg-white/95 border border-slate-200/80 rounded-xl px-4 py-3 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#b45309]">Tanpa Koordinat</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                {formatNum(stats.withoutCoords)}
              </p>
              <span className="px-2 py-0.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md tabular-nums">
                {stats.missingPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Data Ditampilkan */}
        <div className="lg:col-span-2 sm:col-span-1 bg-white/95 border border-slate-200/80 rounded-xl px-4 py-3 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#4338ca]">Data Ditampilkan</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                {formatNum(stats.displayed)}
              </p>
              <BarChart3 className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Right Decorative Map & Mountain Graphic (as shown in reference design) */}
        <div className="hidden lg:flex lg:col-span-3 items-center justify-end relative overflow-hidden rounded-xl pointer-events-none select-none pr-2">
          <svg
            viewBox="0 0 320 95"
            className="w-full h-20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Soft Mountain Background */}
            <path
              d="M140 72 L195 22 L240 58 L275 18 L315 72 Z"
              fill="#dbeafe"
              opacity="0.7"
            />
            <path
              d="M175 72 L225 32 L265 62 L295 34 L320 72 Z"
              fill="#93c5fd"
              opacity="0.55"
            />
            {/* Perspective Map Grid */}
            <polygon
              points="75,78 135,54 275,58 235,86"
              fill="#e0f2fe"
              stroke="#93c5fd"
              strokeWidth="1.5"
            />
            <line
              x1="115"
              y1="62"
              x2="255"
              y2="68"
              stroke="#bae6fd"
              strokeWidth="1.5"
            />
            <line
              x1="155"
              y1="55"
              x2="120"
              y2="80"
              stroke="#bae6fd"
              strokeWidth="1.5"
            />
            <line
              x1="205"
              y1="57"
              x2="175"
              y2="83"
              stroke="#bae6fd"
              strokeWidth="1.5"
            />
            {/* Pin Shadow / Ripple */}
            <ellipse cx="180" cy="69" rx="16" ry="5" fill="#3b82f6" opacity="0.25" />
            <ellipse cx="180" cy="69" rx="8" ry="2.5" fill="#2563eb" opacity="0.5" />
            {/* Blue Location Pin */}
            <path
              d="M180 18C168.954 18 160 26.9543 160 38C160 51.5 180 68 180 68C180 68 200 51.5 200 38C200 26.9543 191.046 18 180 18Z"
              fill="#2563eb"
            />
            <circle cx="180" cy="37" r="7.5" fill="#ffffff" />
          </svg>
        </div>
      </div>
    </section>
  );
};
