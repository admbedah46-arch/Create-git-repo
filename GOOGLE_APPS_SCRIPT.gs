/**
 * GOOGLE APPS SCRIPT FOR SURGIHUB
 * 
 * Petunjuk Instalasi:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu 'Extensions' > 'Apps Script'.
 * 3. Hapus kode yang ada di 'Code.gs' lalu tempel kode di bawah ini.
 * 4. Klik ikon Simpan (Save).
 * 5. Klik tombol 'Deploy' > 'New Deployment'.
 * 6. Pilih tipe 'Web App'.
 * 7. Isi Deskripsi: "Surgihub API".
 * 8. Execute as: 'Me'.
 * 9. Who has access: 'Anyone'.
 * 10. Klik 'Deploy', lalu salin 'Web App URL' yang muncul.
 * 11. Tempel URL tersebut ke menu Settings aplikasi Surgihub.
 */

function doGet(e) {
  try {
    var ss;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (ssErr) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Spreadsheet access failed: " + ssErr.toString(),
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheetName = "DATABASE_BEDAH"; // Default to DATABASE_BEDAH to isolate from ICU "DATABASE" tab
    if (e && e.parameter && e.parameter.sheetName) {
      sheetName = e.parameter.sheetName;
    } else if (e && e.parameter && e.parameter.appId) {
      sheetName = "DATABASE_" + e.parameter.appId.toUpperCase();
    }
    
    var sheet;
    try {
      sheet = ss.getSheetByName(sheetName);
    } catch (sheetErr) {
      // Continue or handle
    }
    
    if (!sheet) {
      try {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1).setValue("JSON_DATA");
        sheet.getRange(2, 1).setValue("{}");
      } catch (insertErr) {
        // Continue
      }
    }
    
    // Dynamic range validation: check if row 1 contains JSON, if not start from row 2 as requested by user
    var values = [];
    try {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      
      var startRow = 2; // Default starting row (usually row 2 contains the JSON if row 1 is a "JSON_DATA" header)
      try {
        var firstCell = sheet.getRange(1, 1).getValue() || "";
        var firstCellStr = firstCell.toString().trim();
        if (firstCellStr.indexOf("{") === 0 || firstCellStr.indexOf("[") === 0) {
          startRow = 1; // Row 1 contains actual JSON data, so read from row 1
        }
      } catch (checkErr) {
        // Fallback to row 2
      }
      
      if (lastRow >= startRow && lastCol >= 1) {
        var numRowsToRead = lastRow - startRow + 1;
        values = sheet.getRange(startRow, 1, numRowsToRead, lastCol).getValues();
      } else {
        var fallbackVal = sheet.getRange(1, 1).getValue() || "";
        if (fallbackVal) {
          values = [[fallbackVal]];
        }
      }
    } catch (rangeErr) {
      try {
        var val1 = sheet.getRange(1, 1).getValue() || "";
        var val2 = sheet.getRange(2, 1).getValue() || "";
        values = [[val1], [val2]];
      } catch (cellErr) {
        // Ignore
      }
    }
    
    // Loop through rows using try-catch with continue for robust row recovery
    var dataString = "";
    for (var i = 0; i < values.length; i++) {
      try {
        var cellVal = values[i][0];
        if (cellVal) {
          var trimmed = cellVal.toString().trim();
          if (trimmed) {
            dataString += trimmed;
          }
        }
      } catch (rowError) {
        continue;
      }
    }
    
    var data = null;
    if (dataString) {
      var firstBrace = dataString.indexOf("{");
      if (firstBrace !== -1) {
        dataString = dataString.substring(firstBrace);
      }
      data = resilientParseAppsScript(dataString);
    }
    
    // Validate final output has actual data
    var hasRealData = false;
    if (data) {
      var checkKeys = ['patients', 'financeRecords', 'dailyReports', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements'];
      for (var k = 0; k < checkKeys.length; k++) {
        var key = checkKeys[k];
        if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
          hasRealData = true;
          break;
        }
      }
      if (!hasRealData && data.masterData && data.masterData.users && data.masterData.users.length > 0) {
        hasRealData = true;
      }
    }
    
    var data_akhir;
    if (!data || !hasRealData) {
      data_akhir = {
        status: "error",
        message: "No data found",
        timestamp: new Date().toISOString()
      };
    } else {
      data_akhir = {
        status: "ready",
        data: data,
        timestamp: new Date().toISOString()
      };
    }
    
    return ContentService.createTextOutput(JSON.stringify(data_akhir))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function resilientParseAppsScript(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch (firstError) {
    try {
      var cleaned = jsonStr;
      
      // Attempt to isolate and clean settings block using brace matching
      var settingsIndex = cleaned.search(/"settings"\s*:\s*\{/);
      if (settingsIndex !== -1) {
        var braceCount = 0;
        var foundStart = false;
        var endIndex = -1;
        for (var i = settingsIndex; i < cleaned.length; i++) {
          if (cleaned[i] === '{') {
            braceCount++;
            foundStart = true;
          } else if (cleaned[i] === '}') {
            braceCount--;
            if (foundStart && braceCount === 0) {
              endIndex = i;
              break;
            }
          }
        }
        if (endIndex !== -1) {
          cleaned = cleaned.substring(0, settingsIndex) + '"settings": {"appName": "SiMANTAP", "appSlogan": "Manajemen Laporan Terpadu & Akurat", "themeColor": "#144272", "fontColor": "#ffffff"}' + cleaned.substring(endIndex + 1);
        }
      }
      return JSON.parse(cleaned);
    } catch (secondError) {
      return fallbackRawExtractAppsScript(jsonStr);
    }
  }
}

function fallbackRawExtractAppsScript(jsonStr) {
  var result = {
    patients: [],
    financeRecords: [],
    dailyReports: [],
    incidentReports: [],
    operationReports: [],
    instruments: [],
    doctorVisits: [],
    qualityMeasurements: [],
    masterData: {
      users: [],
      settings: {
        appName: 'SiMANTAP',
        appSlogan: 'Manajemen Laporan Terpadu & Akurat',
        themeColor: '#144272',
        fontColor: '#ffffff'
      }
    },
    deletedIds: []
  };

  var keys = ['patients', 'financeRecords', 'dailyReports', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements', 'deletedIds'];
  
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var regex = new RegExp('"' + key + '"\\s*:\\s*\\[([\\s\\S]*?)\\]');
    var match = jsonStr.match(regex);
    if (match && match[1]) {
      var arrayContent = match[1].trim();
      if (!arrayContent) continue;
      
      var braceCount = 0;
      var startIdx = -1;
      var items = [];
      
      for (var i = 0; i < arrayContent.length; i++) {
        if (arrayContent[i] === '{') {
          if (braceCount === 0) startIdx = i;
          braceCount++;
        } else if (arrayContent[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            var itemStr = arrayContent.substring(startIdx, i + 1);
            try {
              var parsedItem = JSON.parse(itemStr);
              if (parsedItem && parsedItem.id !== undefined) {
                items.push(parsedItem);
              }
            } catch (e) {
              try {
                var rescuedItem = {};
                var propRegex = /"([^"]+)"\s*:\s*(?:"([^"]*)"|([0-9.-]+|true|false|null))/g;
                var propMatch;
                while ((propMatch = propRegex.exec(itemStr)) !== null) {
                  var propName = propMatch[1];
                  var propValStr = propMatch[2] !== undefined ? propMatch[2] : propMatch[3];
                  var propVal = propValStr;
                  if (propVal === 'true') propVal = true;
                  else if (propVal === 'false') propVal = false;
                  else if (propVal === 'null') propVal = null;
                  else if (!isNaN(Number(propVal)) && propVal !== '') propVal = Number(propVal);
                  rescuedItem[propName] = propVal;
                }
                if (rescuedItem.id !== undefined) {
                  items.push(rescuedItem);
                }
              } catch (rescueErr) {}
            }
          }
        }
      }
      if (items.length > 0) {
        result[key] = items;
      }
    }
  }

  var usersMatch = jsonStr.match(/"users"\s*:\s*\[([\s\S]*?)\]/);
  if (usersMatch && usersMatch[1]) {
    var arrayContent = usersMatch[1].trim();
    var braceCount = 0;
    var startIdx = -1;
    var users = [];
    for (var i = 0; i < arrayContent.length; i++) {
      if (arrayContent[i] === '{') {
        if (braceCount === 0) startIdx = i;
        braceCount++;
      } else if (arrayContent[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          var itemStr = arrayContent.substring(startIdx, i + 1);
          try {
            var parsedUser = JSON.parse(itemStr);
            if (parsedUser && parsedUser.username) {
              users.push(parsedUser);
            }
          } catch (e) {}
        }
      }
    }
    if (users.length > 0) {
      result.masterData.users = users;
    }
  }

  return result;
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "DATABASE_BEDAH"; // Default to DATABASE_BEDAH to isolate from ICU "DATABASE" tab
  if (e && e.parameter && e.parameter.sheetName) {
    sheetName = e.parameter.sheetName;
  } else if (e && e.parameter && e.parameter.appId) {
    sheetName = "DATABASE_" + e.parameter.appId.toUpperCase();
  }
  
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1).setValue("JSON_DATA");
  }
  
  try {
    var rawData = e.postData.contents;
    var parsed = JSON.parse(rawData);
    
    // Process settings wallpaper URLs from base64 into public Drive file links to stay within Sheets ~50,000 char limit!
    var appData = parsed.data || parsed;
    if (appData && appData.masterData && appData.masterData.settings) {
      var settings = appData.masterData.settings;
      if (settings.appWallpaperUrl && settings.appWallpaperUrl.indexOf('data:image/') === 0) {
        var driveUrl = uploadBase64ToDrive(settings.appWallpaperUrl, "app_wallpaper_" + Date.now());
        if (driveUrl) {
          settings.appWallpaperUrl = driveUrl;
        }
      }
      if (settings.loginWallpaperUrl && settings.loginWallpaperUrl.indexOf('data:image/') === 0) {
        var driveUrl = uploadBase64ToDrive(settings.loginWallpaperUrl, "login_wallpaper_" + Date.now());
        if (driveUrl) {
          settings.loginWallpaperUrl = driveUrl;
        }
      }
    }
    
    // Save updated JSON
    var updatedRawData = JSON.stringify(parsed);
    
    var val1 = sheet.getRange(1, 1).getValue() || "";
    var val1Str = val1.toString().trim();
    var isRow1Json = val1Str.indexOf("{") === 0 || val1Str.indexOf("[") === 0;
    
    if (isRow1Json || val1 === "") {
      sheet.getRange(1, 1).setValue(updatedRawData);
    } else {
      sheet.getRange(1, 1).setValue("JSON_DATA");
      sheet.getRange(2, 1).setValue(updatedRawData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      status: "success",
      message: "Data berhasil disimpan ke Spreadsheet",
      data: appData // Return the updated structure
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function uploadBase64ToDrive(base64Data, filename) {
  try {
    var parts = base64Data.split(',');
    var mimeTypeMatch = parts[0].match(/:(.*?);/);
    var mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
    var rawBase64 = parts[1];
    
    var decoded = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);
    
    // Find or create folder
    var folderName = "Surgihub_Wallpapers";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // Save file and set public review sharing
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    // Return direct direct-view embed URL
    return "https://drive.google.com/uc?export=view&id=" + fileId;
  } catch (err) {
    return null;
  }
}
