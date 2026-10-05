import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import createConfig from '../vite.config.js';

function configWithoutEnvFile(target) {
  const previousDirectory = process.cwd();
  const previousTarget = process.env.API_PROXY_TARGET;
  const directory = mkdtempSync(join(tmpdir(), 'bangtray-dev-config-'));
  try {
    process.chdir(directory);
    if (target === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = target;
    return createConfig({ mode: 'development' });
  } finally {
    process.chdir(previousDirectory);
    if (previousTarget === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = previousTarget;
    rmdirSync(directory);
  }
}

test('a checkout without a local env file routes API requests to the local backend', () => {
  const config = configWithoutEnvFile();
  assert.equal(config.server.proxy['/api'].target, 'http://localhost:8080');
  assert.equal(config.server.proxy['/api'].changeOrigin, true);
});

test('development binds the backend-allowed origin and cannot silently switch ports', () => {
  const config = configWithoutEnvFile();
  assert.equal(config.server.host, 'localhost');
  assert.equal(config.server.port, 5173);
  assert.equal(config.server.strictPort, true);
});

test('an explicit API target still overrides the local default', () => {
  const config = configWithoutEnvFile('https://test-backend.example');
  assert.equal(config.server.proxy['/api'].target, 'https://test-backend.example');
});

test('server-relative image requests use the local backend instead of the SPA fallback', () => {
  const config = configWithoutEnvFile();
  assert.equal(config.server.proxy['/images/']?.target, 'http://localhost:8080');
  assert.equal(config.server.proxy['/images/']?.changeOrigin, true);
});

test('image requests follow an explicit backend target alongside API requests', () => {
  const config = configWithoutEnvFile('https://test-backend.example');
  assert.equal(config.server.proxy['/images/']?.target, 'https://test-backend.example');
});
