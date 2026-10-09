import { buildColumnSchemas, ColumnSchema } from "./normalizeHeaders";
import {
  parseAndValidateCoordinates,
  calculateDistanceMeters,
  formatDistanceMeters
} from "./coordinateUtils";

export interface MonthlyCoord {
  lat: number;
  lng: number;
}

export interface LocationRecord {
  _rowId: string;
  _rowNumber: number; // 1-indexed data row
  dil: string;
  id: string;
  nama: string;
  alamat: string;
  koordinatDil: string;
  lokasiSampling: string;
  unit: string;
  petugas: string;
  status: string;
  keterangan: string;
  tanggal: string;
  waktu: string;
  lokasiJuni: string;
  lokasiJuli: string;
  lokasiAgustus: string;
  lokasiSeptember: string;
  lokasiOktober: string;
  lokasiNovember: string;
  lokasiDesember: string;
  // JARAK DENGAN DIL (distance in meters between Koordinat DIL and each monthly coordinate)
  jarakDilJuni: string;
  jarakDilJuniMeters: number | null;
  jarakDilJuli: string;
  jarakDilJuliMeters: number | null;
  jarakDilAgustus: string;
  jarakDilAgustusMeters: number | null;
  jarakDilSeptember: string;
  jarakDilSeptemberMeters: number | null;
  jarakDilOktober: string;
  jarakDilOktoberMeters: number | null;
  jarakDilNovember: string;
  jarakDilNovemberMeters: number | null;
  jarakDilDesember: string;
  jarakDilDesemberMeters: number | null;
  // JARAK DENGAN SAMPLING (distance in meters between Koordinat SAMPLING and DIL / monthly coordinates)
  jarakSamplingDil: string;
  jarakSamplingDilMeters: number | null;
  jarakSamplingJuni: string;
  jarakSamplingJuniMeters: number | null;
  jarakSamplingJuli: string;
  jarakSamplingJuliMeters: number | null;
  jarakSamplingAgustus: string;
  jarakSamplingAgustusMeters: number | null;
  jarakSamplingSeptember: string;
  jarakSamplingSeptemberMeters: number | null;
  jarakSamplingOktober: string;
  jarakSamplingOktoberMeters: number | null;
  jarakSamplingNovember: string;
  jarakSamplingNovemberMeters: number | null;
  jarakSamplingDesember: string;
  jarakSamplingDesemberMeters: number | null;
  // JARAK ANTAR BULAN (distance in meters between consecutive months)
  jarakJuli: string; // JUNI - JULI
  jarakJuliMeters: number | null;
  jarakAgustus: string; // JULI - AGUSTUS
  jarakAgustusMeters: number | null;
  jarakSeptember: string; // AGUSTUS - SEPTEMBER
  jarakSeptemberMeters: number | null;
  jarakOktober: string; // SEPTEMBER - OKTOBER
  jarakOktoberMeters: number | null;
  jarakNovember: string; // OKTOBER - NOVEMBER
  jarakNovemberMeters: number | null;
  jarakDesember: string; // NOVEMBER - DESEMBER
  jarakDesemberMeters: number | null;
  coordDil: MonthlyCoord | null;
  coordSampling: MonthlyCoord | null;
  coordJuni: MonthlyCoord | null;
  coordJuli: MonthlyCoord | null;
  coordAgustus: MonthlyCoord | null;
  coordSeptember: MonthlyCoord | null;
  coordOktober: MonthlyCoord | null;
  coordNovember: MonthlyCoord | null;
  coordDesember: MonthlyCoord | null;
  latitude: number | null;
  longitude: number | null;
  hasValidCoords: boolean;
  rawValues: Record<string, string>; // Keyed by originalHeader
}

export interface CsvRowValidationError {
  rowNumber: number; // 1-based row number in CSV (including header offset = row + 2)
  idValue: string;
  errors: string[];
}

