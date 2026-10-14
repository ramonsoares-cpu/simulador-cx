const HttpError = require('../lib/HttpError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // JSON inválido no corpo
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ message: 'JSON inválido.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Requisição grande demais.' });
  }

  const known = err instanceof HttpError;
  const status = known ? err.status : 500;
  if (status >= 500) console.error(`[erro] ${req.method} ${req.originalUrl}:`, err);

  res.status(status).json({ message: known ? err.message : 'Erro interno do servidor.' });
}

module.exports = errorHandler;
