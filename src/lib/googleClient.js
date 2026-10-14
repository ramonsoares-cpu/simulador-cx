const { google } = require('googleapis');

let sheets = null;

// Escopo mínimo: o app só lê planilhas.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

/** Cliente da Sheets API (Service Account). Exportado como propriedade para poder ser substituído em testes. */
function getSheets() {
  if (!sheets) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: SCOPES,
    });
    sheets = google.sheets({ version: 'v4', auth });
  }
  return sheets;
}

module.exports = { getSheets };