export interface CsvValidationResult {
  fileName: string;
  fileSize: number;
  headers: string[];
  schemas: ColumnSchema[];
  totalRows: number;
  validRows: LocationRecord[];
  invalidRows: LocationRecord[];
  allRecords: LocationRecord[];
  validationErrors: CsvRowValidationError[];
  hasIdColumn: boolean;
  hasCoordColumns: boolean;
}

/**
 * Helper to extract lat,lng from a combined string like "-0.30512, 100.36945" or "-0,30512, 100,36945"
 */
export function parseCombinedLocationString(locStr: string): {
  lat: number | null;
  lng: number | null;
  isValid: boolean;
} {
  if (!locStr || locStr === "-") return { lat: null, lng: null, isValid: false };
  const cleaned = locStr.trim();

  // First try splitting by comma + space or semicolon
  let parts = cleaned.split(/\s*;\s*|\s*,\s+/).filter(Boolean);
  if (parts.length < 2) {
    // If decimals are dots, split by comma
    parts = cleaned.split(/[,/\s]+/).filter(Boolean);
  }

  if (parts.length >= 2) {
    const check = parseAndValidateCoordinates(parts[0], parts[1]);
    if (check.isValid && check.lat !== null && check.lng !== null) {
      return { lat: check.lat, lng: check.lng, isValid: true };
    }
  }
  return { lat: null, lng: null, isValid: false };
}

/**
 * Checks if a row is a dummy column-numbering row (e.g. "1", "2", "3", "4", "5", ...).
 */
export function isColumnIndexSubheaderRow(rawRow: Record<string, unknown> | string[]): boolean {
  const values = Array.isArray(rawRow) ? rawRow : Object.values(rawRow);
  const nonEmpty = values.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (nonEmpty.length < 4) return false;

  return (
    nonEmpty[0] === "1" &&
    nonEmpty[1] === "2" &&
    nonEmpty[2] === "3" &&
    nonEmpty[3] === "4"
  );
}

/**
 * Converts a raw row object (keyed by original header) into a normalized LocationRecord.
 */
