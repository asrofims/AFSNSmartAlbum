import assert from 'node:assert/strict';
import {
  DEFAULT_APP_PREFERENCES,
  normalizeAppPreferences,
} from '../src/domain/appPreferences';

const defaults = normalizeAppPreferences(null);
assert.deepEqual(defaults, DEFAULT_APP_PREFERENCES);

const normalized = normalizeAppPreferences({
  startupBehavior: 'reopen_last',
  autoSaveEnabled: false,
  autoSaveIntervalSeconds: 300,
  automaticUpdateChecks: false,
});
assert.deepEqual(normalized, {
  startupBehavior: 'reopen_last',
  autoSaveEnabled: false,
  autoSaveIntervalSeconds: 300,
  automaticUpdateChecks: false,
});

const invalid = normalizeAppPreferences({
  startupBehavior: 'unknown',
  autoSaveEnabled: 'yes',
  autoSaveIntervalSeconds: 12,
  automaticUpdateChecks: 1,
});
assert.deepEqual(invalid, DEFAULT_APP_PREFERENCES);

console.log('App preference tests passed');
