const splitList = (value, fallback) =>
  String(value === undefined ? fallback : value)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const config = {
  port: Number(process.env.PORT) || 3001,
  isProduction: process.env.PROFILE !== undefined || process.env.NODE_ENV === 'production',

  sheets: {
    statusId: process.env.SHEET_STATUS_ID,
    historicoId: process.env.SHEET_HISTORICO_ID,
    tymershiftId: process.env.SHEET_TYMERSHIFT_ID,
  },
  tabs: {
    equipes: process.env.TAB_EQUIPES || 'E-mail - Equipe',
    historico: process.env.TAB_HISTORICO || 'Histórico 2026',
    feriados: process.env.TAB_FERIADOS || 'Feriados',
    tymershift: process.env.TAB_TYMERSHIFT || '2026-07',
  },
  botsIgnorados: splitList(
    process.env.BOTS_IGNORADOS,
    'caio.hotmart@hotmart.com,claudia.cloudhumans@external.hotmart.com'
  ),
};

const REQUIRED_ENV = [
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'SHEET_STATUS_ID',
  'SHEET_HISTORICO_ID',
  'SHEET_TYMERSHIFT_ID',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. ` +
        'Veja .env.example (local) ou values.yml (secrets no Magic Deploy).'
    );
  }
}

module.exports = { config, validateEnv };
