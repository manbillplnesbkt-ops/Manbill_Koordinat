export type TargetMonthlySheet =
  | "DIL"
  | "JUNI"
  | "JULI"
  | "AGUSTUS"
  | "SEPTEMBER"
  | "OKTOBER"
  | "NOVEMBER"
  | "DESEMBER"
  | "SAMPLING";

export const TARGET_MONTHLY_SHEETS: TargetMonthlySheet[] = [
  "DIL",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
  "SAMPLING"
];

export type CanonicalField =
  | "sampling"
  | "dil"
  | "id"
  | "nama"
  | "alamat"
  | "koordinat_dil"
  | "lokasi_juni"
  | "lokasi_juli"
  | "lokasi_agustus"
  | "lokasi_september"
  | "lokasi_oktober"
  | "lokasi_november"
  | "lokasi_desember"
  | "jarak_dil_sampling"
  | "jarak_dil_juni"
  | "jarak_dil_juli"
  | "jarak_dil_agustus"
  | "jarak_dil_september"
  | "jarak_dil_oktober"
  | "jarak_dil_november"
  | "jarak_dil_desember"
  | "jarak_juli"
  | "jarak_agustus"
  | "jarak_september"
  | "jarak_oktober"
  | "jarak_november"
  | "jarak_desember"
  | "unit"
  | "petugas"
  | "latitude"
  | "longitude"
  | "status"
  | "keterangan"
  | "tanggal"
  | "waktu";

export interface ColumnSchema {
  originalHeader: string;
  normalizedKey: string;
  canonicalRole: CanonicalField | null;
  label: string;
  isDefaultVisible: boolean;
}

