const SheetsDB = require('../lib/SheetsDB');
const memo = require('../lib/memo');
const { config } = require('../config');

/** Hierarquia coordenação -> equipes e lista de agentes, lida da aba de equipes (cache de 60 s). */
async function loadInitialData() {
  const rows = await SheetsDB.readValues(config.sheets.statusId, config.tabs.equipes);

  const hierarquia = {};
  const torresMapeadas = {};
  const emailParaEquipe = {};
  const listaAgentes = [];
  const jaListados = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const email = String(row[0] || '').trim().toLowerCase();
    const equipe = String(row[1] || '').trim();
    const coord = String(row[2] || '').trim();
    const torresStr = String(row[3] || '').trim();

    if (!coord || !equipe) continue;

    if (!hierarquia[coord]) hierarquia[coord] = [];
    if (!hierarquia[coord].includes(equipe)) hierarquia[coord].push(equipe);

    if (email && !config.botsIgnorados.includes(email)) {
      emailParaEquipe[email] = equipe;
      if (!jaListados.has(email)) {
        jaListados.add(email);
        const nome = email
          .split('@')[0]
          .replace('.', ' ')
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        listaAgentes.push({ email, name: nome, equipe });
      }
    }

    if (torresStr) {
      if (!torresMapeadas[equipe]) torresMapeadas[equipe] = [];
      torresStr.split(',').forEach((t) => {
        const tk = t.trim();
        if (tk && !torresMapeadas[equipe].includes(tk)) torresMapeadas[equipe].push(tk);
      });
    }
  }

  return { hierarquia, torresMapeadas, emailParaEquipe, listaAgentes };
}

const getInitialData = memo(loadInitialData, 60 * 1000);

module.exports = { getInitialData };