export function normalizeRowToRecord(
  rawRow: Record<string, unknown>,
  schemas: ColumnSchema[],
  index: number
): { record: LocationRecord; rowErrors: string[] } {
  const rawValues: Record<string, string> = {};
  let dil = "";
  let id = "";
  let nama = "";
  let alamat = "";
  let koordinatDil = "";
  let lokasiSampling = "";
  let unit = "";
  let petugas = "";
  let status = "";
  let keterangan = "";
  let tanggal = "";
  let waktu = "";
  let lokasiJuni = "";
  let lokasiJuli = "";
  let lokasiAgustus = "";
  let lokasiSeptember = "";
  let lokasiOktober = "";
  let lokasiNovember = "";
  let lokasiDesember = "";
  let rawLat: unknown = "";
  let rawLng: unknown = "";

  for (const col of schemas) {
    let rawVal = rawRow[col.originalHeader];
    if (rawVal === undefined) {
      const matchedKey = Object.keys(rawRow).find(
        (k) => k.trim().toLowerCase() === col.originalHeader.trim().toLowerCase()
      );
      if (matchedKey) {
        rawVal = rawRow[matchedKey];
      }
    }

    const cleanVal =
      rawVal === null || rawVal === undefined ? "" : String(rawVal).trim();
    rawValues[col.originalHeader] = cleanVal;

    switch (col.canonicalRole) {
      case "sampling":
        lokasiSampling = cleanVal;
        break;
      case "dil":
        dil = cleanVal;
        break;
      case "id":
        id = cleanVal;
        break;
      case "nama":
        nama = cleanVal;
        break;
      case "alamat":
        alamat = cleanVal;
        break;
      case "koordinat_dil":
        koordinatDil = cleanVal;
        break;
      case "unit":
        unit = cleanVal;
        break;
      case "petugas":
        petugas = cleanVal;
        break;
      case "status":
        status = cleanVal;
        break;
      case "keterangan":
        keterangan = cleanVal;
        break;
      case "tanggal":
        tanggal = cleanVal;
        break;
      case "waktu":
        waktu = cleanVal;
        break;
      case "lokasi_juni":
        lokasiJuni = cleanVal;
        break;
      case "lokasi_juli":
        lokasiJuli = cleanVal;
        break;
      case "lokasi_agustus":
        lokasiAgustus = cleanVal;
        break;
      case "lokasi_september":
        lokasiSeptember = cleanVal;
        break;
      case "lokasi_oktober":
        lokasiOktober = cleanVal;
        break;
      case "lokasi_november":
        lokasiNovember = cleanVal;
        break;
      case "lokasi_desember":
        lokasiDesember = cleanVal;
        break;
      case "latitude":
        rawLat = cleanVal;
        break;
      case "longitude":
        rawLng = cleanVal;
        break;
    }
  }

  // Fallback for positional sheet CSV:
  // - Sheet SAMPLING: Column 1 = IDPEL, Column 2 = ULP, Column 3 = KOORDINAT ("lat, lng")
  // - Sheet JUNI..DESEMBER: Column 1 = IDPEL, Column 2 = BLTH, Column 3 = LATITUDE, Column 4 = LONGITUDE
  // - Sheet DIL: Column 1 = DIL, Column 2 = NAMA, Column 3 = ALAMAT, Column 4 = TARIF, Column 5 = DAYA, Column 6 = NO RBM, Column 7 = LATITUDE, Column 8 = LONGITUDE
  const rawRowKeys = Object.keys(rawRow);
  if (!id && !dil && rawRowKeys.length > 0) {
    const firstColVal = String(rawRow[rawRowKeys[0]] ?? "").trim();
    if (firstColVal) {
      id = firstColVal;
      dil = firstColVal;
    }
  }
  if (!rawLat && !rawLng && lokasiSampling) {
    const parsedSampling = parseCombinedLocationString(lokasiSampling);
    if (parsedSampling.isValid && parsedSampling.lat !== null && parsedSampling.lng !== null) {
      rawLat = String(parsedSampling.lat);
      rawLng = String(parsedSampling.lng);
      lokasiSampling = `${parsedSampling.lat}, ${parsedSampling.lng}`;
    }
  }
  if (!rawLat && !rawLng && rawRowKeys.length >= 8) {
    const col7Val = String(rawRow[rawRowKeys[6]] ?? "").trim();
    const col8Val = String(rawRow[rawRowKeys[7]] ?? "").trim();
    const checkDilPos = parseAndValidateCoordinates(col7Val, col8Val);
    if (checkDilPos.isValid && checkDilPos.lat !== null && checkDilPos.lng !== null) {
      rawLat = col7Val;
      rawLng = col8Val;
    }
  }
  if (!rawLat && !rawLng && rawRowKeys.length >= 3) {
    const col3Val = String(rawRow[rawRowKeys[2]] ?? "").trim();
    const col4Val = rawRowKeys.length >= 4 ? String(rawRow[rawRowKeys[3]] ?? "").trim() : "";

    // Check if Column 3 alone is a combined coordinate string ("lat, lng") e.g. Sheet SAMPLING (IDPEL, ULP, KOORDINAT)
    const combinedCol3 = parseCombinedLocationString(col3Val);
    if (combinedCol3.isValid && combinedCol3.lat !== null && combinedCol3.lng !== null) {
      rawLat = String(combinedCol3.lat);
      rawLng = String(combinedCol3.lng);
      if (!lokasiSampling) {
        lokasiSampling = `${combinedCol3.lat}, ${combinedCol3.lng}`;
      }
    } else if (col4Val) {
      const checkPos = parseAndValidateCoordinates(col3Val, col4Val);
      if (checkPos.isValid && checkPos.lat !== null && checkPos.lng !== null) {
        rawLat = col3Val;
        rawLng = col4Val;
      }
    }
  }

  // Fallback for Koordinat DIL if main sheet has KOORDINAT DIL X / Y
  if (!koordinatDil) {
    const dx = (rawValues["KOORDINAT DIL X"] || "").replace(/,/g, ".").trim();
    const dy = (rawValues["KOORDINAT DIL Y"] || "").replace(/,/g, ".").trim();
    const check = parseAndValidateCoordinates(dx, dy);
    if (check.isValid && check.lat !== null && check.lng !== null) {
      koordinatDil = `${dx}, ${dy}`;
    }
  }

  // Fallback if the main sheet has ACMT <MONTH> X / Y
  const tryAcmtPair = (monthName: string): string => {
    const x = (rawValues[`ACMT ${monthName} X`] || "").replace(/,/g, ".").trim();
    const y = (rawValues[`ACMT ${monthName} Y`] || "").replace(/,/g, ".").trim();
    const check = parseAndValidateCoordinates(x, y);
    if (check.isValid && check.lat !== null && check.lng !== null) {
      return `${x}, ${y}`;
    }
    return "";
  };

  if (!lokasiJuni) lokasiJuni = tryAcmtPair("JUNI");
  if (!lokasiJuli) lokasiJuli = tryAcmtPair("JULI");
  if (!lokasiAgustus) lokasiAgustus = tryAcmtPair("AGUSTUS");
  if (!lokasiSeptember) lokasiSeptember = tryAcmtPair("SEPTEMBER");
  if (!lokasiOktober) lokasiOktober = tryAcmtPair("OKTOBER");
  if (!lokasiNovember) lokasiNovember = tryAcmtPair("NOVEMBER");
  if (!lokasiDesember) lokasiDesember = tryAcmtPair("DESEMBER");

  const rowErrors: string[] = [];
  const hasIdSchema = schemas.some((s) => s.canonicalRole === "id");
  const hasLatSchema = schemas.some((s) => s.canonicalRole === "latitude");
  const hasLngSchema = schemas.some((s) => s.canonicalRole === "longitude");

  let latitude: number | null = null;
  let longitude: number | null = null;
  let hasValidCoords = false;
  let coordDil: MonthlyCoord | null = null;

  if (hasLatSchema || hasLngSchema || (String(rawLat ?? "").trim() !== "" || String(rawLng ?? "").trim() !== "")) {
    const strLat = String(rawLat ?? "").trim();
    const strLng = String(rawLng ?? "").trim();

    if (strLat !== "" || strLng !== "") {
      const coordCheck = parseAndValidateCoordinates(rawLat, rawLng);
      if (!coordCheck.isValid) {
        rowErrors.push(coordCheck.errorReason || "Koordinat tidak valid");
      } else if (coordCheck.lat !== null && coordCheck.lng !== null) {
        latitude = coordCheck.lat;
        longitude = coordCheck.lng;
        hasValidCoords = true;
        coordDil = { lat: coordCheck.lat, lng: coordCheck.lng };
        if (!koordinatDil) {
          const cleanLat = strLat.replace(/,/g, ".").replace(/\s+/g, "");
          const cleanLng = strLng.replace(/,/g, ".").replace(/\s+/g, "");
          koordinatDil = `${cleanLat}, ${cleanLng}`;
        }
      }
    }
  }

  if (koordinatDil && !coordDil) {
    const parsedDil = parseCombinedLocationString(koordinatDil);
    if (parsedDil.isValid && parsedDil.lat !== null && parsedDil.lng !== null) {
      coordDil = { lat: parsedDil.lat, lng: parsedDil.lng };
      if (!hasValidCoords) {
        latitude = parsedDil.lat;
        longitude = parsedDil.lng;
        hasValidCoords = true;
      }
    }
  }

  if (!dil && id) {
    dil = id;
    const dilCol = schemas.find((s) => s.canonicalRole === "dil");
    if (dilCol && dil) {
      rawValues[dilCol.originalHeader] = dil;
    }
  } else if (!id && dil) {
    id = dil;
  }

  if (hasIdSchema && !id && !dil) {
    rowErrors.push("ID / IDPEL / DIL kosong");
  }

  const toCoordObj = (str: string): MonthlyCoord | null => {
    const p = parseCombinedLocationString(str);
    return p.isValid && p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null;
  };

  const coordSampling =
    toCoordObj(lokasiSampling) ||
    (latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null);
  if (!lokasiSampling && coordSampling && hasLatSchema && hasLngSchema) {
    lokasiSampling = `${coordSampling.lat}, ${coordSampling.lng}`;
  }

  const coordJuni = toCoordObj(lokasiJuni);
  const coordJuli = toCoordObj(lokasiJuli);
  const coordAgustus = toCoordObj(lokasiAgustus);
  const coordSeptember = toCoordObj(lokasiSeptember);
  const coordOktober = toCoordObj(lokasiOktober);
  const coordNovember = toCoordObj(lokasiNovember);
  const coordDesember = toCoordObj(lokasiDesember);

  const calcDistPair = (c1: MonthlyCoord | null, c2: MonthlyCoord | null) => {
    const meters = c1 && c2 ? calculateDistanceMeters(c1.lat, c1.lng, c2.lat, c2.lng) : null;
    return { meters, text: formatDistanceMeters(meters) };
  };

  // JARAK DENGAN DIL
  const dDilJuni = calcDistPair(coordDil, coordJuni);
  const dDilJuli = calcDistPair(coordDil, coordJuli);
  const dDilAgustus = calcDistPair(coordDil, coordAgustus);
  const dDilSeptember = calcDistPair(coordDil, coordSeptember);
  const dDilOktober = calcDistPair(coordDil, coordOktober);
  const dDilNovember = calcDistPair(coordDil, coordNovember);
  const dDilDesember = calcDistPair(coordDil, coordDesember);

  // JARAK DENGAN SAMPLING
  const dSamplingDil = calcDistPair(coordSampling, coordDil);
  const dSamplingJuni = calcDistPair(coordSampling, coordJuni);
  const dSamplingJuli = calcDistPair(coordSampling, coordJuli);
  const dSamplingAgustus = calcDistPair(coordSampling, coordAgustus);
  const dSamplingSeptember = calcDistPair(coordSampling, coordSeptember);
  const dSamplingOktober = calcDistPair(coordSampling, coordOktober);
  const dSamplingNovember = calcDistPair(coordSampling, coordNovember);
  const dSamplingDesember = calcDistPair(coordSampling, coordDesember);

  // JARAK ANTAR BULAN
  const dJuniJuli = calcDistPair(coordJuni, coordJuli);
  const dJuliAgustus = calcDistPair(coordJuli, coordAgustus);
  const dAgustusSeptember = calcDistPair(coordAgustus, coordSeptember);
  const dSeptemberOktober = calcDistPair(coordSeptember, coordOktober);
  const dOktoberNovember = calcDistPair(coordOktober, coordNovember);
  const dNovemberDesember = calcDistPair(coordNovember, coordDesember);

  if (!hasValidCoords) {
    const fallbackCoord =
      coordDil ||
      coordSampling ||
      coordDesember ||
      coordNovember ||
      coordOktober ||
      coordSeptember ||
      coordAgustus ||
      coordJuli ||
      coordJuni;
    if (fallbackCoord) {
      latitude = fallbackCoord.lat;
      longitude = fallbackCoord.lng;
      hasValidCoords = true;
    } else if (hasLatSchema || hasLngSchema) {
      rowErrors.push("Latitude / Longitude kosong");
    }
  }

  const syncRoleVal = (role: ColumnSchema["canonicalRole"], val: string) => {
    const col = schemas.find((s) => s.canonicalRole === role);
    if (col && val && val !== "-") {
      rawValues[col.originalHeader] = val;
    }
  };

  syncRoleVal("sampling", lokasiSampling);
  syncRoleVal("koordinat_dil", koordinatDil);
  syncRoleVal("lokasi_juni", lokasiJuni);
  syncRoleVal("lokasi_juli", lokasiJuli);
  syncRoleVal("lokasi_agustus", lokasiAgustus);
  syncRoleVal("lokasi_september", lokasiSeptember);
  syncRoleVal("lokasi_oktober", lokasiOktober);
  syncRoleVal("lokasi_november", lokasiNovember);
  syncRoleVal("lokasi_desember", lokasiDesember);

  syncRoleVal("jarak_dil_sampling", dSamplingDil.text);
  syncRoleVal("jarak_dil_juni", dDilJuni.text);
  syncRoleVal("jarak_dil_juli", dDilJuli.text);
  syncRoleVal("jarak_dil_agustus", dDilAgustus.text);
  syncRoleVal("jarak_dil_september", dDilSeptember.text);
  syncRoleVal("jarak_dil_oktober", dDilOktober.text);
  syncRoleVal("jarak_dil_november", dDilNovember.text);
  syncRoleVal("jarak_dil_desember", dDilDesember.text);

  syncRoleVal("jarak_juli", dJuniJuli.text);
  syncRoleVal("jarak_agustus", dJuliAgustus.text);
  syncRoleVal("jarak_september", dAgustusSeptember.text);
  syncRoleVal("jarak_oktober", dSeptemberOktober.text);
  syncRoleVal("jarak_november", dOktoberNovember.text);
  syncRoleVal("jarak_desember", dNovemberDesember.text);

  const primaryKey = id || dil;

  const record: LocationRecord = {
    _rowId: primaryKey ? `${primaryKey}_${index}` : `row_${index + 1}`,
    _rowNumber: index + 1,
    dil: dil || "-",
    id: id || "-",
    nama: nama || "-",
    alamat: alamat || "-",
    koordinatDil: koordinatDil || "-",
    lokasiSampling: lokasiSampling || "-",
    unit: unit || "-",
    petugas: petugas || "-",
    status: status || "-",
    keterangan: keterangan || "-",
    tanggal: tanggal || "-",
    waktu: waktu || "-",
    lokasiJuni: lokasiJuni || "-",
    lokasiJuli: lokasiJuli || "-",
    lokasiAgustus: lokasiAgustus || "-",
    lokasiSeptember: lokasiSeptember || "-",
    lokasiOktober: lokasiOktober || "-",
    lokasiNovember: lokasiNovember || "-",
    lokasiDesember: lokasiDesember || "-",
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
    jarakSamplingDil: dSamplingDil.text,
    jarakSamplingDilMeters: dSamplingDil.meters,
    jarakSamplingJuni: dSamplingJuni.text,
    jarakSamplingJuniMeters: dSamplingJuni.meters,
    jarakSamplingJuli: dSamplingJuli.text,
    jarakSamplingJuliMeters: dSamplingJuli.meters,
    jarakSamplingAgustus: dSamplingAgustus.text,
    jarakSamplingAgustusMeters: dSamplingAgustus.meters,
    jarakSamplingSeptember: dSamplingSeptember.text,
    jarakSamplingSeptemberMeters: dSamplingSeptember.meters,
    jarakSamplingOktober: dSamplingOktober.text,
    jarakSamplingOktoberMeters: dSamplingOktober.meters,
    jarakSamplingNovember: dSamplingNovember.text,
    jarakSamplingNovemberMeters: dSamplingNovember.meters,
    jarakSamplingDesember: dSamplingDesember.text,
    jarakSamplingDesemberMeters: dSamplingDesember.meters,
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
    coordSampling,
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
    rawValues
  };

  return { record, rowErrors };
}

