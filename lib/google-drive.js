const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Initialize Google Drive with service account
function getGoogleDrive() {
  const keyPath = path.join(process.cwd(), 'google-credentials.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

// Fetch thought log content from Google Docs
async function fetchThoughtLog() {
  try {
    const drive = getGoogleDrive();
    const docId = process.env.GOOGLE_DOC_ID;

    // Export as plain text
    const response = await drive.files.export({
      fileId: docId,
      mimeType: 'text/plain',
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching thought log:', error);
    return null;
  }
}

module.exports = { fetchThoughtLog };
