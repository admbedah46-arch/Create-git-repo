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
    // Validasi JSON jika perlu
    JSON.parse(rawData);
    
    sheet.getRange(2, 1).setValue(rawData);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      status: "success",
      message: "Data berhasil disimpan ke Spreadsheet" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
