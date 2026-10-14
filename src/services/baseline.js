const SheetsDB = require('../lib/SheetsDB');
const { config } = require('../config');
const { parseDateMs, toDateString } = require('../lib/dates');
const { buildForecastProfile } = require('./forecast');

const DAY_MS = 24 * 60 * 60 * 1000;
const NAO_PRODUTIVO = ['lunch', 'break', 'pausa', 'time', 'ausente', 'vacation', 'day off'];

const isProdutivo = (act) => act !== '' && !NAO_PRODUTIVO.some((w) => act.includes(w));
const matrix7x24 = () => Array.from({ length: 7 }, () => new Array(24).fill(0));

function teamAllowed(equipe, isAllTeams, allowedTeams) {
  return isAllTeams || (equipe && allowedTeams.has(equipe));
}

async function loadFeriados() {
  const feriados = new Set();
  const rows = await SheetsDB.readValues(config.sheets.historicoId, config.tabs.feriados);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const raw = row[0] || row[5];
    if (!raw) continue;
    feriados.add(toDateString(raw));
  }
  return feriados;
}

/** Histórico de demanda filtrado: tickets por dia/hora/tipo (SYNC|ASYNC) e TMO médio ponderado. */
async function loadDemanda(mesesFiltro, mapping, isAllTeams, allowedTeams) {
  const baseData = [];
  const tmo = { tsS: 0, tckS: 0, tsA: 0, tckA: 0 };

  const data = await SheetsDB.readValues(config.sheets.historicoId, config.tabs.historico);

  let maxDateMs = 0;
  for (let i = 1; i < Math.min(data.length, 500); i++) {
    const dMs = parseDateMs((data[i] || [])[0]);
    if (dMs && dMs > maxDateMs) maxDateMs = dMs;
  }
  if (maxDateMs === 0) maxDateMs = Date.now();
  const limiteMs = maxDateMs - mesesFiltro * 30 * DAY_MS;

  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const dMs = parseDateMs(row[0]);
    if (!dMs || dMs < limiteMs) continue;

    const hour = parseInt(row[1], 10) || 0;
    const email = String(row[5] || '').trim().toLowerCase();
    if (config.botsIgnorados.includes(email)) continue;

    if (!teamAllowed(mapping.emailParaEquipe[email], isAllTeams, allowedTeams)) continue;

    const tickets = parseInt(row[2], 10) || 0;
    const timeSpent = parseFloat(String(row[3]).replace(',', '.')) || 0;
    const channel = String(row[7] || '').trim().toLowerCase();

    if (tickets > 0) {
      const isSync = channel.includes('whatsapp') || channel.includes('chat') || channel.includes('messaging');
      if (isSync) {
        tmo.tsS += timeSpent * tickets;
        tmo.tckS += tickets;
      } else {
        tmo.tsA += timeSpent * tickets;
        tmo.tckA += tickets;
      }
      baseData.push({ dateMs: dMs, hour, tickets, type: isSync ? 'SYNC' : 'ASYNC' });
    }
  }

  return { baseData, tmo };
}

