import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGoogleClientId } from '../src/config/public-config.mjs';

test('Google login is unconfigured without an explicit client ID', () => {
  assert.equal(resolveGoogleClientId(), '');
});

test('empty environment values keep Google login unconfigured', () => {
  for (const value of ['', '   ']) {
    assert.equal(resolveGoogleClientId(value), '');
  }
});

test('an explicit public client ID overrides the default after trimming', () => {
  assert.equal(resolveGoogleClientId('  123-test.apps.googleusercontent.com  '), '123-test.apps.googleusercontent.com');
});
