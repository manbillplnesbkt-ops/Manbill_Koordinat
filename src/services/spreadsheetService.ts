import Papa from "papaparse";
import { AppConfig } from "../config/config";
import {
  buildColumnSchemas,
  ColumnSchema,
  TargetMonthlySheet,
  TARGET_MONTHLY_SHEETS
} from "../utils/normalizeHeaders";
import {
  normalizeRowToRecord,
  LocationRecord,
  MonthlyCoord,
  buildSheetLocationLookupFromMatrix,
  parseCombinedLocationString,
  isColumnIndexSubheaderRow
} from "../utils/validation";
import {
  calculateDistanceMeters,
  formatDistanceMeters,
  parseAndValidateCoordinates
} from "../utils/coordinateUtils";
import { parseRawCsvString } from "./csvService";

export type ImportMode = "append" | "update" | "replace";

export interface SpreadsheetDataPayload {
  records: LocationRecord[];
  schemas: ColumnSchema[];
  headers: string[];
  sheetName: string;
  availableSheets: string[];
  updatedAt: string;
  sourceType: "gas_api" | "gviz_direct" | "local_cache";
  warningMessage?: string;
}

export interface ImportResultPayload {
  success: boolean;
  mode: ImportMode;
  targetSheet: string;
  insertedCount: number;
  updatedCount: number;
  totalRows: number;
  syncedToRemote: boolean;
  driveFile?: {
    fileId?: string;
    fileName?: string;
    fileUrl?: string;
    error?: string;
  } | null;
  message: string;
}

const LOCAL_DATA_CACHE_KEY = "geosheet_monitor_cached_dataset_v10";
const LOCAL_MONTHLY_OVERRIDES_KEY = "geosheet_monthly_sheet_overrides_v1";

// Clean up older localStorage cache keys
try {
  if (typeof window !== "undefined" && window.localStorage) {
    Object.keys(window.localStorage).forEach((k) => {
      if (
        k.startsWith("geosheet_monitor_cached_dataset_") &&
        !k.startsWith(LOCAL_DATA_CACHE_KEY)
      ) {
        window.localStorage.removeItem(k);
      }
    });
  }
} catch {
  // ignore
}

interface DilMasterInfo {
  dil: string;
  nama: string;
  alamat: string;
  koordinatDil: string;
}

type MonthlyLookupsBySheet = Record<TargetMonthlySheet, Map<string, string>>;

