/**
 * SURGIHUB - Google Apps Script Backend (Simple DB)
 * 
 * INSTRUCTIONS:
 * 1. Create a Google Spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete everything in the script editor and paste this code.
 * 4. Rename the default sheet to "DB" (or create a new one named "DB").
 * 5. Click "Deploy" > "New Deployment".
 * 6. Select "Web App".
 * 7. Set "Execute as" to "Me" and "Who has access" to "Anyone".
 * 8. Copy the Web App URL and set it as VITE_APPS_SCRIPT_URL in your application settings.
 */

const SHEET_NAME = "DB";

function getTargetSheetName(e) {
  var name = SHEET_NAME;
  if (e && e.parameter && e.parameter.sheetName) {
    name = e.parameter.sheetName;
  } else if (e && e.parameter && e.parameter.appId) {
    name = "DATABASE_" + e.parameter.appId.toUpperCase();
  }
  if (name === "DB") {
    name = "DB_BEDAH"; // Isolate bedah from standard DB tab by default
  }
  return name;
}

function readDataFromSheet(sheet) {
  if (!sheet) return null;
  var values = [];
  try {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    
    var startRow = 2; // Default starting row
    try {
      var firstCell = sheet.getRange(1, 1).getValue() || "";
      var firstCellStr = firstCell.toString().trim();
      if (firstCellStr.indexOf("{") === 0 || firstCellStr.indexOf("[") === 0) {
        startRow = 1;
      }
    } catch (checkErr) {}
    
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
    } catch (cellErr) {}
  }
  
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
  return data;
}

function checkHasRealData(data) {
  if (!data) return false;
  var checkKeys = ['patients', 'financeRecords', 'dailyReports', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements'];
  for (var k = 0; k < checkKeys.length; k++) {
    var key = checkKeys[k];
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      return true;
    }
  }
  if (data.masterData && data.masterData.users && data.masterData.users.length > 0) {
    return true;
  }
  return false;
}

