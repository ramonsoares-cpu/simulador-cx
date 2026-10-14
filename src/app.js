const path = require('path');
const express = require('express');
const { authenticate } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const simuladorRouter = require('./routes/simulador');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VENDOR_CHARTJS = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Antes de qualquer autenticação; instantâneo e sem tocar em Sheets/APIs externas.
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.use(authenticate);
  app.use(express.json({ limit: '1mb' }));

  app.use('/vendor/chart.js', express.static(VENDOR_CHARTJS, { index: false, redirect: false }));
  app.use(express.static(PUBLIC_DIR, { index: false, redirect: false }));

  app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
  app.use('/api/simulador', simuladorRouter);

  app.use('/api', (req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
  app.use((req, res) => res.status(404).type('text/plain').send('Página não encontrada.'));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