function loadLocalMonthlyOverrides(
  spreadsheetId: string
): Partial<Record<TargetMonthlySheet, Record<string, string>>> {
  try {
    const raw = localStorage.getItem(`${LOCAL_MONTHLY_OVERRIDES_KEY}_${spreadsheetId}`);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLocalMonthlyOverrides(
  spreadsheetId: string,
  overrides: Partial<Record<TargetMonthlySheet, Record<string, string>>>
): void {
  try {
    localStorage.setItem(
      `${LOCAL_MONTHLY_OVERRIDES_KEY}_${spreadsheetId}`,
      JSON.stringify(overrides)
    );
  } catch {
    // ignore
  }
}

/**
 * Fetches Sheet DIL to get unmasked NAMA, ALAMAT, DIL ID, and Koordinat DIL
 * from Column 7 (index 6 = LATITUDE) and Column 8 (index 7 = LONGITUDE) keyed by DIL / IDPEL.
 */
async function fetchDilMasterLookupGviz(
  spreadsheetId: string
): Promise<Map<string, DilMasterInfo>> {
  const map = new Map<string, DilMasterInfo>();
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId.trim()
    )}/gviz/tq?tqx=out:csv&sheet=DIL`;

    const response = await fetch(gvizUrl, {
      method: "GET",
      credentials: "omit"
    });
    if (!response.ok) return map;

    const text = await response.text();
    if (text.trim().startsWith("<")) return map;

    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: "greedy"
    });
    const rows = parsed.data || [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      if (isColumnIndexSubheaderRow(row)) continue;

      const dilId = String(row[0] ?? "").trim();
      if (!dilId) continue;

      // Ambil Kolom ke-7 (index 6 = LATITUDE) dan Kolom ke-8 (index 7 = LONGITUDE) dari Sheet DIL
      let koordinatDil = "";
      if (row.length >= 8) {
        const rawCol7Lat = String(row[6] ?? "").trim();
        const rawCol8Lng = String(row[7] ?? "").trim();
        if (rawCol7Lat !== "" || rawCol8Lng !== "") {
          const cleanLatStr = rawCol7Lat.replace(/,/g, ".").replace(/\s+/g, "");
          const cleanLngStr = rawCol8Lng.replace(/,/g, ".").replace(/\s+/g, "");
          const coordCheck = parseAndValidateCoordinates(cleanLatStr, cleanLngStr);
          if (coordCheck.isValid && coordCheck.lat !== null && coordCheck.lng !== null) {
            koordinatDil = `${cleanLatStr}, ${cleanLngStr}`;
          }
        }
      }

      map.set(dilId.toLowerCase(), {
        dil: dilId,
        nama: String(row[1] ?? "").trim(),
        alamat: String(row[2] ?? "").trim(),
        koordinatDil
      });
    }
    return map;
  } catch {
    return map;
  }
}

/**
 * Fetches a monthly sheet (JUNI..DESEMBER) via direct Google Spreadsheet gviz CSV
 * and extracts the combined coordinate from Column 3 (Latitude) and Column 4 (Longitude)
 * keyed by DIL / IDPEL.
 */
async function fetchSheetLocationLookupGviz(
  spreadsheetId: string,
  sheetName: string
): Promise<Map<string, string>> {
  try {
    const encodedSheet = encodeURIComponent(sheetName);
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId.trim()
    )}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;

    const response = await fetch(gvizUrl, {
      method: "GET",
      credentials: "omit"
    });
    if (!response.ok) return new Map();

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (
      contentType.includes("text/html") ||
      text.trim().startsWith("<!DOCTYPE html") ||
      text.trim().startsWith("<html")
    ) {
      return new Map();
    }

    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: "greedy"
    });

    return buildSheetLocationLookupFromMatrix(parsed.data || []);
  } catch {
    return new Map();
  }
}

/**
 * Enriches LocationRecords with Koordinat DIL, Lokasi JUNI..DESEMBER,
 * JARAK DENGAN DIL (JUNI..DESEMBER), and JARAK ANTAR BULAN.
 */
function enrichRecordsWithMonthlyLocations(
  records: LocationRecord[],
  schemas: ColumnSchema[],
  monthlyLookups: MonthlyLookupsBySheet,
  dilLookup?: Map<string, DilMasterInfo>
): LocationRecord[] {
  const findSchemaByRole = (role: ColumnSchema["canonicalRole"]) =>
    schemas.find((s) => s.canonicalRole === role);

  const dilSchema = findSchemaByRole("dil");
  const namaSchema = findSchemaByRole("nama");
  const alamatSchema = findSchemaByRole("alamat");
  const koordinatDilSchema = findSchemaByRole("koordinat_dil");

  const juniSchema = findSchemaByRole("lokasi_juni");
  const juliSchema = findSchemaByRole("lokasi_juli");
  const agustusSchema = findSchemaByRole("lokasi_agustus");
  const septemberSchema = findSchemaByRole("lokasi_september");
  const oktoberSchema = findSchemaByRole("lokasi_oktober");
  const novemberSchema = findSchemaByRole("lokasi_november");
  const desemberSchema = findSchemaByRole("lokasi_desember");

  const jarakDilJuniSchema = findSchemaByRole("jarak_dil_juni");
  const jarakDilJuliSchema = findSchemaByRole("jarak_dil_juli");
  const jarakDilAgustusSchema = findSchemaByRole("jarak_dil_agustus");
  const jarakDilSeptemberSchema = findSchemaByRole("jarak_dil_september");
  const jarakDilOktoberSchema = findSchemaByRole("jarak_dil_oktober");
  const jarakDilNovemberSchema = findSchemaByRole("jarak_dil_november");
  const jarakDilDesemberSchema = findSchemaByRole("jarak_dil_desember");

  const jarakJuliSchema = findSchemaByRole("jarak_juli");
  const jarakAgustusSchema = findSchemaByRole("jarak_agustus");
  const jarakSeptemberSchema = findSchemaByRole("jarak_september");
  const jarakOktoberSchema = findSchemaByRole("jarak_oktober");
  const jarakNovemberSchema = findSchemaByRole("jarak_november");
  const jarakDesemberSchema = findSchemaByRole("jarak_desember");

  return records.map((rec) => {
    const updatedRaw = { ...rec.rawValues };

    const candidateKeys = [
      rec.id !== "-" ? rec.id.trim().toLowerCase() : "",
      rec.dil !== "-" ? rec.dil.trim().toLowerCase() : "",
      updatedRaw["IDPEL"] ? updatedRaw["IDPEL"].trim().toLowerCase() : "",
      updatedRaw["DIL"] ? updatedRaw["DIL"].trim().toLowerCase() : ""
    ].filter((k) => Boolean(k) && !k.includes(","));

    let matchedDilInfo: DilMasterInfo | undefined;
    if (dilLookup && dilLookup.size > 0) {
      for (const k of candidateKeys) {
        if (dilLookup.has(k)) {
          matchedDilInfo = dilLookup.get(k);
          break;
        }
      }
    }

    const dilVal =
      matchedDilInfo?.dil ||
      (rec.id && rec.id !== "-" ? rec.id : "") ||
      (rec.dil && rec.dil !== "-" ? rec.dil : "");

    if (dilSchema && dilVal) {
      updatedRaw[dilSchema.originalHeader] = dilVal;
    }

    let finalNama = rec.nama;
    if (matchedDilInfo?.nama && (finalNama.includes("*") || finalNama === "-")) {
      finalNama = matchedDilInfo.nama;
      if (namaSchema) updatedRaw[namaSchema.originalHeader] = finalNama;
    }

    let finalAlamat = rec.alamat;
    if (matchedDilInfo?.alamat && (finalAlamat.includes("*") || finalAlamat === "-")) {
      finalAlamat = matchedDilInfo.alamat;
      if (alamatSchema) updatedRaw[alamatSchema.originalHeader] = finalAlamat;
    }

    let finalKoordinatDil =
      matchedDilInfo?.koordinatDil ||
      (rec.koordinatDil && rec.koordinatDil !== "-" ? rec.koordinatDil : "");

    const pDil = parseCombinedLocationString(finalKoordinatDil);
    const coordDil: MonthlyCoord | null =
      pDil.isValid && pDil.lat !== null && pDil.lng !== null
        ? { lat: pDil.lat, lng: pDil.lng }
        : rec.coordDil;

    if (!finalKoordinatDil && coordDil) {
      finalKoordinatDil = `${coordDil.lat}, ${coordDil.lng}`;
    }

    if (koordinatDilSchema) {
      updatedRaw[koordinatDilSchema.originalHeader] = finalKoordinatDil || "-";
    }
    updatedRaw["Koordinat DIL"] = finalKoordinatDil || "-";

    const keysToTry = Array.from(
      new Set([
        ...candidateKeys,
        dilVal ? dilVal.trim().toLowerCase() : ""
      ].filter(Boolean))
    );

    let locJuni = rec.lokasiJuni !== "-" ? rec.lokasiJuni : "";
    let locJuli = rec.lokasiJuli !== "-" ? rec.lokasiJuli : "";
    let locAgustus = rec.lokasiAgustus !== "-" ? rec.lokasiAgustus : "";
    let locSeptember = rec.lokasiSeptember !== "-" ? rec.lokasiSeptember : "";
    let locOktober = rec.lokasiOktober !== "-" ? rec.lokasiOktober : "";
    let locNovember = rec.lokasiNovember !== "-" ? rec.lokasiNovember : "";
    let locDesember = rec.lokasiDesember !== "-" ? rec.lokasiDesember : "";

    for (const k of keysToTry) {
      if (monthlyLookups.JUNI.has(k)) locJuni = monthlyLookups.JUNI.get(k)!;
      if (monthlyLookups.JULI.has(k)) locJuli = monthlyLookups.JULI.get(k)!;
      if (monthlyLookups.AGUSTUS.has(k)) locAgustus = monthlyLookups.AGUSTUS.get(k)!;
      if (monthlyLookups.SEPTEMBER.has(k)) locSeptember = monthlyLookups.SEPTEMBER.get(k)!;
      if (monthlyLookups.OKTOBER.has(k)) locOktober = monthlyLookups.OKTOBER.get(k)!;
      if (monthlyLookups.NOVEMBER.has(k)) locNovember = monthlyLookups.NOVEMBER.get(k)!;
      if (monthlyLookups.DESEMBER.has(k)) locDesember = monthlyLookups.DESEMBER.get(k)!;
    }

    if (juniSchema) updatedRaw[juniSchema.originalHeader] = locJuni || "-";
    if (juliSchema) updatedRaw[juliSchema.originalHeader] = locJuli || "-";
    if (agustusSchema) updatedRaw[agustusSchema.originalHeader] = locAgustus || "-";
    if (septemberSchema) updatedRaw[septemberSchema.originalHeader] = locSeptember || "-";
    if (oktoberSchema) updatedRaw[oktoberSchema.originalHeader] = locOktober || "-";
    if (novemberSchema) updatedRaw[novemberSchema.originalHeader] = locNovember || "-";
    if (desemberSchema) updatedRaw[desemberSchema.originalHeader] = locDesember || "-";

    const toCoord = (str: string, fallback: MonthlyCoord | null): MonthlyCoord | null => {
      const p = parseCombinedLocationString(str);
      return p.isValid && p.lat !== null && p.lng !== null
        ? { lat: p.lat, lng: p.lng }
        : fallback;
    };

    const coordJuni = toCoord(locJuni, rec.coordJuni);
    const coordJuli = toCoord(locJuli, rec.coordJuli);
    const coordAgustus = toCoord(locAgustus, rec.coordAgustus);
    const coordSeptember = toCoord(locSeptember, rec.coordSeptember);
    const coordOktober = toCoord(locOktober, rec.coordOktober);
    const coordNovember = toCoord(locNovember, rec.coordNovember);
    const coordDesember = toCoord(locDesember, rec.coordDesember);

    const calcDist = (c1: MonthlyCoord | null, c2: MonthlyCoord | null) => {
      const meters = c1 && c2 ? calculateDistanceMeters(c1.lat, c1.lng, c2.lat, c2.lng) : null;
      return { meters, text: formatDistanceMeters(meters) };
    };

    // 1. JARAK DENGAN DIL
    const dDilJuni = calcDist(coordDil, coordJuni);
    const dDilJuli = calcDist(coordDil, coordJuli);
    const dDilAgustus = calcDist(coordDil, coordAgustus);
    const dDilSeptember = calcDist(coordDil, coordSeptember);
    const dDilOktober = calcDist(coordDil, coordOktober);
    const dDilNovember = calcDist(coordDil, coordNovember);
    const dDilDesember = calcDist(coordDil, coordDesember);

    if (jarakDilJuniSchema) updatedRaw[jarakDilJuniSchema.originalHeader] = dDilJuni.text;
    if (jarakDilJuliSchema) updatedRaw[jarakDilJuliSchema.originalHeader] = dDilJuli.text;
    if (jarakDilAgustusSchema) updatedRaw[jarakDilAgustusSchema.originalHeader] = dDilAgustus.text;
    if (jarakDilSeptemberSchema) updatedRaw[jarakDilSeptemberSchema.originalHeader] = dDilSeptember.text;
    if (jarakDilOktoberSchema) updatedRaw[jarakDilOktoberSchema.originalHeader] = dDilOktober.text;
    if (jarakDilNovemberSchema) updatedRaw[jarakDilNovemberSchema.originalHeader] = dDilNovember.text;
    if (jarakDilDesemberSchema) updatedRaw[jarakDilDesemberSchema.originalHeader] = dDilDesember.text;

    // 2. JARAK ANTAR BULAN
    const dJuniJuli = calcDist(coordJuni, coordJuli);
    const dJuliAgustus = calcDist(coordJuli, coordAgustus);
    const dAgustusSeptember = calcDist(coordAgustus, coordSeptember);
    const dSeptemberOktober = calcDist(coordSeptember, coordOktober);
    const dOktoberNovember = calcDist(coordOktober, coordNovember);
    const dNovemberDesember = calcDist(coordNovember, coordDesember);

    if (jarakJuliSchema) updatedRaw[jarakJuliSchema.originalHeader] = dJuniJuli.text;
    if (jarakAgustusSchema) updatedRaw[jarakAgustusSchema.originalHeader] = dJuliAgustus.text;
    if (jarakSeptemberSchema) updatedRaw[jarakSeptemberSchema.originalHeader] = dAgustusSeptember.text;
    if (jarakOktoberSchema) updatedRaw[jarakOktoberSchema.originalHeader] = dSeptemberOktober.text;
    if (jarakNovemberSchema) updatedRaw[jarakNovemberSchema.originalHeader] = dOktoberNovember.text;
    if (jarakDesemberSchema) updatedRaw[jarakDesemberSchema.originalHeader] = dNovemberDesember.text;

    let latitude = rec.latitude;
    let longitude = rec.longitude;
    let hasValidCoords = rec.hasValidCoords;

    const fallbackMonthly =
      coordDil ||
      coordDesember ||
      coordNovember ||
      coordOktober ||
      coordSeptember ||
      coordAgustus ||
      coordJuli ||
      coordJuni;
    if (!hasValidCoords && fallbackMonthly) {
      latitude = fallbackMonthly.lat;
      longitude = fallbackMonthly.lng;
      hasValidCoords = true;
    }

    return {
      ...rec,
      dil: dilVal || "-",
      nama: finalNama || "-",
      alamat: finalAlamat || "-",
      koordinatDil: finalKoordinatDil || "-",
      lokasiJuni: locJuni || "-",
      lokasiJuli: locJuli || "-",
      lokasiAgustus: locAgustus || "-",
      lokasiSeptember: locSeptember || "-",
      lokasiOktober: locOktober || "-",
      lokasiNovember: locNovember || "-",
      lokasiDesember: locDesember || "-",
      jarakDilJuni: dDilJuni.text,
      jarakDilJuniMeters: dDilJuni.meters,
      jarakDilJuli: dDilJuli.text,
      jarakDilJuliMeters: dDilJuli.meters,
      jarakDilAgustus: dDilAgustus.text,
      jarakDilAgustusMeters: dDilAgustus.meters,
      jarakDilSeptember: dDilSeptember.text,
      jarakDilSeptemberMeters: dDilSeptember.meters,
      jarakDilOktober: dDilOktober.text,
      jarakDilOktoberMeters: dDilOktober.meters,
      jarakDilNovember: dDilNovember.text,
      jarakDilNovemberMeters: dDilNovember.meters,
      jarakDilDesember: dDilDesember.text,
      jarakDilDesemberMeters: dDilDesember.meters,
      jarakJuli: dJuniJuli.text,
      jarakJuliMeters: dJuniJuli.meters,
      jarakAgustus: dJuliAgustus.text,
      jarakAgustusMeters: dJuliAgustus.meters,
      jarakSeptember: dAgustusSeptember.text,
      jarakSeptemberMeters: dAgustusSeptember.meters,
      jarakOktober: dSeptemberOktober.text,
      jarakOktoberMeters: dSeptemberOktober.meters,
      jarakNovember: dOktoberNovember.text,
      jarakNovemberMeters: dOktoberNovember.meters,
      jarakDesember: dNovemberDesember.text,
      jarakDesemberMeters: dNovemberDesember.meters,
      coordDil,
      coordJuni,
      coordJuli,
      coordAgustus,
      coordSeptember,
      coordOktober,
      coordNovember,
      coordDesember,
      latitude,
      longitude,
      hasValidCoords,
      rawValues: updatedRaw
    };
  });
}

function mergeLocalOverridesIntoLookups(
  spreadsheetId: string,
  lookups: MonthlyLookupsBySheet
): MonthlyLookupsBySheet {
  const localOverrides = loadLocalMonthlyOverrides(spreadsheetId);
  for (const sheet of TARGET_MONTHLY_SHEETS) {
    const sheetOverride = localOverrides[sheet];
    if (sheetOverride) {
      const targetMap = lookups[sheet];
      Object.entries(sheetOverride).forEach(([k, v]) => {
        if (k && v) {
          targetMap.set(k.toLowerCase(), v);
        }
      });
    }
  }
  return lookups;
}

/**
 * Fetches data from Google Spreadsheet.
 * Automatically reads Column 3 (Latitude) & Column 4 (Longitude) from Sheet JUNI..DESEMBER
 * and Column 7 & 8 from Sheet DIL, matching them by DIL / IDPEL.
 */
export async function fetchSpreadsheetData(
  config: AppConfig
): Promise<SpreadsheetDataPayload> {
  const { SPREADSHEET_ID, SHEET_NAME, GAS_WEB_APP_URL } = config;

  if (!SPREADSHEET_ID.trim()) {
    throw new Error("Spreadsheet ID belum dikonfigurasi.");
  }

  // 1. Try Google Apps Script Web App if configured
  if (GAS_WEB_APP_URL && GAS_WEB_APP_URL.trim().startsWith("https://script.google.com")) {
    try {
      const url = new URL(GAS_WEB_APP_URL.trim());
      url.searchParams.set("spreadsheetId", SPREADSHEET_ID.trim());
      if (SHEET_NAME.trim()) {
        url.searchParams.set("sheetName", SHEET_NAME.trim());
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Respons Apps Script gagal.");
      }

      const rawHeaders: string[] = json.headers || [];
      const rawRows: Record<string, unknown>[] = json.rows || [];
      const schemas = buildColumnSchemas(rawHeaders);
      const baseRecords: LocationRecord[] = rawRows.map((row, idx) => {
        return normalizeRowToRecord(row, schemas, idx).record;
      });

      const monthlyLookups: MonthlyLookupsBySheet = {
        JUNI: new Map<string, string>(Object.entries(json.monthlyLocations?.JUNI || {})),
        JULI: new Map<string, string>(Object.entries(json.monthlyLocations?.JULI || {})),
        AGUSTUS: new Map<string, string>(Object.entries(json.monthlyLocations?.AGUSTUS || {})),
        SEPTEMBER: new Map<string, string>(Object.entries(json.monthlyLocations?.SEPTEMBER || {})),
        OKTOBER: new Map<string, string>(Object.entries(json.monthlyLocations?.OKTOBER || {})),
        NOVEMBER: new Map<string, string>(Object.entries(json.monthlyLocations?.NOVEMBER || {})),
        DESEMBER: new Map<string, string>(Object.entries(json.monthlyLocations?.DESEMBER || {}))
      };

      mergeLocalOverridesIntoLookups(SPREADSHEET_ID, monthlyLookups);

      let dilLookup = new Map<string, DilMasterInfo>();
      if (json.dilMaster && typeof json.dilMaster === "object") {
        Object.entries(json.dilMaster).forEach(([k, v]: [string, any]) => {
          dilLookup.set(k.toLowerCase(), {
            dil: String(v?.dil || k),
            nama: String(v?.nama || ""),
            alamat: String(v?.alamat || ""),
            koordinatDil: String(v?.koordinatDil || "")
          });
        });
      } else {
        dilLookup = await fetchDilMasterLookupGviz(SPREADSHEET_ID);
      }

      const enrichedRecords = enrichRecordsWithMonthlyLocations(
        baseRecords,
        schemas,
        monthlyLookups,
        dilLookup
      );

      const payload: SpreadsheetDataPayload = {
        records: enrichedRecords,
        schemas,
        headers: schemas.map((s) => s.originalHeader),
        sheetName: json.sheetName || SHEET_NAME || "Data",
        availableSheets:
          json.availableSheets || [
            json.sheetName || SHEET_NAME || "Data",
            "DIL",
            ...TARGET_MONTHLY_SHEETS
          ],
        updatedAt: json.updatedAt || new Date().toISOString(),
        sourceType: "gas_api"
      };

      saveLocalDatasetCache(SPREADSHEET_ID, payload);
      return payload;
    } catch (gasErr: any) {
      console.warn("Gagal mengambil melalui GAS Web App, mencoba gviz langsung:", gasErr);
    }
  }

  // 2. Direct Google Spreadsheet connection (fetches main Sheet + Sheet JUNI..DESEMBER + DIL in parallel)
  try {
    const encodedSheet = encodeURIComponent(SHEET_NAME.trim() || "Data");
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      SPREADSHEET_ID.trim()
    )}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;

    const [
      mainResponse,
      juniLookup,
      juliLookup,
      agustusLookup,
      septemberLookup,
      oktoberLookup,
      novemberLookup,
      desemberLookup,
      dilLookup
    ] = await Promise.all([
      fetch(gvizUrl, { method: "GET", credentials: "omit" }),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "JUNI"),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "JULI"),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "AGUSTUS"),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "SEPTEMBER"),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "OKTOBER"),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "NOVEMBER"),
      fetchSheetLocationLookupGviz(SPREADSHEET_ID, "DESEMBER"),
      fetchDilMasterLookupGviz(SPREADSHEET_ID)
    ]);

    if (!mainResponse.ok) {
      throw new Error(`HTTP ${mainResponse.status}`);
    }

    const contentType = mainResponse.headers.get("content-type") || "";
    const text = await mainResponse.text();

    if (
      contentType.includes("text/html") ||
      text.trim().startsWith("<!DOCTYPE html") ||
      text.trim().startsWith("<html")
    ) {
      throw new Error("PERMISSION_RESTRICTED");
    }

    const parsed = parseRawCsvString(text, `${SHEET_NAME || "Data"}.csv`);
    const monthlyLookups: MonthlyLookupsBySheet = {
      JUNI: juniLookup,
      JULI: juliLookup,
      AGUSTUS: agustusLookup,
      SEPTEMBER: septemberLookup,
      OKTOBER: oktoberLookup,
      NOVEMBER: novemberLookup,
      DESEMBER: desemberLookup
    };

    mergeLocalOverridesIntoLookups(SPREADSHEET_ID, monthlyLookups);

    const enrichedRecords = enrichRecordsWithMonthlyLocations(
      parsed.allRecords,
      parsed.schemas,
      monthlyLookups,
      dilLookup
    );

    const payload: SpreadsheetDataPayload = {
      records: enrichedRecords,
      schemas: parsed.schemas,
      headers: parsed.schemas.map((s) => s.originalHeader),
      sheetName: SHEET_NAME || "Data",
      availableSheets: Array.from(
        new Set([SHEET_NAME || "Data", "DIL", ...TARGET_MONTHLY_SHEETS])
      ),
      updatedAt: new Date().toISOString(),
      sourceType: "gviz_direct"
    };

    saveLocalDatasetCache(SPREADSHEET_ID, payload);
    return payload;
  } catch (directErr: any) {
    console.warn("Direct gviz fetch notice:", directErr);

    const cached = loadLocalDatasetCache(SPREADSHEET_ID);
    if (cached) {
      return {
        ...cached,
        sourceType: "local_cache",
        warningMessage:
          "Menggunakan salinan data lokal. Hubungkan URL Google Apps Script Web App atau buka akses lihat Spreadsheet untuk sinkronisasi langsung."
      };
    }

    throw new Error(
      `Gagal mengambil data dari Spreadsheet (${SPREADSHEET_ID}).\n\nPeriksa:\n- Spreadsheet ID & Nama Sheet ("${SHEET_NAME}", "JUNI" s/d "DESEMBER")\n- URL Google Apps Script Web App pada menu Konfigurasi\n- Permission Spreadsheet (Pastikan sudah pasang Google Apps Script atau "Anyone with the link can view")`
    );
  }
}

/**
 * Extracts coordinate string ("lat, lng") from an incoming CSV record.
 */
function extractRecordCoordString(rec: LocationRecord): string {
  if (rec.latitude !== null && rec.longitude !== null && rec.hasValidCoords) {
    return `${rec.latitude}, ${rec.longitude}`;
  }
  if (rec.koordinatDil && rec.koordinatDil !== "-") return rec.koordinatDil;
  if (rec.lokasiSeptember && rec.lokasiSeptember !== "-") return rec.lokasiSeptember;
  if (rec.lokasiAgustus && rec.lokasiAgustus !== "-") return rec.lokasiAgustus;
  if (rec.lokasiJuli && rec.lokasiJuli !== "-") return rec.lokasiJuli;
  if (rec.lokasiJuni && rec.lokasiJuni !== "-") return rec.lokasiJuni;
  return "";
}

/**
 * Imports validated CSV records into the selected target Sheet (JUNI, JULI, AGUSTUS, SEPTEMBER, OKTOBER, NOVEMBER, DESEMBER),
 * updating both the monthly sheet in Google Spreadsheet (via GAS Web App) and the in-app dataset state & distances immediately.
 */
export async function importCsvToSpreadsheet(params: {
  config: AppConfig;
  targetSheet: TargetMonthlySheet;
  mode: ImportMode;
  incomingHeaders: string[];
  incomingRecords: LocationRecord[];
  existingRecords: LocationRecord[];
  existingHeaders: string[];
  rawCsvContent: string;
  fileName: string;
  saveToDrive: boolean;
}): Promise<{
  result: ImportResultPayload;
  updatedPayload: SpreadsheetDataPayload;
}> {
  const {
    config,
    targetSheet,
    mode,
    incomingHeaders,
    incomingRecords,
    existingRecords,
    existingHeaders,
    rawCsvContent,
    fileName,
    saveToDrive
  } = params;

  const upperTarget = targetSheet.toUpperCase() as TargetMonthlySheet;

  // 1. Extract DIL/IDPEL -> "lat, lng" map from the uploaded CSV
  const incomingCoordMap = new Map<string, string>();
  const parsedMatrix = Papa.parse<string[]>(rawCsvContent, {
    header: false,
    skipEmptyLines: "greedy"
  });
  const matrixLookup = buildSheetLocationLookupFromMatrix(parsedMatrix.data || []);
  matrixLookup.forEach((v, k) => incomingCoordMap.set(k, v));

  incomingRecords.forEach((rec) => {
    const key =
      rec.id && rec.id !== "-"
        ? rec.id.trim().toLowerCase()
        : rec.dil && rec.dil !== "-"
        ? rec.dil.trim().toLowerCase()
        : "";
    const coordStr = extractRecordCoordString(rec);
    if (key && coordStr) {
      incomingCoordMap.set(key, coordStr);
    }
  });

  // 2. Persist monthly override in localStorage so uploaded data for targetSheet is retained
  const allLocalOverrides = loadLocalMonthlyOverrides(config.SPREADSHEET_ID);
  const currentSheetOverrides: Record<string, string> =
    mode === "replace" ? {} : { ...(allLocalOverrides[upperTarget] || {}) };

  let insertedCount = 0;
  let updatedCount = 0;

  incomingCoordMap.forEach((coordStr, key) => {
    if (currentSheetOverrides[key]) {
      updatedCount++;
    } else {
      insertedCount++;
    }
    currentSheetOverrides[key] = coordStr;
  });

  allLocalOverrides[upperTarget] = currentSheetOverrides;
  saveLocalMonthlyOverrides(config.SPREADSHEET_ID, allLocalOverrides);

  // 3. Build monthlyLookups from existing records + updated targetSheet
  const monthlyLookups: MonthlyLookupsBySheet = {
    JUNI: new Map(),
    JULI: new Map(),
    AGUSTUS: new Map(),
    SEPTEMBER: new Map(),
    OKTOBER: new Map(),
    NOVEMBER: new Map(),
    DESEMBER: new Map()
  };

  existingRecords.forEach((rec) => {
    const k =
      rec.dil && rec.dil !== "-"
        ? rec.dil.trim().toLowerCase()
        : rec.id && rec.id !== "-"
        ? rec.id.trim().toLowerCase()
        : "";
    if (!k) return;
    if (rec.lokasiJuni && rec.lokasiJuni !== "-") monthlyLookups.JUNI.set(k, rec.lokasiJuni);
    if (rec.lokasiJuli && rec.lokasiJuli !== "-") monthlyLookups.JULI.set(k, rec.lokasiJuli);
    if (rec.lokasiAgustus && rec.lokasiAgustus !== "-") monthlyLookups.AGUSTUS.set(k, rec.lokasiAgustus);
    if (rec.lokasiSeptember && rec.lokasiSeptember !== "-") monthlyLookups.SEPTEMBER.set(k, rec.lokasiSeptember);
    if (rec.lokasiOktober && rec.lokasiOktober !== "-") monthlyLookups.OKTOBER.set(k, rec.lokasiOktober);
    if (rec.lokasiNovember && rec.lokasiNovember !== "-") monthlyLookups.NOVEMBER.set(k, rec.lokasiNovember);
    if (rec.lokasiDesember && rec.lokasiDesember !== "-") monthlyLookups.DESEMBER.set(k, rec.lokasiDesember);
  });

  if (mode === "replace") {
    monthlyLookups[upperTarget].clear();
  }
  incomingCoordMap.forEach((coordStr, key) => {
    monthlyLookups[upperTarget].set(key, coordStr);
  });

  // 4. Ensure any new DIL/IDPEL rows from the uploaded CSV that don't exist yet in existingRecords are added
  const existingKeys = new Set<string>();
  existingRecords.forEach((r) => {
    if (r.dil && r.dil !== "-") existingKeys.add(r.dil.trim().toLowerCase());
    if (r.id && r.id !== "-") existingKeys.add(r.id.trim().toLowerCase());
  });

  const combinedBaseRecords = [...existingRecords];
  const finalSchemas = buildColumnSchemas(
    existingHeaders.length > 0 ? existingHeaders : incomingHeaders
  );

  incomingRecords.forEach((inRec) => {
    const k =
      inRec.dil && inRec.dil !== "-"
        ? inRec.dil.trim().toLowerCase()
        : inRec.id && inRec.id !== "-"
        ? inRec.id.trim().toLowerCase()
        : "";
    if (k && !existingKeys.has(k)) {
      existingKeys.add(k);
      combinedBaseRecords.push({
        ...inRec,
        _rowId: `${k}_${combinedBaseRecords.length}`,
        _rowNumber: combinedBaseRecords.length + 1
      });
    }
  });

  const finalRecords = enrichRecordsWithMonthlyLocations(
    combinedBaseRecords,
    finalSchemas,
    monthlyLookups
  );

  // 5. Sync to Google Apps Script Web App targeting `targetSheet` (e.g. JUNI..DESEMBER)
  let syncedToRemote = false;
  let driveFile: ImportResultPayload["driveFile"] = null;
  let remoteMessage = "";

  // Format rows for the monthly sheet in Spreadsheet: IDPEL, BLTH, LATITUDE, LONGITUDE, NAMA, ALAMAT
  const monthNumberMap: Record<TargetMonthlySheet, string> = {
    JUNI: "202606",
    JULI: "202607",
    AGUSTUS: "202608",
    SEPTEMBER: "202609",
    OKTOBER: "202610",
    NOVEMBER: "202611",
    DESEMBER: "202612"
  };

  const monthlySheetHeaders = ["IDPEL", "BLTH", "LATITUDE", "LONGITUDE", "NAMA", "ALAMAT"];
  const monthlySheetRows = incomingRecords.map((r) => {
    const idVal = r.id !== "-" ? r.id : r.dil !== "-" ? r.dil : "";
    const coordStr = extractRecordCoordString(r);
    const parsed = parseCombinedLocationString(coordStr);
    return {
      IDPEL: idVal,
      BLTH: r.rawValues["BLTH"] || monthNumberMap[upperTarget] || "",
      LATITUDE: parsed.lat !== null ? String(parsed.lat) : "",
      LONGITUDE: parsed.lng !== null ? String(parsed.lng) : "",
      NAMA: r.nama !== "-" ? r.nama : "",
      ALAMAT: r.alamat !== "-" ? r.alamat : ""
    };
  });

  if (
    config.GAS_WEB_APP_URL &&
    config.GAS_WEB_APP_URL.trim().startsWith("https://script.google.com")
  ) {
    try {
      const postBody = {
        action: "import",
        mode,
        spreadsheetId: config.SPREADSHEET_ID,
        folderId: config.FOLDER_ID,
        sheetName: upperTarget, // Target sheet: JUNI, JULI, AGUSTUS, SEPTEMBER, OKTOBER, NOVEMBER, DESEMBER
        headers: monthlySheetHeaders,
        rows: monthlySheetRows,
        rawCsvContent: saveToDrive ? rawCsvContent : "",
        fileName,
        saveToDrive
      };

      const response = await fetch(config.GAS_WEB_APP_URL.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(postBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || `Gagal menyimpan ke Sheet ${upperTarget}.`);
      }

      syncedToRemote = true;
      driveFile = json.driveFile || null;
      remoteMessage =
        `Data CSV berhasil diupload ke Sheet ${upperTarget} (${incomingCoordMap.size} titik koordinat)` +
        (driveFile?.fileName
          ? ` dan salinan CSV disimpan ke Google Drive (${driveFile.fileName}).`
          : ".");
    } catch (postErr: any) {
      console.error("Gagal mengirim POST ke GAS Web App:", postErr);
      remoteMessage = `Data CSV berhasil dimasukkan ke kolom ${upperTarget} pada tabel & peta (${incomingCoordMap.size} titik), namun sinkronisasi ke Google Apps Script gagal (${postErr.message}).`;
    }
  } else {
    remoteMessage = `Data CSV berhasil diupload ke Sheet ${upperTarget} (${incomingCoordMap.size} titik koordinat) dan jarak otomatis diperbarui.`;
  }

  const updatedPayload: SpreadsheetDataPayload = {
    records: finalRecords,
    schemas: finalSchemas,
    headers: finalSchemas.map((s) => s.originalHeader),
    sheetName: config.SHEET_NAME || "Data",
    availableSheets: Array.from(
      new Set([config.SHEET_NAME || "Data", "DIL", ...TARGET_MONTHLY_SHEETS])
    ),
    updatedAt: new Date().toISOString(),
    sourceType: syncedToRemote ? "gas_api" : "local_cache"
  };

  saveLocalDatasetCache(config.SPREADSHEET_ID, updatedPayload);

  return {
    result: {
      success: true,
      mode,
      targetSheet: upperTarget,
      insertedCount,
      updatedCount,
      totalRows: finalRecords.length,
      syncedToRemote,
      driveFile,
      message: remoteMessage
    },
    updatedPayload
  };
}

export function saveLocalDatasetCache(
  spreadsheetId: string,
  payload: SpreadsheetDataPayload
): void {
  try {
    if (payload.records.length <= 15000) {
      localStorage.setItem(
        `${LOCAL_DATA_CACHE_KEY}_${spreadsheetId}`,
        JSON.stringify(payload)
      );
    }
  } catch (e) {
    console.warn("Gagal menyimpan cache lokal:", e);
  }
}

export function loadLocalDatasetCache(
  spreadsheetId: string
): SpreadsheetDataPayload | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_DATA_CACHE_KEY}_${spreadsheetId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SpreadsheetDataPayload;
  } catch {
    return null;
  }
}

export function clearLocalDatasetCache(spreadsheetId: string): void {
  try {
    localStorage.removeItem(`${LOCAL_DATA_CACHE_KEY}_${spreadsheetId}`);
  } catch {
    // ignore
  }
}
