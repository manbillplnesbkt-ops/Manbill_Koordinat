/**
 * ============================================================================
 * GOOGLE APPS SCRIPT BACKEND — GEOSHEET MONITOR
 * ============================================================================
 *
 * Salin seluruh kode ini ke dalam editor Google Apps Script (Extensions -> Apps Script)
 * pada Google Spreadsheet Anda, atau buat project baru di script.google.com.
 */

const CONFIG = {
  FOLDER_ID: "1fqDHeipSFj2nTrKQc8GAo9LMYDjRpqjh",
  SPREADSHEET_ID: "1xpNaKG7JQyh1XD-4TvB8Ef72cGl0bJVsn85wdoeWO5E",
  SHEET_NAME: "Data"
};

/**
 * Membaca kolom Lokasi (diambil dari Kolom ke-3 [Latitude] dan Kolom ke-4 [Longitude])
 * dari Sheet bulanan (JUNI, JULI, AGUSTUS) dan mengembalikan objek peta
 * { [dil_atau_idpel_lowercase]: "latitude, longitude" }
 */
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
  let keyIndices = [0];
  if (headers.length > 1) keyIndices.push(1);

  for (let c = 0; c < headers.length; c++) {
    const norm = headers[c].toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (norm === "dil" || norm.indexOf("idpel") !== -1 || norm === "id" || norm === "no_pelanggan") {
      if (keyIndices.indexOf(c) === -1) keyIndices.push(c);
    }
  }

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.length === 0) continue;

    // Ambil Kolom ke-3 (index 2 = Latitude) dan Kolom ke-4 (index 3 = Longitude)
    const rawLat = row.length >= 3 ? String(row[2] || "").trim() : "";
    const rawLng = row.length >= 4 ? String(row[3] || "").trim() : "";

    let locStr = "";
    if (rawLat && rawLng) {
      locStr = rawLat.replace(/,/g, ".") + ", " + rawLng.replace(/,/g, ".");
    } else if (rawLat && rawLat.indexOf(",") !== -1) {
      locStr = rawLat;
    }

    if (!locStr) continue;

    for (let k = 0; k < keyIndices.length; k++) {
      const kIdx = keyIndices[k];
      const keyVal = String(row[kIdx] || "").trim().toLowerCase();
      if (keyVal && keyVal !== "-") {
        map[keyVal] = locStr;
      }
    }
  }
  return map;
}

/**
 * Membaca Sheet DIL untuk mengambil NAMA, ALAMAT, dan Koordinat DIL
 * (diambil dari Kolom ke-7 [Latitude] dan Kolom ke-8 [Longitude])
 */
function extractDilMasterMap(ss) {
  const map = {};
  const sheet = ss.getSheetByName("DIL");
  if (!sheet) return map;

  const values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return map;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.length === 0) continue;
    const dilId = String(row[0] || "").trim();
    if (!dilId || dilId === "1") continue;

    const rawLat = row.length >= 7 ? String(row[6] || "").trim() : "";
    const rawLng = row.length >= 8 ? String(row[7] || "").trim() : "";
    let koordinatDil = "";
    if (rawLat && rawLng) {
      koordinatDil = rawLat.replace(/,/g, ".") + ", " + rawLng.replace(/,/g, ".");
    }

    map[dilId.toLowerCase()] = {
      dil: dilId,
      nama: String(row[1] || "").trim(),
      alamat: String(row[2] || "").trim(),
      koordinatDil: koordinatDil
    };
  }
  return map;
}

