require('dotenv').config();

const { config, validateEnv } = require('./config');
const { createApp } = require('./app');

try {
  validateEnv();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`Simulador CX ouvindo em 0.0.0.0:${config.port}`);
});