/**
 * Extracts a lookup map of { normalizedKey (DIL / IDPEL) -> combined "Latitude, Longitude" string }
 * from a monthly sheet (JUNI..DESEMBER) using 2D array rows (`string[][]`).
 * Specifically reads Column 3 (index 2 = Latitude) and Column 4 (index 3 = Longitude).
 */
export function buildSheetLocationLookupFromMatrix(
  matrix: string[][]
): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!matrix || matrix.length === 0) return lookup;

  const firstRow = matrix[0].map((c) => String(c ?? "").trim());

  const col3CombinedFirst = parseCombinedLocationString(firstRow[2] || "");
  const col3PairFirst = parseAndValidateCoordinates(firstRow[2], firstRow[3]);
  const startRowIdx = col3CombinedFirst.isValid || col3PairFirst.isValid ? 0 : 1;

  // Identify IDPEL / DIL key columns (never include BLTH)
  const keyColIndices = new Set<number>([0]);

  firstRow.forEach((h, idx) => {
    const norm = h.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (
      norm === "dil" ||
      norm.includes("idpel") ||
      norm === "id" ||
      norm === "id_pelanggan" ||
      norm === "no_pelanggan"
    ) {
      keyColIndices.add(idx);
    }
  });

  for (let r = startRowIdx; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;
    if (isColumnIndexSubheaderRow(row)) continue;

    let combinedLocation = "";

    // 1. Cek Kolom ke-3 (index 2): apakah sudah berupa titik koordinat gabungan ("lat, lng")
    if (row.length >= 3) {
      const rawCol3 = String(row[2] ?? "").trim();
      if (rawCol3 !== "" && rawCol3 !== "-") {
        const parsedCombined = parseCombinedLocationString(rawCol3);
        if (
          parsedCombined.isValid &&
          parsedCombined.lat !== null &&
          parsedCombined.lng !== null
        ) {
          combinedLocation = `${parsedCombined.lat}, ${parsedCombined.lng}`;
        }
      }
    }

    // 2. Jika belum valid dari Kolom ke-3 saja, cek gabungan Kolom ke-3 (Latitude) dan Kolom ke-4 (Longitude)
    if (!combinedLocation && row.length >= 4) {
      const rawCol3Lat = String(row[2] ?? "").trim();
      const rawCol4Lng = String(row[3] ?? "").trim();

      if (rawCol3Lat !== "" || rawCol4Lng !== "") {
        const cleanLatStr = rawCol3Lat.replace(/,/g, ".").replace(/\s+/g, "");
        const cleanLngStr = rawCol4Lng.replace(/,/g, ".").replace(/\s+/g, "");
        const parsed = parseAndValidateCoordinates(cleanLatStr, cleanLngStr);
        if (parsed.isValid && parsed.lat !== null && parsed.lng !== null) {
          combinedLocation = `${cleanLatStr}, ${cleanLngStr}`;
        }
      }
    }

    // 3. Jika Sheet DIL (8 kolom: DIL, NAMA, ALAMAT, TARIF, DAYA, NO RBM, LATITUDE, LONGITUDE), cek Kolom ke-7 dan ke-8
    if (!combinedLocation && row.length >= 8) {
      const rawCol7Lat = String(row[6] ?? "").trim();
      const rawCol8Lng = String(row[7] ?? "").trim();

      if (rawCol7Lat !== "" || rawCol8Lng !== "") {
        const cleanLatStr = rawCol7Lat.replace(/,/g, ".").replace(/\s+/g, "");
        const cleanLngStr = rawCol8Lng.replace(/,/g, ".").replace(/\s+/g, "");
        const parsed = parseAndValidateCoordinates(cleanLatStr, cleanLngStr);
        if (parsed.isValid && parsed.lat !== null && parsed.lng !== null) {
          combinedLocation = `${cleanLatStr}, ${cleanLngStr}`;
        }
      }
    }

    // Simpan ke lookup bahkan jika titik koordinat di Sheet SAMPLING kosong ("-"),
    // atau jika valid simpan koordinatnya
    keyColIndices.forEach((colIdx) => {
      const keyVal = String(row[colIdx] ?? "").trim().toLowerCase();
      if (keyVal && keyVal !== "-") {
        if (combinedLocation) {
          lookup.set(keyVal, combinedLocation);
        } else if (!lookup.has(keyVal)) {
          lookup.set(keyVal, "-");
        }
      }
    });
  }

  return lookup;
}

