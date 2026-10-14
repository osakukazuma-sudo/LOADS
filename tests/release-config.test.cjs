const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ignore = require('ignore');
test('v1.1 release preserves remote numbering and excludes only local artifacts from required inputs', () => {
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(app.version, '1.1.0');
  assert.equal(app.ios.bundleIdentifier, 'com.gyuta.loads');
  assert.equal(Object.hasOwn(app.ios, 'buildNumber'), false);
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.build.production.environment, 'production');
  const rules = ignore().add(fs.readFileSync(fs.existsSync('.easignore') ? '.easignore' : '.gitignore', 'utf8'));
  for (const file of ['tmp/check.txt', 'output/report.pdf', 'coverage/report.html', '.env', 'credentials.json', 'dist/export/metadata.json']) assert.equal(rules.ignores(file), true, file);
  for (const file of ['app.json', 'app.config.js', 'eas.json', 'package.json', 'package-lock.json', 'src/lib/postPhotoFiles.ts', 'scripts/validate-public-env.cjs', app.icon.replace('./', '')]) {
    assert.equal(fs.existsSync(file), true, file);
    assert.equal(rules.ignores(file), false, file);
  }
});

test('optional activity diagnostics setting rejects malformed flags without exposing values', () => {
  const { validatePublicEnv } = require('../scripts/validate-public-env.cjs');
  for (const value of [undefined, 'true', 'false']) assert.doesNotThrow(() => validatePublicEnv({ EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS: value }));
  assert.throws(() => validatePublicEnv({ EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS: 'invalid-sensitive-value' }), error => /diagnostics flag/.test(error.message) && !error.message.includes('invalid-sensitive-value'));
});