/**
 * Endpoint GET: Mengambil data dari Google Spreadsheet beserta Lokasi dari Sheet JUNI, JULI, AGUSTUS & Sheet DIL
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const spreadsheetId = params.spreadsheetId || CONFIG.SPREADSHEET_ID;
    const requestedSheetName = params.sheetName || CONFIG.SHEET_NAME;

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const allSheets = ss.getSheets().map(function(s) {
      return s.getName();
    });

    let sheet = ss.getSheetByName(requestedSheetName);
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }

    const activeSheetName = sheet.getName();
    const values = sheet.getDataRange().getDisplayValues();

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

    if (!values || values.length === 0) {
      return createJsonResponse({
        success: true,
        spreadsheetId: spreadsheetId,
        sheetName: activeSheetName,
        availableSheets: allSheets,
        headers: [],
        rows: [],
        monthlyLocations: monthlyLocations,
        dilMaster: dilMaster,
        totalRows: 0,
        updatedAt: new Date().toISOString()
      });
    }

    const headers = values[0].map(function(h, idx) {
      const trimmed = String(h || "").trim();
      return trimmed || ("Kolom_" + (idx + 1));
    });

    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const rowValues = values[i];
      const isEmpty = rowValues.every(function(cell) {
        return String(cell || "").trim() === "";
      });
      if (isEmpty) continue;

      const rowObj = {};
      for (let c = 0; c < headers.length; c++) {
        rowObj[headers[c]] = rowValues[c] !== undefined ? String(rowValues[c]).trim() : "";
      }
      rows.push(rowObj);
    }

    return createJsonResponse({
      success: true,
      spreadsheetId: spreadsheetId,
      sheetName: activeSheetName,
      availableSheets: allSheets,
      headers: headers,
      rows: rows,
      monthlyLocations: monthlyLocations,
      dilMaster: dilMaster,
      totalRows: rows.length,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.message || String(err)
    });
  }
}

/**
 * Endpoint POST: Menerima import CSV (append / update / replace) & menyimpan file CSV ke Google Drive
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Payload POST kosong.");
    }

    const body = JSON.parse(e.postData.contents);
    const mode = body.mode || "append";
    const spreadsheetId = body.spreadsheetId || CONFIG.SPREADSHEET_ID;
    const folderId = body.folderId || CONFIG.FOLDER_ID;
    const sheetName = body.sheetName || CONFIG.SHEET_NAME;
    const incomingHeaders = body.headers || [];
    const incomingRows = body.rows || [];
    const rawCsvContent = body.rawCsvContent || "";
    const fileName = body.fileName || "data_upload.csv";
    const saveToDrive = body.saveToDrive !== false;

    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    let driveFileInfo = null;
    if (saveToDrive && rawCsvContent && folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
        const cleanName = fileName.replace(/\.csv$/i, "");
        const finalFileName = cleanName + "_" + timestamp + ".csv";

        const file = folder.createFile(finalFileName, rawCsvContent, MimeType.CSV);
        driveFileInfo = {
          fileId: file.getId(),
          fileName: file.getName(),
          fileUrl: file.getUrl()
        };
      } catch (driveErr) {
        driveFileInfo = {
          error: "Gagal menyimpan cadangan CSV ke Google Drive: " + driveErr.message
        };
      }
    }

    const existingData = sheet.getDataRange().getDisplayValues();
    let activeHeaders = [];

    if (mode === "replace" || existingData.length === 0 || (existingData.length === 1 && existingData[0].join("") === "")) {
      sheet.clearContents();
      activeHeaders = incomingHeaders;
      const matrix = [activeHeaders];

      incomingRows.forEach(function(rowObj) {
        const rowArr = activeHeaders.map(function(h) {
          return rowObj[h] !== undefined && rowObj[h] !== null ? String(rowObj[h]) : "";
        });
        matrix.push(rowArr);
      });

      if (matrix.length > 0 && activeHeaders.length > 0) {
        sheet.getRange(1, 1, matrix.length, activeHeaders.length).setValues(matrix);
      }

      return createJsonResponse({
        success: true,
        mode: "replace",
        insertedCount: incomingRows.length,
        updatedCount: 0,
        totalRows: incomingRows.length,
        driveFile: driveFileInfo
      });
    }

    activeHeaders = existingData[0].map(function(h) { return String(h).trim(); });

    incomingHeaders.forEach(function(inHeader) {
      const exists = activeHeaders.some(function(exHeader) {
        return exHeader.toLowerCase() === String(inHeader).trim().toLowerCase();
      });
      if (!exists) {
        activeHeaders.push(String(inHeader).trim());
      }
    });

    sheet.getRange(1, 1, 1, activeHeaders.length).setValues([activeHeaders]);

    if (mode === "append") {
      const appendMatrix = incomingRows.map(function(rowObj) {
        return activeHeaders.map(function(h) {
          const matchedKey = Object.keys(rowObj).find(function(k) {
            return k.toLowerCase() === h.toLowerCase();
          });
          return matchedKey ? String(rowObj[matchedKey] || "") : "";
        });
      });

      if (appendMatrix.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, appendMatrix.length, activeHeaders.length).setValues(appendMatrix);
      }

      return createJsonResponse({
        success: true,
        mode: "append",
        insertedCount: appendMatrix.length,
        updatedCount: 0,
        totalRows: sheet.getLastRow() - 1,
        driveFile: driveFileInfo
      });
    }

    if (mode === "update") {
      const idAliases = ["dil", "id", "idpel", "id_pel", "id_pelanggan", "no_pelanggan", "kode"];
      let idColIndex = -1;
      for (let i = 0; i < activeHeaders.length; i++) {
        const norm = activeHeaders[i].toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if (idAliases.indexOf(norm) !== -1 || norm.indexOf("idpel") !== -1) {
          idColIndex = i;
          break;
        }
      }
      if (idColIndex === -1) idColIndex = 0;

      const existingMap = {};
      const fullMatrix = existingData.slice(1).map(function(r) {
        const padded = [];
        for (let c = 0; c < activeHeaders.length; c++) {
          padded.push(r[c] !== undefined ? String(r[c]) : "");
        }
        return padded;
      });

      for (let r = 0; r < fullMatrix.length; r++) {
        const keyVal = String(fullMatrix[r][idColIndex] || "").trim();
        if (keyVal) {
          existingMap[keyVal] = r;
        }
      }

      let updatedCount = 0;
      let insertedCount = 0;

      incomingRows.forEach(function(rowObj) {
        const newRowArr = activeHeaders.map(function(h) {
          const matchedKey = Object.keys(rowObj).find(function(k) {
            return k.toLowerCase() === h.toLowerCase();
          });
          return matchedKey ? String(rowObj[matchedKey] || "") : "";
        });

        const incomingKey = String(newRowArr[idColIndex] || "").trim();
        if (incomingKey && existingMap.hasOwnProperty(incomingKey)) {
          const targetIdx = existingMap[incomingKey];
          fullMatrix[targetIdx] = newRowArr;
          updatedCount++;
        } else {
          fullMatrix.push(newRowArr);
          if (incomingKey) {
            existingMap[incomingKey] = fullMatrix.length - 1;
          }
          insertedCount++;
        }
      });

      sheet.clearContents();
      const finalOutput = [activeHeaders].concat(fullMatrix);
      sheet.getRange(1, 1, finalOutput.length, activeHeaders.length).setValues(finalOutput);

      return createJsonResponse({
        success: true,
        mode: "update",
        insertedCount: insertedCount,
        updatedCount: updatedCount,
        totalRows: fullMatrix.length,
        driveFile: driveFileInfo
      });
    }

    throw new Error("Mode import tidak dikenali: " + mode);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.message || String(err)
    });
  }
}

function createJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
