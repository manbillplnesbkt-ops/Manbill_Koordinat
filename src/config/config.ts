export interface AppConfig {
  FOLDER_ID: string;
  SPREADSHEET_ID: string;
  SHEET_NAME: string;
  GAS_WEB_APP_URL: string;
  DEFAULT_COLUMNS: string[];
  PAGE_SIZE_OPTIONS: number[];
  DEFAULT_PAGE_SIZE: number;
  DEFAULT_MAP_CENTER: [number, number];
  DEFAULT_MAP_ZOOM: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  FOLDER_ID: "1fqDHeipSFj2nTrKQc8GAo9LMYDjRpqjh",
  SPREADSHEET_ID: "1xpNaKG7JQyh1XD-4TvB8Ef72cGl0bJVsn85wdoeWO5E",
  SHEET_NAME: "Data",
  GAS_WEB_APP_URL: "",
  DEFAULT_COLUMNS: [
    "dil",
    "nama",
    "alamat",
    "koordinat_dil",
    "lokasi_juni",
    "lokasi_juli",
    "lokasi_agustus",
    "lokasi_september",
    "jarak_dil_juni",
    "jarak_dil_juli",
    "jarak_dil_agustus",
    "jarak_dil_september",
    "jarak_juli",
    "jarak_agustus",
    "jarak_september"
  ],
  PAGE_SIZE_OPTIONS: [15, 25, 50, 100],
  DEFAULT_PAGE_SIZE: 25,
  // Default center: Sumatera Barat / Bukittinggi area, fallback for Indonesia
  DEFAULT_MAP_CENTER: [-0.3055, 100.3692],
  DEFAULT_MAP_ZOOM: 12,
};

const STORAGE_KEY = "geosheet_monitor_config_v2";

export function loadConfig(): AppConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn("Gagal memuat konfigurasi lokal:", err);
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(partial: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const updated = { ...current, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Gagal menyimpan konfigurasi lokal:", err);
  }
  return updated;
}

export function resetConfig(): AppConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Gagal mereset konfigurasi:", err);
  }
  return DEFAULT_CONFIG;
}
