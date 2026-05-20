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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DATABASE");
  
  if (!sheet) {
    sheet = ss.insertSheet("DATABASE");
    sheet.getRange(1, 1).setValue("JSON_DATA");
  }
  
  var data = sheet.getRange(2, 1).getValue();
  
  var response = {
    status: "ready",
    data: data ? JSON.parse(data) : null,
    timestamp: new Date().toISOString()
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DATABASE");
  
  if (!sheet) {
    sheet = ss.insertSheet("DATABASE");
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
    sheet.getRange(2, 1).setValue(updatedRawData);
    
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
