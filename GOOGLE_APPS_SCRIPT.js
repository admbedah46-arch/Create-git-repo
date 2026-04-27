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
    
    // In postData, the app sends { data: ... }
    const appData = postData.data || postData;
    
    // Save as stringified JSON in A1
    // Note: Google Sheets cell limit is ~50,000 chars. 
    // For many records, this is a placeholder method.
    sheet.getRange(1, 1).setValue(JSON.stringify(appData));
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