/** Capacidade (headcount por dia da semana/hora) a partir da escala do Tymershift: bruta vs. líquida. */
async function loadCapacidade(mapping, isAllTeams, allowedTeams, agentesAusentes) {
  const hcMatrixFull = matrix7x24();
  const hcMatrixLiquid = matrix7x24();
  let hcEscaladoFull = 0;
  let hcEscaladoLiquid = 0;

  const dataTym = await SheetsDB.readValues(config.sheets.tymershiftId, config.tabs.tymershift);
  const headers = dataTym[0] || [];
  const idxAgente = headers.findIndex((h) => String(h).trim().toLowerCase() === 'agente');
  const idxDia = headers.findIndex((h) => String(h).trim().toLowerCase() === 'dia');
  if (idxAgente === -1 || idxDia === -1) return { hcMatrixFull, hcMatrixLiquid, hcEscaladoFull, hcEscaladoLiquid };

  const colHora = (token) => headers.findIndex((x) => typeof x === 'string' && x.includes(token));
  const idxM1 = [];
  const idxM2 = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    idxM1.push(colHora(`${hh}:00`));
    idxM2.push(colHora(`${hh}:30`));
  }
  const cell = (row, idx) => (idx < 0 ? '' : String(row[idx] || '').toLowerCase());

  const diasUnicosPorWd = Array.from({ length: 7 }, () => new Set());
  const totalAgentesFull = new Set();
  const totalAgentesLiquid = new Set();

  for (let i = 1; i < dataTym.length; i++) {
    const row = dataTym[i] || [];
    const email = String(row[idxAgente] ?? '').trim().toLowerCase();
    if (!teamAllowed(mapping.emailParaEquipe[email], isAllTeams, allowedTeams)) continue;

    const dMs = parseDateMs(row[idxDia]);
    if (!dMs) continue;

    const wd = new Date(dMs).getUTCDay();
    diasUnicosPorWd[wd].add(dMs);

    const isAusente = agentesAusentes.has(email);
    let isActiveShift = false;

    for (let h = 0; h < 24; h++) {
      const isProd1 = isProdutivo(cell(row, idxM1[h]));
      const isProd2 = isProdutivo(cell(row, idxM2[h]));
      if (isProd1 || isProd2) {
        const val = (isProd1 ? 0.5 : 0) + (isProd2 ? 0.5 : 0);
        hcMatrixFull[wd][h] += val;
        if (!isAusente) hcMatrixLiquid[wd][h] += val;
        isActiveShift = true;
      }
    }
    if (isActiveShift) {
      totalAgentesFull.add(email);
      if (!isAusente) totalAgentesLiquid.add(email);
    }
  }

  let sumFullHC = 0;
  let sumLiquidHC = 0;
  let countValidDays = 0;

  for (let w = 0; w < 7; w++) {
    const diasNoMes = diasUnicosPorWd[w].size || 1;
    let sumSlotsFull = 0;
    let sumSlotsLiquid = 0;

    for (let h = 0; h < 24; h++) {
      hcMatrixFull[w][h] /= diasNoMes;
      hcMatrixLiquid[w][h] /= diasNoMes;
      sumSlotsFull += hcMatrixFull[w][h];
      sumSlotsLiquid += hcMatrixLiquid[w][h];
    }

    const hcMedioDiaFull = sumSlotsFull / 7.5;
    const hcMedioDiaLiquid = sumSlotsLiquid / 7.5;
    if (hcMedioDiaFull > 0) {
      sumFullHC += hcMedioDiaFull;
      sumLiquidHC += hcMedioDiaLiquid;
      countValidDays++;
    }
  }

  hcEscaladoFull = countValidDays > 0 ? sumFullHC / countValidDays : totalAgentesFull.size;
  hcEscaladoLiquid = countValidDays > 0 ? sumLiquidHC / countValidDays : totalAgentesLiquid.size;

  return { hcMatrixFull, hcMatrixLiquid, hcEscaladoFull, hcEscaladoLiquid };
}

async function getSimulationBaseline(mesesFiltro, selectedTeams, isAllTeams, mapping, agentesAusentes) {
  const allowedTeams = new Set(selectedTeams);
  const ausentes = new Set(agentesAusentes);

  const [feriados, demanda, capacidade] = await Promise.all([
    loadFeriados(),
    loadDemanda(mesesFiltro, mapping, isAllTeams, allowedTeams),
    loadCapacidade(mapping, isAllTeams, allowedTeams, ausentes),
  ]);
  const { baseData, tmo } = demanda;

  const nowMs = Date.now();
  const limitMs = nowMs - mesesFiltro * 30 * DAY_MS;
  const profS = buildForecastProfile(baseData.filter((d) => d.type === 'SYNC'), limitMs, nowMs, feriados);
  const profA = buildForecastProfile(baseData.filter((d) => d.type === 'ASYNC'), limitMs, nowMs, feriados);

  // Distribuição horária por dia da semana
  const distS = matrix7x24();
  const distA = matrix7x24();
  const sumsS = new Array(7).fill(0);
  const sumsA = new Array(7).fill(0);
  baseData.forEach((d) => {
    const wd = new Date(d.dateMs).getUTCDay();
    if (d.hour < 0 || d.hour > 23) return;
    if (d.type === 'SYNC') {
      distS[wd][d.hour] += d.tickets;
      sumsS[wd] += d.tickets;
    } else {
      distA[wd][d.hour] += d.tickets;
      sumsA[wd] += d.tickets;
    }
  });
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      distS[w][h] = sumsS[w] ? distS[w][h] / sumsS[w] : 1 / 24;
      distA[w][h] = sumsA[w] ? distA[w][h] / sumsA[w] : 1 / 24;
    }
  }

  return {
    ...capacidade,
    tmoSync: tmo.tckS > 0 ? tmo.tsS / tmo.tckS : 15,
    tmoAsync: tmo.tckA > 0 ? tmo.tsA / tmo.tckA : 10,
    profS,
    profA,
    distS,
    distA,
  };
}

module.exports = { getSimulationBaseline };
