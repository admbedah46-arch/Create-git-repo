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

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1).setValue("{}");
    }
    
    const dataString = sheet.getRange(1, 1).getValue();
    const data = JSON.parse(dataString || "{}");
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "ready",
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }
    
    // In postData, the app sends { data: ... } or raw json
    let appData = postData.data || postData;
    
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
    
    // Save as stringified JSON in A1
    // Note: Google Sheets cell limit is ~50,000 chars. 
    // Converting base64 to public links reduces the size instantly to pass cell & local storage limits!
    sheet.getRange(1, 1).setValue(JSON.stringify(appData));
    
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
