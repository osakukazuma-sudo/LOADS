const { validatePublicEnv } = require('./scripts/validate-public-env.cjs');

module.exports = ({ config }) => {
  validatePublicEnv(process.env, process.env.EAS_BUILD === 'true');
  return config;
};