function writeLargeDataToSheet(sheet, isRow1Json, dataStr) {
  try {
    sheet.clearContents();
  } catch (clearErr) {
    try {
      sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 100), 1).clearContent();
    } catch (colClearErr) {}
  }
  
  var chunkSize = 40000;
  var chunks = [];
  for (var i = 0; i < dataStr.length; i += chunkSize) {
    chunks.push(dataStr.substring(i, i + chunkSize));
  }
  
  var startRow = 2;
  if (isRow1Json) {
    startRow = 1;
  } else {
    sheet.getRange(1, 1).setValue("JSON_DATA");
  }
  
  for (var j = 0; j < chunks.length; j++) {
    sheet.getRange(startRow + j, 1).setValue(chunks[j]);
  }
}

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

    var targetSheet = getTargetSheetName(e);
    var sheet = null;
    try {
      sheet = ss.getSheetByName(targetSheet);
    } catch (sheetErr) {}

    var data = null;
    var hasRealData = false;

    if (sheet) {
      data = readDataFromSheet(sheet);
      hasRealData = checkHasRealData(data);
    }

    // Fallback: if the target sheet doesn't exist, or has no real data,
    // let's search other sheets in the spreadsheet for valid JSON data!
    if (!hasRealData) {
      var sheets = ss.getSheets();
      var priorityNames = ["DB", "DATABASE", "SENSUS", "DB_BEDAH", "Sheet1"];
      
      // Filter unique available sheets
      var availableSheetsMap = {};
      for (var s = 0; s < sheets.length; s++) {
        availableSheetsMap[sheets[s].getName()] = sheets[s];
      }

      // 1. Try priority sheet names first
      for (var p = 0; p < priorityNames.length; p++) {
        var pName = priorityNames[p];
        if (pName === targetSheet) continue; // Already tried
        var fSheet = availableSheetsMap[pName];
        if (fSheet) {
          var fData = readDataFromSheet(fSheet);
          if (checkHasRealData(fData)) {
            data = fData;
            hasRealData = true;
            sheet = fSheet; // Keep track of which sheet had the real data
            break;
          }
        }
      }

      // 2. Try any other sheet
      if (!hasRealData) {
        for (var s = 0; s < sheets.length; s++) {
          var oSheet = sheets[s];
          var oName = oSheet.getName();
          if (oName === targetSheet || priorityNames.indexOf(oName) !== -1) continue;
          var fData = readDataFromSheet(oSheet);
          if (checkHasRealData(fData)) {
            data = fData;
            hasRealData = true;
            sheet = oSheet;
            break;
          }
        }
      }
    }

    // If still no real data and targetSheet didn't exist originally, create it
    if (!sheet) {
      try {
        sheet = ss.insertSheet(targetSheet);
        sheet.getRange(1, 1).setValue("JSON_DATA");
        sheet.getRange(2, 1).setValue("{}");
      } catch (insertErr) {}
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
  try {
    const postData = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetSheet = getTargetSheetName(e);
    var sheet = null;
    try {
      sheet = ss.getSheetByName(targetSheet);
    } catch (sheetErr) {}
    
    var hasRealData = false;
    if (sheet) {
      var currentData = readDataFromSheet(sheet);
      hasRealData = checkHasRealData(currentData);
    }
    
    if (!hasRealData) {
      var sheets = ss.getSheets();
      var priorityNames = ["DB", "DATABASE", "SENSUS", "DB_BEDAH", "Sheet1"];
      
      // Filter unique available sheets
      var availableSheetsMap = {};
      for (var s = 0; s < sheets.length; s++) {
        availableSheetsMap[sheets[s].getName()] = sheets[s];
      }

      for (var p = 0; p < priorityNames.length; p++) {
        var pName = priorityNames[p];
        if (pName === targetSheet) continue;
        var fSheet = availableSheetsMap[pName];
        if (fSheet) {
          var fData = readDataFromSheet(fSheet);
          if (checkHasRealData(fData)) {
            sheet = fSheet;
            targetSheet = pName; // Align write to fallback sheet!
            hasRealData = true;
            break;
          }
        }
      }
    }
    
    if (!sheet) {
      sheet = ss.insertSheet(targetSheet);
      sheet.getRange(1, 1).setValue("JSON_DATA");
    }
    
    // In postData, the app sends { data: ... } or raw json
    var appData = postData.data || postData;
    
    // Process settings wallpaper URLs from base64 into public Drive file links to stay within Sheets ~50,000 char limit!
    if (appData && appData.masterData && appData.masterData.settings) {
      const settings = appData.masterData.settings;
      if (settings.appWallpaperUrl && settings.appWallpaperUrl.indexOf('data:image/') === 0) {
        const driveUrl = uploadBase64ToDrive(settings.appWallpaperUrl, "app_wallpaper_" + Date.now());
        if (driveUrl) {
          settings.appWallpaperUrl = driveUrl;
        }
      }
      if (settings.loginWallpaperUrl && settings.loginWallpaperUrl.indexOf('data:image/') === 0) {
        const driveUrl = uploadBase64ToDrive(settings.loginWallpaperUrl, "login_wallpaper_" + Date.now());
        if (driveUrl) {
          settings.loginWallpaperUrl = driveUrl;
        }
      }
    }
    
    // Save updated JSON
    const updatedRawData = JSON.stringify(postData);
    
    const val1 = sheet.getRange(1, 1).getValue() || "";
    const val1Str = val1.toString().trim();
    const isRow1Json = val1Str.indexOf("{") === 0 || val1Str.indexOf("[") === 0;
    
    writeLargeDataToSheet(sheet, isRow1Json || val1 === "", updatedRawData);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      success: true,
      timestamp: new Date().toISOString(),
      data: appData // Return the updated data structure back so client local state is freed too!
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      message: error.toString()
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
