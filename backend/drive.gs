function uploadToDrive(base64Data, fileName, mimeType, folderId) {
  try {
    if (!base64Data) throw new Error('Tidak ada data file');
    
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingErr) {
      Logger.log('Gagal set sharing (tapi file tetap terupload): ' + sharingErr.toString());
    }
    
    const fileId = file.getId();
    const viewUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    const downloadUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    
    return { success: true, fileId, viewUrl, downloadUrl, name: fileName };
  } catch (err) {
    Logger.log('Upload error: ' + err.toString());
    return { success: false, error: err.message };
  }
}

function handleUploadFile({ base64, fileName, mimeType, type }) {
  const folderIds = {
    photo: CONFIG.PHOTOS_FOLDER_ID,
    cv: CONFIG.CV_FOLDER_ID,
    selfie: CONFIG.SELFIE_FOLDER_ID,
  };
  const folderId = folderIds[type] || CONFIG.PHOTOS_FOLDER_ID;
  return uploadToDrive(base64, fileName || ('file_' + Date.now()), mimeType || 'application/octet-stream', folderId);
}

function getExtension(mime) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return map[mime] || '';
}
