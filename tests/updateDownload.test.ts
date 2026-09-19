import assert from 'node:assert';
import { formatBytes, startUpdateDownload, setMockTauriUpdate, isAutoUpdateDownloading } from '../src/services/updateService';
import { useAppStore } from '../src/stores/appStore';

console.log('Testing Background Update Downloader & Global State Tracking...');

// Test 1: formatBytes helper utility
console.log('  Testing formatBytes...');
assert.strictEqual(formatBytes(0), '0 MB');
assert.strictEqual(formatBytes(-100), '0 MB');
assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
assert.strictEqual(formatBytes(1024 * 1024 * 15.5), '15.5 MB');
assert.strictEqual(formatBytes(52428800), '50.0 MB');

// Test 2: AppStore updateProgress percent calculations
console.log('  Testing updateProgress percent calculations...');
const store = useAppStore.getState();

store.setUpdateProgress(0, 0);
assert.strictEqual(useAppStore.getState().updateProgress.percent, 0);

store.setUpdateProgress(25, 100);
assert.strictEqual(useAppStore.getState().updateProgress.percent, 25);
assert.strictEqual(useAppStore.getState().updateProgress.downloadedBytes, 25);
assert.strictEqual(useAppStore.getState().updateProgress.totalBytes, 100);

store.setUpdateProgress(150, 100);
assert.strictEqual(useAppStore.getState().updateProgress.percent, 100); // Clamped to 100

// Test 3: Background notice dismissal and reset
console.log('  Testing notice dismissal and reset...');
assert.strictEqual(useAppStore.getState().isBackgroundNoticeDismissed, false);
useAppStore.getState().dismissBackgroundNotice();
assert.strictEqual(useAppStore.getState().isBackgroundNoticeDismissed, true);
useAppStore.getState().resetBackgroundNotice();
assert.strictEqual(useAppStore.getState().isBackgroundNoticeDismissed, false);

// Test 4: startUpdateDownload successful execution with mock
async function testSuccessfulDownload() {
  console.log('  Testing startUpdateDownload success lifecycle...');
  let onProgressCallback: any = null;

  const mockUpdate: any = {
    version: '1.0.70',
    downloadAndInstall: async (onEvent: any) => {
      onProgressCallback = onEvent;
      // Emit initial chunk
      onEvent({ event: 'Started', data: { contentLength: 2000 } });
      onEvent({ event: 'Progress', data: { chunkLength: 1000 } });
      onEvent({ event: 'Finished' });
    },
  };

  setMockTauriUpdate(mockUpdate);

  const downloadPromise = startUpdateDownload();
  assert.strictEqual(isAutoUpdateDownloading(), true);
  assert.strictEqual(useAppStore.getState().updateStatus, 'downloading');

  // Concurrency check: startUpdateDownload called again returns the exact same promise
  const secondCallPromise = startUpdateDownload();
  assert.strictEqual(downloadPromise, secondCallPromise);

  await downloadPromise;

  assert.strictEqual(isAutoUpdateDownloading(), false);
  assert.strictEqual(useAppStore.getState().updateStatus, 'ready');
  assert.strictEqual(useAppStore.getState().updateProgress.percent, 100);
  assert.strictEqual(useAppStore.getState().isBackgroundNoticeDismissed, false);
}

// Test 5: startUpdateDownload error handling
async function testFailedDownload() {
  console.log('  Testing startUpdateDownload error handling...');
  const mockFailingUpdate: any = {
    version: '1.0.70',
    downloadAndInstall: async () => {
      throw new Error('Network timeout during package signature verification');
    },
  };

  setMockTauriUpdate(mockFailingUpdate);

  try {
    await startUpdateDownload();
    assert.fail('Expected startUpdateDownload to throw');
  } catch (err: any) {
    assert.ok(err.message.includes('signature verification'));
  }

  assert.strictEqual(isAutoUpdateDownloading(), false);
  assert.strictEqual(useAppStore.getState().updateStatus, 'error');
  assert.ok(useAppStore.getState().updateError?.includes('signature verification'));
  assert.strictEqual(useAppStore.getState().isBackgroundNoticeDismissed, false);
}

async function runAll() {
  await testSuccessfulDownload();
  await testFailedDownload();
  setMockTauriUpdate(null);
  console.log('All Background Update Downloader tests passed successfully! ✓');
}

runAll().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