/**
 * Parses a 2D array of strings (from Papa.parse with header: false) into validated records,
 * properly handling duplicate column headers and skipping any dummy column-index row ("1", "2", "3", ...).
 */
export function validateCsvMatrixData(
  fileName: string,
  fileSize: number,
  matrix: string[][]
): CsvValidationResult {
  if (!matrix || matrix.length === 0) {
    throw new Error("Data Spreadsheet atau CSV kosong.");
  }

  const rawHeaderRow = matrix[0].map((h) => String(h ?? "").trim());
  if (rawHeaderRow.length === 0 || rawHeaderRow.every((h) => !h)) {
    throw new Error("Header kolom tidak boleh kosong.");
  }

  const disambiguatedHeaders: string[] = [];
  const headerCounts = new Map<string, number>();

  rawHeaderRow.forEach((h, idx) => {
    const trimmed = String(h ?? "").trim();
    const prevHeader = idx > 0 ? String(rawHeaderRow[idx - 1] ?? "").trim() : "";

    let baseLabel = trimmed || `Kolom_${idx + 1}`;
    if (baseLabel.toUpperCase() === "Y" && prevHeader.toUpperCase().endsWith(" X")) {
      baseLabel = prevHeader.slice(0, -2) + " Y";
    }

    const count = headerCounts.get(baseLabel) || 0;
    headerCounts.set(baseLabel, count + 1);
    const finalLabel = count === 0 ? baseLabel : `${baseLabel} (${count + 1})`;
    disambiguatedHeaders.push(finalLabel);
  });

  const dataRows: Record<string, unknown>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const rowCells = matrix[r];
    if (!rowCells || rowCells.length === 0) continue;

    const isEmpty = rowCells.every((c) => !String(c ?? "").trim());
    if (isEmpty) continue;

    if (r === 1 && isColumnIndexSubheaderRow(rowCells)) {
      continue;
    }

    const rowObj: Record<string, unknown> = {};
    for (let c = 0; c < disambiguatedHeaders.length; c++) {
      rowObj[disambiguatedHeaders[c]] = rowCells[c] !== undefined ? rowCells[c] : "";
    }
    dataRows.push(rowObj);
  }

  return validateCsvData(fileName, fileSize, disambiguatedHeaders, dataRows);
}

