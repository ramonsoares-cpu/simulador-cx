const googleClient = require('./googleClient');
const HttpError = require('./HttpError');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const quoteSheet = (name) => `'${String(name).replace(/'/g, "''")}'`;

const RETRIABLE_HTTP = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

function describe(error) {
  const code = error && (error.code || (error.cause && error.cause.code));
  const msg = (error && error.message) || 'erro desconhecido';
  return code ? `${msg} (${code})` : msg;
}

/**
 * Leitura de planilhas. Falhas do Google (inclusive 403 por falta de permissão da
 * service account) viram erro de infraestrutura (502), nunca 403 de usuário.
 */
class SheetsDB {
  /**
   * Lê a aba inteira. Retorna a matriz de valores brutos (UNFORMATTED_VALUE:
   * números continuam números e datas chegam como serial), incluindo a linha de cabeçalho.
   */
  static async readValues(spreadsheetId, aba) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await googleClient.getSheets().spreadsheets.values.get({
          spreadsheetId,
          range: quoteSheet(aba),
          valueRenderOption: 'UNFORMATTED_VALUE',
        });
        return res.data.values || [];
      } catch (error) {
        lastError = error;
        const status = Number(error && (error.code || (error.response && error.response.status)));
        const message = String((error && error.message) || '');

        if (status === 400 && /unable to parse range/i.test(message)) {
          throw new HttpError(502, `Aba "${aba}" não encontrada na planilha.`);
        }
        const retriable = RETRIABLE_HTTP.has(status) || (error && error.cause && error.cause.code) || (!status && /fetch failed|ECONN|ETIMEDOUT/i.test(message));
        if (!retriable || attempt === MAX_ATTEMPTS) break;
        await sleep(500 * 2 ** (attempt - 1) + Math.random() * 500);
      }
    }
    console.error(`[SheetsDB] falha ao ler a aba "${aba}":`, describe(lastError));
    throw new HttpError(502, `Falha ao acessar o Google Sheets (aba "${aba}"): ${describe(lastError)}`);
  }
}

module.exports = SheetsDB;
module.exports.quoteSheet = quoteSheet;