const CANONICAL_PATTERNS: Record<CanonicalField, string[]> = {
  sampling: [
    "sampling",
    "koordinat",
    "koordinat_sampling",
    "titik_sampling",
    "lokasi_sampling"
  ],
  dil: [
    "dil",
    "data_induk_langganan",
    "no_dil",
    "id_dil",
    "status_dil",
    "kode_dil"
  ],
  id: [
    "id",
    "idpel",
    "id_pel",
    "id_pelanggan",
    "idpelanggan",
    "no_pelanggan",
    "nomor_pelanggan",
    "kode",
    "kode_lokasi",
    "no_id",
    "noid"
  ],
  nama: [
    "nama",
    "nama_pelanggan",
    "namapelanggan",
    "pelanggan",
    "nama_lokasi",
    "namalokasi",
    "customer",
    "name"
  ],
  alamat: [
    "alamat",
    "alamat_lokasi",
    "alamat_pelanggan",
    "lokasi",
    "address",
    "jalan"
  ],
  koordinat_dil: [
    "koordinat_dil",
    "titik_dil",
    "lokasi_dil"
  ],
  lokasi_juni: [
    "lokasi_juni",
    "koordinat_juni",
    "titik_juni"
  ],
  lokasi_juli: [
    "lokasi_juli",
    "koordinat_juli",
    "titik_juli"
  ],
  lokasi_agustus: [
    "lokasi_agustus",
    "koordinat_agustus",
    "titik_agustus"
  ],
  lokasi_september: [
    "lokasi_september",
    "koordinat_september",
    "titik_september"
  ],
  lokasi_oktober: [
    "lokasi_oktober",
    "koordinat_oktober",
    "titik_oktober"
  ],
  lokasi_november: [
    "lokasi_november",
    "koordinat_november",
    "titik_november"
  ],
  lokasi_desember: [
    "lokasi_desember",
    "koordinat_desember",
    "titik_desember"
  ],
  jarak_dil_sampling: [
    "jarak_dil_sampling",
    "jarak_dengan_sampling_dil",
    "jarak_sampling_dil"
  ],
  jarak_dil_juni: [
    "jarak_dil_juni",
    "jarak_dengan_dil_juni",
    "jarak_koordinat_juni_dengan_dil"
  ],
  jarak_dil_juli: [
    "jarak_dil_juli",
    "jarak_dengan_dil_juli",
    "jarak_koordinat_juli_dengan_dil"
  ],
  jarak_dil_agustus: [
    "jarak_dil_agustus",
    "jarak_dengan_dil_agustus",
    "jarak_koordinat_agustus_dengan_dil"
  ],
  jarak_dil_september: [
    "jarak_dil_september",
    "jarak_dengan_dil_september",
    "jarak_koordinat_september_dengan_dil"
  ],
  jarak_dil_oktober: [
    "jarak_dil_oktober",
    "jarak_dengan_dil_oktober",
    "jarak_koordinat_oktober_dengan_dil"
  ],
  jarak_dil_november: [
    "jarak_dil_november",
    "jarak_dengan_dil_november",
    "jarak_koordinat_november_dengan_dil"
  ],
  jarak_dil_desember: [
    "jarak_dil_desember",
    "jarak_dengan_dil_desember",
    "jarak_koordinat_desember_dengan_dil"
  ],
  jarak_juli: [
    "jarak_koordinat_juli",
    "jarak_juli",
    "jarak_juni_juli",
    "juni_juli"
  ],
  jarak_agustus: [
    "jarak_koordinat_agustus",
    "jarak_agustus",
    "jarak_juli_agustus",
    "juli_agustus"
  ],
  jarak_september: [
    "jarak_koordinat_september",
    "jarak_september",
    "jarak_agustus_september",
    "agustus_september"
  ],
  jarak_oktober: [
    "jarak_koordinat_oktober",
    "jarak_oktober",
    "jarak_september_oktober",
    "september_oktober"
  ],
  jarak_november: [
    "jarak_koordinat_november",
    "jarak_november",
    "jarak_oktober_november",
    "oktober_november"
  ],
  jarak_desember: [
    "jarak_koordinat_desember",
    "jarak_desember",
    "jarak_november_desember",
    "november_desember"
  ],
  unit: [
    "unit",
    "up3",
    "ulp",
    "unit_up",
    "unit_ulp",
    "rayon",
    "wilayah",
    "cabang",
    "area"
  ],
  petugas: [
    "petugas",
    "nama_petugas",
    "surveyor",
    "teknisi",
    "pemeriksa",
    "pic",
    "operator",
    "agent"
  ],
  latitude: [
    "latitude",
    "lat",
    "lintang",
    "koordinat_y",
    "koordinaty",
    "coord_y",
    "lat_y",
    "koordinat_dil_x",
    "koordinat_dil_lat"
  ],
  longitude: [
    "longitude",
    "lng",
    "lon",
    "long",
    "bujur",
    "koordinat_x",
    "koordinatx",
    "coord_x",
    "lon_x",
    "lng_x",
    "koordinat_dil_y",
    "koordinat_dil_lng"
  ],
  status: [
    "status",
    "kesimpulan",
    "status_validasi",
    "kondisi",
    "state",
    "verifikasi",
    "status_data"
  ],
  keterangan: [
    "keterangan",
    "catatan",
    "ket",
    "deskripsi",
    "notes",
    "note",
    "remark",
    "info"
  ],
  tanggal: [
    "tanggal",
    "tgl",
    "date",
    "tanggal_survey",
    "tgl_survey",
    "tanggal_input",
    "created_date"
  ],
  waktu: [
    "waktu",
    "jam",
    "time",
    "timestamp",
    "waktu_survey",
    "waktu_input"
  ]
};

/**
 * Normalizes a header string into lowercase snake_case without special characters.
 */
