import React from "react";
import { X, Copy, Check, RotateCcw, Database, Code2, Lock, KeyRound, AlertCircle } from "lucide-react";
import { AppConfig, DEFAULT_CONFIG } from "../config/config";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
  onResetDefault: () => void;
}

const GAS_BACKEND_CODE = `const CONFIG = {
  FOLDER_ID: "1fqDHeipSFj2nTrKQc8GAo9LMYDjRpqjh",
  SPREADSHEET_ID: "1xpNaKG7JQyh1XD-4TvB8Ef72cGl0bJVsn85wdoeWO5E",
  SHEET_NAME: "Data"
};

function extractMonthlyLocationMap(ss, targetSheetName) {
  const map = {};
  const sheets = ss.getSheets();
  let sheet = null;
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toUpperCase() === targetSheetName.toUpperCase()) {
      sheet = sheets[i];
      break;
    }
  }
  if (!sheet) return map;
  const values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return map;
  const headers = values[0].map(function(h) { return String(h || "").trim(); });
  const keyIndices = [0];
  if (headers.length > 1) keyIndices.push(1);
  for (let c = 0; c < headers.length; c++) {
    const norm = headers[c].toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (norm === "dil" || norm.indexOf("idpel") !== -1 || norm === "id") {
      if (keyIndices.indexOf(c) === -1) keyIndices.push(c);
    }
  }
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Ambil Kolom ke-3 (index 2 = Latitude) dan Kolom ke-4 (index 3 = Longitude)
    const rawLat = row.length >= 3 ? String(row[2] || "").trim() : "";
    const rawLng = row.length >= 4 ? String(row[3] || "").trim() : "";
    let locStr = "";
    if (rawLat && rawLng) locStr = rawLat.replace(/,/g, ".") + ", " + rawLng.replace(/,/g, ".");
    else if (rawLat && rawLat.indexOf(",") !== -1) locStr = rawLat;
    if (!locStr) continue;
    for (let k = 0; k < keyIndices.length; k++) {
      const keyVal = String(row[keyIndices[k]] || "").trim().toLowerCase();
      if (keyVal && keyVal !== "-") map[keyVal] = locStr;
    }
  }
  return map;
}

function extractDilMasterMap(ss) {
  const map = {};
  const sheet = ss.getSheetByName("DIL");
  if (!sheet) return map;
  const values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return map;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const dilId = String(row[0] || "").trim();
    if (!dilId) continue;
    const rawLat = row.length >= 8 ? String(row[6] || "").trim() : "";
    const rawLng = row.length >= 8 ? String(row[7] || "").trim() : "";
    let koordinatDil = "";
    if (rawLat && rawLng) {
      koordinatDil = rawLat.replace(/,/g, ".") + ", " + rawLng.replace(/,/g, ".");
    }
    const unitCol9 = row.length >= 9 ? String(row[8] || "").trim() : "";
    map[dilId.toLowerCase()] = {
      dil: dilId,
      nama: String(row[1] || "").trim(),
      alamat: String(row[2] || "").trim(),
      koordinatDil: koordinatDil,
      unit: unitCol9
    };
  }
  return map;
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const spreadsheetId = params.spreadsheetId || CONFIG.SPREADSHEET_ID;
    const requestedSheetName = params.sheetName || CONFIG.SHEET_NAME;
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const allSheets = ss.getSheets().map(function(s) { return s.getName(); });
    let sheet = ss.getSheetByName(requestedSheetName) || ss.getSheets()[0];
    const monthlyLocations = {
      JUNI: extractMonthlyLocationMap(ss, "JUNI"),
      JULI: extractMonthlyLocationMap(ss, "JULI"),
      AGUSTUS: extractMonthlyLocationMap(ss, "AGUSTUS"),
      SEPTEMBER: extractMonthlyLocationMap(ss, "SEPTEMBER"),
      OKTOBER: extractMonthlyLocationMap(ss, "OKTOBER"),
      NOVEMBER: extractMonthlyLocationMap(ss, "NOVEMBER"),
      DESEMBER: extractMonthlyLocationMap(ss, "DESEMBER")
    };
    const dilMaster = extractDilMasterMap(ss);
    const values = sheet.getDataRange().getDisplayValues();
    if (!values || values.length === 0) {
      return jsonOut({ success: true, sheetName: sheet.getName(), availableSheets: allSheets, headers: [], rows: [], monthlyLocations: monthlyLocations, dilMaster: dilMaster });
    }
    const headers = values[0].map(function(h, idx) { return String(h || "").trim() || ("Kolom_" + (idx + 1)); });
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i].every(function(c) { return String(c || "").trim() === ""; })) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) obj[headers[c]] = String(values[i][c] || "").trim();
      rows.push(obj);
    }
    return jsonOut({ success: true, sheetName: sheet.getName(), availableSheets: allSheets, headers: headers, rows: rows, monthlyLocations: monthlyLocations, dilMaster: dilMaster, updatedAt: new Date().toISOString() });
  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const mode = body.mode || "append";
    const ss = SpreadsheetApp.openById(body.spreadsheetId || CONFIG.SPREADSHEET_ID);
    const sheetName = body.sheetName || CONFIG.SHEET_NAME;
    let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    let driveFile = null;
    if (body.saveToDrive && body.rawCsvContent && (body.folderId || CONFIG.FOLDER_ID)) {
      const folder = DriveApp.getFolderById(body.folderId || CONFIG.FOLDER_ID);
      const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
      const f = folder.createFile((body.fileName || "data").replace(/\\.csv$/i, "") + "_" + ts + ".csv", body.rawCsvContent, MimeType.CSV);
      driveFile = { fileId: f.getId(), fileName: f.getName(), fileUrl: f.getUrl() };
    }
    const incomingHeaders = body.headers || [];
    const incomingRows = body.rows || [];
    if (mode === "replace" || sheet.getLastRow() === 0) {
      sheet.clearContents();
      const matrix = [incomingHeaders].concat(incomingRows.map(function(r) {
        return incomingHeaders.map(function(h) { return String(r[h] || ""); });
      }));
      sheet.getRange(1, 1, matrix.length, incomingHeaders.length).setValues(matrix);
      return jsonOut({ success: true, mode: mode, totalRows: incomingRows.length, driveFile: driveFile });
    }
    const existing = sheet.getDataRange().getDisplayValues();
    const activeHeaders = existing[0].map(function(h) { return String(h).trim(); });
    incomingHeaders.forEach(function(ih) {
      if (!activeHeaders.some(function(ah) { return ah.toLowerCase() === ih.toLowerCase(); })) activeHeaders.push(ih);
    });
    sheet.getRange(1, 1, 1, activeHeaders.length).setValues([activeHeaders]);
    if (mode === "append") {
      const rowsArr = incomingRows.map(function(r) {
        return activeHeaders.map(function(h) {
          const k = Object.keys(r).find(function(key) { return key.toLowerCase() === h.toLowerCase(); });
          return k ? String(r[k] || "") : "";
        });
      });
      if (rowsArr.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, rowsArr.length, activeHeaders.length).setValues(rowsArr);
      return jsonOut({ success: true, mode: "append", insertedCount: rowsArr.length, driveFile: driveFile });
    }
    // Mode update berdasarkan kolom ID / IDPEL
    const fullMatrix = existing.slice(1).map(function(r) {
      return activeHeaders.map(function(_, idx) { return r[idx] !== undefined ? String(r[idx]) : ""; });
    });
    const mapIdx = {};
    fullMatrix.forEach(function(r, idx) { if (r[0]) mapIdx[String(r[0]).trim()] = idx; });
    incomingRows.forEach(function(r) {
      const arr = activeHeaders.map(function(h) {
        const k = Object.keys(r).find(function(key) { return key.toLowerCase() === h.toLowerCase(); });
        return k ? String(r[k] || "") : "";
      });
      const idKey = String(arr[0] || "").trim();
      if (idKey && mapIdx.hasOwnProperty(idKey)) fullMatrix[mapIdx[idKey]] = arr;
      else fullMatrix.push(arr);
    });
    sheet.clearContents();
    const out = [activeHeaders].concat(fullMatrix);
    sheet.getRange(1, 1, out.length, activeHeaders.length).setValues(out);
    return jsonOut({ success: true, mode: "update", totalRows: fullMatrix.length, driveFile: driveFile });
  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetDefault
}) => {
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [passwordInput, setPasswordInput] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState<"settings" | "gas_code">("settings");
  const [spreadsheetId, setSpreadsheetId] = React.useState(config.SPREADSHEET_ID);
  const [folderId, setFolderId] = React.useState(config.FOLDER_ID);
  const [sheetName, setSheetName] = React.useState(config.SHEET_NAME);
  const [gasUrl, setGasUrl] = React.useState(config.GAS_WEB_APP_URL);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIsUnlocked(false);
      setPasswordInput("");
      setPasswordError(null);
      setSpreadsheetId(config.SPREADSHEET_ID);
      setFolderId(config.FOLDER_ID);
      setSheetName(config.SHEET_NAME);
      setGasUrl(config.GAS_WEB_APP_URL);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "adminmanbill") {
      setIsUnlocked(true);
      setPasswordError(null);
    } else {
      setPasswordError("Password salah. Silakan masukkan password yang benar.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      SPREADSHEET_ID: spreadsheetId.trim() || DEFAULT_CONFIG.SPREADSHEET_ID,
      FOLDER_ID: folderId.trim() || DEFAULT_CONFIG.FOLDER_ID,
      SHEET_NAME: sheetName.trim() || DEFAULT_CONFIG.SHEET_NAME,
      GAS_WEB_APP_URL: gasUrl.trim()
    });
    onClose();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isUnlocked) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-password-dialog-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600" />
              <h2
                id="config-password-dialog-title"
                className="text-sm font-bold text-slate-900"
              >
                Autentikasi Konfigurasi Database
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleVerifyPassword} className="p-5 space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              Masukkan password administrator untuk membuka menu <strong>Konfigurasi Database</strong>.
            </p>

            <div>
              <label
                htmlFor="config-admin-password"
                className="block font-semibold text-slate-800 mb-1.5"
              >
                Password Konfigurasi
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="config-admin-password"
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Masukkan password..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              {passwordError && (
                <div className="mt-2 flex items-center gap-1.5 text-red-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Buka Konfigurasi
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h2 id="config-modal-title" className="text-sm font-bold text-slate-900">
            Konfigurasi Database Google Spreadsheet & Apps Script
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup konfigurasi"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Pengaturan ID & Endpoint</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gas_code")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "gas_code"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Kode Google Apps Script Backend</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === "settings" ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-xs">
            <div>
              <label
                htmlFor="cfg-spreadsheet-id"
                className="block font-semibold text-slate-800 mb-1"
              >
                SPREADSHEET_ID (Database Utama)
              </label>
              <input
                id="cfg-spreadsheet-id"
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="cfg-folder-id"
                  className="block font-semibold text-slate-800 mb-1"
                >
                  FOLDER_ID (Google Drive CSV)
                </label>
                <input
                  id="cfg-folder-id"
                  type="text"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-sheet-name"
                  className="block font-semibold text-slate-800 mb-1"
                >
                  SHEET_NAME (Nama Tab Sheet)
                </label>
                <input
                  id="cfg-sheet-name"
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Data"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="cfg-gas-url"
                className="block font-semibold text-slate-800 mb-1"
              >
                Google Apps Script Web App URL (Opsional untuk Read/Write Penuh)
              </label>
              <input
                id="cfg-gas-url"
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Gunakan URL Web App Google Apps Script agar aplikasi dapat membaca Spreadsheet privat dan menyimpan hasil Upload CSV langsung ke Spreadsheet & Folder Google Drive tanpa menampilkan API key di frontend.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onResetDefault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembalikan Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Simpan & Muat Ulang
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-3 overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <p className="text-slate-600">
                Salin kode berikut ke <strong>Extensions &rarr; Apps Script</strong> pada Google Spreadsheet Anda, lalu klik <strong>Deploy &rarr; New deployment &rarr; Web app</strong>.
              </p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Kode Disalin" : "Salin Kode"}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed">
              {GAS_BACKEND_CODE}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
