const { config } = require('../config');

/**
 * Autenticação: o ingress valida a sessão e injeta o e-mail em X-Auth-Request-Email
 * (substitui Session.getActiveUser().getEmail()). DEV_USER_EMAIL só vale fora de produção.
 */
function authenticate(req, res, next) {
  let email = String(req.get('X-Auth-Request-Email') || '').trim().toLowerCase();
  if (!email && !config.isProduction) {
    email = String(process.env.DEV_USER_EMAIL || '').trim().toLowerCase();
  }

  if (!email) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    return res.status(401).type('text/plain').send('Usuário não autenticado.');
  }

  req.user = { email };
  next();
}

module.exports = { authenticate };
