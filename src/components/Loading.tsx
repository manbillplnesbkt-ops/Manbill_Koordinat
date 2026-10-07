import React from "react";

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  message = "Memuat data dari Google Spreadsheet..."
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[280px]"
    >
      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-700">{message}</p>
      <p className="text-xs text-slate-500 mt-1">
        Mohon tunggu sebentar, sedang memproses baris dan koordinat lokasi.
      </p>
    </div>
  );
};
