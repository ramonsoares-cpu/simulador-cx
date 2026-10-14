const express = require('express');
const HttpError = require('../lib/HttpError');
const { getInitialData } = require('../services/hierarchy');
const { runSimulation } = require('../services/simulation');

const router = express.Router();

function toInt(value, name, { min, max, def }) {
  if (value === undefined || value === null || value === '') return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `Parâmetro "${name}" inválido: esperado inteiro entre ${min} e ${max}.`);
  }
  return n;
}

function toStringList(value, name) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 5000 || value.some((v) => typeof v !== 'string')) {
    throw new HttpError(400, `Parâmetro "${name}" inválido: esperado lista de textos.`);
  }
  return value;
}

function validateParams(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }

  const volumetria = body.volumetria === undefined || body.volumetria === '' ? 0 : Number(body.volumetria);
  if (!Number.isFinite(volumetria) || volumetria < -100 || volumetria > 1000) {
    throw new HttpError(400, 'Parâmetro "volumetria" inválido: esperado número entre -100 e 1000.');
  }

  return {
    periodo: toInt(body.periodo, 'periodo', { min: 1, max: 24, def: 3 }),
    isAllTeams: body.isAllTeams === true,
    selectedTeams: toStringList(body.selectedTeams, 'selectedTeams'),
    agentesAusentes: toStringList(body.agentesAusentes, 'agentesAusentes').map((e) => e.trim().toLowerCase()),
    volumetria,
    hcBaseManual: toInt(body.hcBaseManual, 'hcBaseManual', { min: 0, max: 100000, def: 0 }),
    ferias: toInt(body.ferias, 'ferias', { min: 0, max: 100000, def: 0 }),
    atestados: toInt(body.atestados, 'atestados', { min: 0, max: 100000, def: 0 }),
    afastamentos: toInt(body.afastamentos, 'afastamentos', { min: 0, max: 100000, def: 0 }),
    faltas: toInt(body.faltas, 'faltas', { min: 0, max: 100000, def: 0 }),
  };
}

// Substitui google.script.run.getInitialData()
router.get('/initial-data', async (req, res) => {
  const { hierarquia, listaAgentes } = await getInitialData();
  res.json({ hierarquia, listaAgentes });
});

// Substitui google.script.run.runSimulation(params)
router.post('/run', async (req, res) => {
  res.json(await runSimulation(validateParams(req.body)));
});

module.exports = router;
