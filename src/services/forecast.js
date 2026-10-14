const { pad } = require('../lib/dates');

const DAY_MS = 24 * 60 * 60 * 1000;
// Pesos da média móvel ponderada (do mais antigo ao mais recente das últimas 6 ocorrências)
const WMA_WEIGHTS = [1, 2, 3, 5, 8, 13];

/**
 * Perfil de previsão por dia da semana (média móvel ponderada) no intervalo [startMs, endMs],
 * ignorando feriados. Dias sem registro contam como volume 0.
 */
function buildForecastProfile(dataArray, startMs, endMs, feriados) {
  const dailyVol = {};
  dataArray.forEach((d) => {
    if (d.dateMs >= startMs && d.dateMs <= endMs) {
      dailyVol[d.dateMs] = (dailyVol[d.dateMs] || 0) + d.tickets;
    }
  });

  const wdVolumes = Array.from({ length: 7 }, () => []);

  const cur = new Date(startMs);
  cur.setUTCHours(12, 0, 0, 0);
  while (cur.getTime() <= endMs) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    const day = cur.getUTCDate();
    const ms = Date.UTC(y, m, day, 3, 0, 0);
    const dateStr = `${y}-${pad(m + 1)}-${pad(day)}`;

    if (!feriados.has(dateStr)) {
      wdVolumes[cur.getUTCDay()].push(dailyVol[ms] || 0);
    }
    cur.setTime(cur.getTime() + DAY_MS);
  }

  const wdAvg = new Array(7).fill(0);
  for (let i = 0; i < 7; i++) {
    const vols = wdVolumes[i];
    if (vols.length === 0) {
      wdAvg[i] = 0;
    } else if (vols.length <= 2) {
      wdAvg[i] = vols.reduce((a, b) => a + b, 0) / vols.length;
    } else {
      const recent = vols.slice(-6);
      let sumWeights = 0;
      let weightedSum = 0;
      for (let j = 0; j < recent.length; j++) {
        weightedSum += recent[j] * WMA_WEIGHTS[j];
        sumWeights += WMA_WEIGHTS[j];
      }
      wdAvg[i] = weightedSum / sumWeights;
    }
  }

  return { wdAvg };
}

module.exports = { buildForecastProfile };