export function normalizeHeaderString(rawHeader: string): string {
  return String(rawHeader || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Detects if a normalized header matches one of the priority canonical fields.
 */
export function detectCanonicalRole(normalizedKey: string): CanonicalField | null {
  if (!normalizedKey) return null;

  for (const [role, aliases] of Object.entries(CANONICAL_PATTERNS) as [CanonicalField, string[]][]) {
    if (aliases.includes(normalizedKey)) {
      return role;
    }
  }

  if (normalizedKey.startsWith("jarak") || normalizedKey.includes("jarak_")) {
    return null;
  }

  if (normalizedKey === "dil") {
    return "dil";
  }

  if (
    normalizedKey === "koordinat_dil" ||
    normalizedKey === "titik_dil" ||
    normalizedKey === "lokasi_dil"
  ) {
    return "koordinat_dil";
  }

  if (
    normalizedKey.includes("latitude") ||
    normalizedKey.includes("lintang") ||
    normalizedKey === "koordinat_y" ||
    normalizedKey.endsWith("_lat")
  ) {
    return "latitude";
  }

  if (
    normalizedKey.includes("longitude") ||
    normalizedKey.includes("bujur") ||
    normalizedKey === "koordinat_x" ||
    normalizedKey.endsWith("_lng") ||
    normalizedKey.endsWith("_lon")
  ) {
    return "longitude";
  }

  if (normalizedKey.includes("idpel") || normalizedKey === "id_idpel") {
    return "id";
  }

  if (normalizedKey.startsWith("nama")) {
    return "nama";
  }

  if (normalizedKey.startsWith("alamat")) {
    return "alamat";
  }

  if (normalizedKey.startsWith("unit") || normalizedKey.includes("up3") || normalizedKey.includes("ulp")) {
    return "unit";
  }

  if (normalizedKey.includes("petugas") || normalizedKey.includes("surveyor")) {
    return "petugas";
  }

  if (normalizedKey.startsWith("status") || normalizedKey.startsWith("kesimpulan")) {
    return "status";
  }

  if (normalizedKey.startsWith("ket") || normalizedKey.includes("catatan")) {
    return "keterangan";
  }

  if (normalizedKey.startsWith("tanggal") || normalizedKey.startsWith("tgl")) {
    return "tanggal";
  }

  if (normalizedKey.startsWith("waktu") || normalizedKey.startsWith("jam")) {
    return "waktu";
  }

  return null;
}

/**
 * Ensures required columns exist in the schema list and orders them to match the grouped table layout:
 * 1. DIL, NAMA, ALAMAT
 * 2. KOORDINAT: DIL, JUNI, JULI, AGUSTUS, SEPTEMBER (+ OKTOBER, NOVEMBER, DESEMBER)
 * 3. JARAK DENGAN DIL: JUNI, JULI, AGUSTUS, SEPTEMBER (+ OKTOBER, NOVEMBER, DESEMBER)
 * 4. JARAK ANTAR BULAN: JUNI - JULI, JULI - AGUSTUS, AGUSTUS SEPTEMBER (+ SEPTEMBER - OKTOBER, OKTOBER - NOVEMBER, NOVEMBER - DESEMBER)
 * 5. Other columns (if toggled by user)
 */
export function buildColumnSchemas(rawHeaders: string[]): ColumnSchema[] {
  const assignedRoles = new Set<CanonicalField>();
  const usedKeys = new Set<string>();

  const defaultRoles: CanonicalField[] = [
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
  ];

  const disambiguatedRawHeaders: string[] = [];
  const headerCounts = new Map<string, number>();

  rawHeaders.forEach((h, idx) => {
    const trimmed = String(h ?? "").trim();
    const prevHeader = idx > 0 ? String(rawHeaders[idx - 1] ?? "").trim() : "";

    let baseLabel = trimmed || `Kolom_${idx + 1}`;
    if (baseLabel.toUpperCase() === "Y" && prevHeader.toUpperCase().endsWith(" X")) {
      baseLabel = prevHeader.slice(0, -2) + " Y";
    }

    const count = headerCounts.get(baseLabel) || 0;
    headerCounts.set(baseLabel, count + 1);
    const finalLabel = count === 0 ? baseLabel : `${baseLabel} (${count + 1})`;
    disambiguatedRawHeaders.push(finalLabel);
  });

  const workingHeaders = [...disambiguatedRawHeaders];

  const requiredColumns: { label: string; role: CanonicalField }[] = [
    { label: "DIL", role: "dil" },
    { label: "NAMA", role: "nama" },
    { label: "ALAMAT", role: "alamat" },
    { label: "SAMPLING", role: "sampling" },
    { label: "Koordinat DIL", role: "koordinat_dil" },
    { label: "Lokasi JUNI", role: "lokasi_juni" },
    { label: "Lokasi JULI", role: "lokasi_juli" },
    { label: "Lokasi AGUSTUS", role: "lokasi_agustus" },
    { label: "Lokasi SEPTEMBER", role: "lokasi_september" },
    { label: "Lokasi OKTOBER", role: "lokasi_oktober" },
    { label: "Lokasi NOVEMBER", role: "lokasi_november" },
    { label: "Lokasi DESEMBER", role: "lokasi_desember" },
    { label: "Jarak SAMPLING - DIL", role: "jarak_dil_sampling" },
    { label: "Jarak DIL - JUNI", role: "jarak_dil_juni" },
    { label: "Jarak DIL - JULI", role: "jarak_dil_juli" },
    { label: "Jarak DIL - AGUSTUS", role: "jarak_dil_agustus" },
    { label: "Jarak DIL - SEPTEMBER", role: "jarak_dil_september" },
    { label: "Jarak DIL - OKTOBER", role: "jarak_dil_oktober" },
    { label: "Jarak DIL - NOVEMBER", role: "jarak_dil_november" },
    { label: "Jarak DIL - DESEMBER", role: "jarak_dil_desember" },
    { label: "JUNI - JULI", role: "jarak_juli" },
    { label: "JULI - AGUSTUS", role: "jarak_agustus" },
    { label: "AGUSTUS SEPTEMBER", role: "jarak_september" },
    { label: "SEPTEMBER - OKTOBER", role: "jarak_oktober" },
    { label: "OKTOBER - NOVEMBER", role: "jarak_november" },
    { label: "NOVEMBER - DESEMBER", role: "jarak_desember" }
  ];

  for (const reqCol of requiredColumns) {
    const exists = workingHeaders.some(
      (h) => detectCanonicalRole(normalizeHeaderString(h)) === reqCol.role
    );
    if (!exists) {
      workingHeaders.push(reqCol.label);
    }
  }

  const schemas: ColumnSchema[] = [];

  workingHeaders.forEach((raw, idx) => {
    const trimmed = String(raw ?? "").trim();
    const label = trimmed || `Kolom_${idx + 1}`;
    let norm = normalizeHeaderString(label);
    if (!norm) norm = `col_${idx + 1}`;

    let uniqueKey = norm;
    let counter = 2;
    while (usedKeys.has(uniqueKey)) {
      uniqueKey = `${norm}_${counter}`;
      counter++;
    }
    usedKeys.add(uniqueKey);

    const detected = detectCanonicalRole(norm);
    let role: CanonicalField | null = null;
    if (detected && !assignedRoles.has(detected)) {
      role = detected;
      assignedRoles.add(detected);
    }

    const isDefaultVisible = role ? defaultRoles.includes(role) : false;

    schemas.push({
      originalHeader: label,
      normalizedKey: uniqueKey,
      canonicalRole: role,
      label,
      isDefaultVisible
    });
  });

  const priorityOrder: CanonicalField[] = [
    "dil",
    "nama",
    "alamat",
    "sampling",
    "koordinat_dil",
    "lokasi_juni",
    "lokasi_juli",
    "lokasi_agustus",
    "lokasi_september",
    "lokasi_oktober",
    "lokasi_november",
    "lokasi_desember",
    "jarak_dil_sampling",
    "jarak_dil_juni",
    "jarak_dil_juli",
    "jarak_dil_agustus",
    "jarak_dil_september",
    "jarak_dil_oktober",
    "jarak_dil_november",
    "jarak_dil_desember",
    "jarak_juli",
    "jarak_agustus",
    "jarak_september",
    "jarak_oktober",
    "jarak_november",
    "jarak_desember"
  ];

  const orderedPrimary = priorityOrder
    .map((role) => schemas.find((s) => s.canonicalRole === role))
    .filter((s): s is ColumnSchema => Boolean(s));

  const remainingCols = schemas.filter(
    (s) => !s.canonicalRole || !priorityOrder.includes(s.canonicalRole)
  );

  return [...orderedPrimary, ...remainingCols];
}