/**
 * Validates parsed CSV rows and separates valid vs invalid records.
 */
export function validateCsvData(
  fileName: string,
  fileSize: number,
  rawHeaders: string[],
  rawRows: Record<string, unknown>[]
): CsvValidationResult {
  const cleanHeaders = rawHeaders.map((h) => String(h ?? "").trim()).filter(Boolean);
  const schemas = buildColumnSchemas(cleanHeaders);

  const hasIdColumn = schemas.some(
    (s) => s.canonicalRole === "id" || s.canonicalRole === "dil"
  );
  const hasCoordColumns =
    schemas.some((s) => s.canonicalRole === "latitude") &&
    schemas.some((s) => s.canonicalRole === "longitude");

  const validRows: LocationRecord[] = [];
  const invalidRows: LocationRecord[] = [];
  const allRecords: LocationRecord[] = [];
  const validationErrors: CsvRowValidationError[] = [];

  rawRows.forEach((rawRow, idx) => {
    const hasAnyValue = Object.values(rawRow).some(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
    if (!hasAnyValue) return;
    if (idx === 0 && isColumnIndexSubheaderRow(rawRow)) return;

    const { record, rowErrors } = normalizeRowToRecord(
      rawRow,
      schemas,
      validRows.length + invalidRows.length
    );
    allRecords.push(record);

    if (rowErrors.length > 0) {
      invalidRows.push(record);
      validationErrors.push({
        rowNumber: idx + 2,
        idValue:
          record.id !== "-"
            ? record.id
            : record.dil !== "-"
            ? record.dil
            : `Baris #${idx + 2}`,
        errors: rowErrors
      });
    } else {
      validRows.push(record);
    }
  });

  return {
    fileName,
    fileSize,
    headers: schemas.map((s) => s.originalHeader),
    schemas,
    totalRows: allRecords.length,
    validRows,
    invalidRows,
    allRecords,
    validationErrors,
    hasIdColumn,
    hasCoordColumns
  };
}
