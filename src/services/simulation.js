const { getInitialData } = require('./hierarchy');
const { getSimulationBaseline } = require('./baseline');

const OCUPACAO_FATOR = 0.6;
const CONCORRENCIA_SYNC = 2;
const CONCORRENCIA_ASYNC = 1;

/**
 * Motor da simulação (Erlang simplificado). `params` já chega validado por routes/simulador.js.
 */
async function runSimulation(params) {
  const { periodo, selectedTeams, isAllTeams, agentesAusentes, hcBaseManual, volumetria } = params;
  const perdasAvulsas = params.ferias + params.atestados + params.afastamentos + params.faltas;

  const mapping = await getInitialData();
  const base = await getSimulationBaseline(periodo, selectedTeams, isAllTeams, mapping, agentesAusentes);

  // Razão de escala: redistribui as horas do Tymershift para o HC Base informado manualmente
  let ratioEscalaFull = base.hcEscaladoFull > 0 ? hcBaseManual / base.hcEscaladoFull : 1;
  let ratioEscalaLiquid = base.hcEscaladoFull > 0 ? Math.max(0, hcBaseManual - perdasAvulsas) / base.hcEscaladoFull : 1;

  // HC líquido exibido = base - perda nominal (agentes ausentes lidos da escala) - perdas genéricas
  const perdaNominal = base.hcEscaladoFull - base.hcEscaladoLiquid;
  const hcLiquidoTotalVisor = Math.max(0, Math.round(hcBaseManual - perdaNominal - perdasAvulsas));

  if (base.hcEscaladoFull === 0 && hcBaseManual > 0) {
    ratioEscalaFull = 1;
    ratioEscalaLiquid = 1;
  }

  const multPico = 1 + volumetria / 100;
  const matrixDelta = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const chartData = {
    demanda: new Array(24).fill(0),
    capBase: new Array(24).fill(0),
    capLiquid: new Array(24).fill(0),
  };

  let globalDemandaMinutos = 0;
  let globalCapacidadeMinutos = 0;
  let volTotalBase = 0;
  let volTotalSimulado = 0;

  for (let wd = 0; wd < 7; wd++) {
    const volSyncBase = base.profS.wdAvg[wd];
    const volAsyncBase = base.profA.wdAvg[wd];

    for (let h = 0; h < 24; h++) {
      const vS = volSyncBase * base.distS[wd][h] * multPico;
      const vA = volAsyncBase * base.distA[wd][h] * multPico;

      volTotalBase += volSyncBase * base.distS[wd][h] + volAsyncBase * base.distA[wd][h];
      volTotalSimulado += vS + vA;

      const reqS = (vS * (base.tmoSync / 60)) / CONCORRENCIA_SYNC / OCUPACAO_FATOR;
      const reqA = (vA * (base.tmoAsync / 60)) / CONCORRENCIA_ASYNC / OCUPACAO_FATOR;
      const hcNecessarioHora = reqS + reqA;

      let capFullH = base.hcMatrixFull[wd][h] * ratioEscalaFull;
      let capLiquidaH = base.hcMatrixLiquid[wd][h] * ratioEscalaLiquid;

      if (base.hcEscaladoFull === 0) {
        capFullH = h >= 8 && h <= 18 ? hcBaseManual / 11 : 0;
        capLiquidaH = h >= 8 && h <= 18 ? hcLiquidoTotalVisor / 11 : 0;
      }

      chartData.demanda[h] += vS + vA;
      chartData.capBase[h] += capFullH * 3;
      chartData.capLiquid[h] += capLiquidaH * 3;

      const esforcoMinutosH = (vS * base.tmoSync) / CONCORRENCIA_SYNC + (vA * base.tmoAsync) / CONCORRENCIA_ASYNC;
      const capProdutivaMinutosH = capLiquidaH * 60 * OCUPACAO_FATOR;

      globalDemandaMinutos += esforcoMinutosH;
      globalCapacidadeMinutos += capProdutivaMinutosH;

      matrixDelta[wd][h] = Math.round(capLiquidaH - hcNecessarioHora);
    }
  }

  for (let h = 0; h < 24; h++) {
    chartData.demanda[h] = Math.round(chartData.demanda[h] / 7);
    chartData.capBase[h] = Math.round(chartData.capBase[h] / 7);
    chartData.capLiquid[h] = Math.round(chartData.capLiquid[h] / 7);
  }

  const backlogMinutos = Math.max(0, globalDemandaMinutos - globalCapacidadeMinutos);
  const tmoPond = volTotalSimulado > 0 ? globalDemandaMinutos / volTotalSimulado : 12;
  const backlogTickets = Math.floor(backlogMinutos / tmoPond);

  return {
    status: 'success',
    kpis: {
      volBase: Math.round(volTotalBase / 7),
      volSimulado: Math.round(volTotalSimulado / 7),
      slaSimulado: Math.round(Math.min(100, (globalCapacidadeMinutos / (globalDemandaMinutos || 1)) * 100)),
      hcBase: Math.round(hcBaseManual),
      hcSimulado: Math.round(hcLiquidoTotalVisor),
      backlog: Math.round(backlogTickets / 7),
    },
    chartData,
    deltaMatrix: matrixDelta,
    financeiro: { custoHE: 'Em breve', custoBPO: 'Em breve', horasZerar: Math.round(backlogMinutos / 60 / 7) },
  };
}

module.exports = { runSimulation };
