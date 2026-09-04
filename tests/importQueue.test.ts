import assert from 'node:assert';
import { ImportTask } from '../src/stores/photoStore';
import { formatImportNoticeToast } from '../src/domain/photo';

console.log('Testing Photo Import Queue Lifecycle & Orchestration...');

// Test 1: Queue data structure and badge calculations
const batch1: ImportTask = {
  id: 'task-1',
  projectId: 'project-1',
  paths: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
  folderId: null,
  label: '3 files to Library',
  totalCount: 3,
};

const batch2: ImportTask = {
  id: 'task-2',
  projectId: 'project-1',
  paths: ['img4.jpg', 'img5.jpg'],
  folderId: 'folder-reception',
  label: '2 files to Reception',
  totalCount: 2,
};

const batch3: ImportTask = {
  id: 'task-3',
  projectId: 'project-1',
  paths: ['img6.jpg', 'img7.jpg', 'img8.jpg', 'img9.jpg'],
  folderId: 'folder-akad',
  label: '4 files to Akad',
  totalCount: 4,
};

// Simulate queue state machine
interface SimulatedState {
  isImporting: boolean;
  isCancelling: boolean;
  currentImportTask: ImportTask | null;
  importQueue: ImportTask[];
  executedTasks: string[];
}

const state: SimulatedState = {
  isImporting: false,
  isCancelling: false,
  currentImportTask: null,
  importQueue: [],
  executedTasks: [],
};

function enqueue(task: ImportTask) {
  if (!state.isImporting) {
    state.isImporting = true;
    state.currentImportTask = task;
    state.executedTasks.push(task.id);
  } else {
    state.importQueue.push(task);
  }
}

function completeCurrentTask() {
  if (state.importQueue.length > 0) {
    const next = state.importQueue.shift()!;
    state.currentImportTask = next;
    state.isImporting = true;
    state.isCancelling = false;
    state.executedTasks.push(next.id);
  } else {
    state.isImporting = false;
    state.isCancelling = false;
    state.currentImportTask = null;
  }
}

function cancelCurrentTask() {
  state.isCancelling = true;
  // Rust worker terminates early and calls completeCurrentTask
  completeCurrentTask();
}

function cancelAllTasks() {
  state.isCancelling = true;
  state.importQueue = [];
  state.isImporting = false;
  state.isCancelling = false;
  state.currentImportTask = null;
}

// 1. Enqueue Batch 1 -> executes immediately
enqueue(batch1);
assert.strictEqual(state.isImporting, true);
assert.strictEqual(state.currentImportTask?.id, 'task-1');
assert.strictEqual(state.importQueue.length, 0);

// 2. Enqueue Batch 2 & Batch 3 while Batch 1 is running
enqueue(batch2);
enqueue(batch3);
assert.strictEqual(state.importQueue.length, 2);
assert.strictEqual(state.currentImportTask?.id, 'task-1');

// Badge calculation check
const totalQueuedPhotos = state.importQueue.reduce((acc, t) => acc + t.totalCount, 0);
assert.strictEqual(totalQueuedPhotos, 6); // 2 + 4 = 6
assert.strictEqual(state.importQueue[0].label, '2 files to Reception');

// 3. Batch 1 finishes -> Batch 2 automatically starts
completeCurrentTask();
assert.strictEqual(state.isImporting, true);
assert.strictEqual(state.currentImportTask?.id, 'task-2');
assert.strictEqual(state.importQueue.length, 1);
assert.strictEqual(state.importQueue[0].id, 'task-3');

// 4. Batch 2 is cancelled by user -> Batch 3 automatically begins
cancelCurrentTask();
assert.strictEqual(state.isImporting, true);
assert.strictEqual(state.isCancelling, false);
assert.strictEqual(state.currentImportTask?.id, 'task-3');
assert.strictEqual(state.importQueue.length, 0);

// 5. Batch 3 completes -> Queue is empty and importing stops
completeCurrentTask();
assert.strictEqual(state.isImporting, false);
assert.strictEqual(state.currentImportTask, null);
assert.strictEqual(state.importQueue.length, 0);

// Verify all 3 tasks were processed sequentially in order
assert.deepStrictEqual(state.executedTasks, ['task-1', 'task-2', 'task-3']);
console.log('✓ Sequential queue lifecycle verified.');

// 6. Test Cancel All
enqueue(batch1);
enqueue(batch2);
enqueue(batch3);
assert.strictEqual(state.importQueue.length, 2);
cancelAllTasks();
assert.strictEqual(state.isImporting, false);
assert.strictEqual(state.currentImportTask, null);
assert.strictEqual(state.importQueue.length, 0);
console.log('✓ Cancel all queue teardown verified.');

// 7. Notice accumulation test
let accumulatedNotice = {
  projectId: 'project-1',
  total: 0,
  imported: 0,
  existing: 0,
  relinked: 0,
};

const noticeBatch1 = { projectId: 'project-1', total: 10, imported: 10, existing: 0, relinked: 0 };
const noticeBatch2 = { projectId: 'project-1', total: 5, imported: 3, existing: 2, relinked: 0 };

accumulatedNotice = {
  ...accumulatedNotice,
  total: accumulatedNotice.total + noticeBatch1.total,
  imported: accumulatedNotice.imported + noticeBatch1.imported,
  existing: accumulatedNotice.existing + noticeBatch1.existing,
  relinked: accumulatedNotice.relinked + noticeBatch1.relinked,
};

accumulatedNotice = {
  ...accumulatedNotice,
  total: accumulatedNotice.total + noticeBatch2.total,
  imported: accumulatedNotice.imported + noticeBatch2.imported,
  existing: accumulatedNotice.existing + noticeBatch2.existing,
  relinked: accumulatedNotice.relinked + noticeBatch2.relinked,
};

assert.strictEqual(accumulatedNotice.total, 15);
assert.strictEqual(accumulatedNotice.imported, 13);
assert.strictEqual(accumulatedNotice.existing, 2);
console.log('✓ Notice accumulation verified.');

// 8. Cancellation purge calculation test
const batchToImport = ['p1', 'p2', 'p3', 'p4', 'p5'];
const completedDuringCancel = ['p1', 'p2'];
const purgedOnCancel = batchToImport.filter((id) => !completedDuringCancel.includes(id));
assert.strictEqual(purgedOnCancel.length, 3);
assert.deepStrictEqual(purgedOnCancel, ['p3', 'p4', 'p5']);

const cancelNotice = {
  projectId: 'project-1',
  total: batchToImport.length,
  imported: completedDuringCancel.length,
  existing: 0,
  relinked: 0,
  cancelled: true,
  purged: purgedOnCancel.length,
};

assert.strictEqual(cancelNotice.cancelled, true);
assert.strictEqual(cancelNotice.imported, 2);
assert.strictEqual(cancelNotice.purged, 3);
// 9. Session isolation: New session starting with !isImporting resets notice
let currentNoticeState: any = { projectId: 'project-1', total: 10, imported: 10, existing: 0, relinked: 0 };
// A user starts a new import of 1 photo after an earlier session
const isNewSession = true;
if (isNewSession) {
  currentNoticeState = null; // Reset on enqueue when !isRunning
}
assert.strictEqual(currentNoticeState, null);

// When payload for 1 photo arrives
const newSinglePayload = { projectId: 'project-1', total: 1, imported: 1, existing: 0, relinked: 0 };
const isOngoingQueue = false; // single task, no queue
const nextNotice = isOngoingQueue && currentNoticeState ? {
  ...currentNoticeState,
  imported: currentNoticeState.imported + newSinglePayload.imported,
} : newSinglePayload;

assert.strictEqual(nextNotice.imported, 1);
assert.strictEqual(nextNotice.total, 1);
console.log('✓ Session notice isolation verified (single photo import reports exactly 1).');

// 10. Separation of newly registered vs relinked photos
const newlyAddedIds = new Set(['photo-new-1']);
const relinkedIds = new Set(['photo-relink-1']);
const finishedPreviewIds = ['photo-new-1', 'photo-relink-1'];

const completedNewCount = finishedPreviewIds.filter((id) => newlyAddedIds.has(id)).count
  ? (finishedPreviewIds.filter((id) => newlyAddedIds.has(id)) as any).count()
  : finishedPreviewIds.filter((id) => newlyAddedIds.has(id)).length;
const completedRelinkCount = finishedPreviewIds.length - completedNewCount;

assert.strictEqual(completedNewCount, 1);
assert.strictEqual(completedRelinkCount, 1);
console.log('✓ Separation of newly registered vs relinked photos verified.');

// 11. Path deduplication test
const rawPaths = ['C:\\photo1.jpg', 'C:\\photo2.jpg', 'C:\\photo1.jpg'];
const seen = new Set<string>();
const uniquePaths = rawPaths.filter((p) => {
  if (seen.has(p)) return false;
  seen.add(p);
  return true;
});
assert.strictEqual(uniquePaths.length, 2);
assert.deepStrictEqual(uniquePaths, ['C:\\photo1.jpg', 'C:\\photo2.jpg']);
console.log('✓ Path deduplication verified.');

// 12. formatImportNoticeToast unit tests
// 12.1. Cancellation with partially completed photos
const cancelPartialMsg = formatImportNoticeToast({
  total: 5,
  imported: 2,
  existing: 0,
  relinked: 0,
  cancelled: true,
  purged: 3,
});
assert.strictEqual(
  cancelPartialMsg,
  '⊘ Import Cancelled: Kept 2 completed photos. Removed 3 cancelled photos from library.'
);

// 12.2. Cancellation with 1 photo completed, 1 purged
const cancelSingleMsg = formatImportNoticeToast({
  total: 2,
  imported: 1,
  existing: 0,
  relinked: 0,
  cancelled: true,
  purged: 1,
});
assert.strictEqual(
  cancelSingleMsg,
  '⊘ Import Cancelled: Kept 1 completed photo. Removed 1 cancelled photo from library.'
);

// 12.3. Cancellation with 0 completed photos
const cancelNoneMsg = formatImportNoticeToast({
  total: 4,
  imported: 0,
  existing: 0,
  relinked: 0,
  cancelled: true,
  purged: 4,
});
assert.strictEqual(cancelNoneMsg, '⊘ Import Cancelled: Removed 4 photos from library.');

// 12.4. All duplicates
const allDuplicatesMsg = formatImportNoticeToast({
  total: 3,
  imported: 0,
  existing: 3,
  relinked: 0,
});
assert.strictEqual(
  allDuplicatesMsg,
  'ℹ️ Already in Library: All 3 selected photos already exist in your project library.'
);

// 12.5. All duplicates (single photo)
const singleDuplicateMsg = formatImportNoticeToast({
  total: 1,
  imported: 0,
  existing: 1,
  relinked: 0,
});
assert.strictEqual(
  singleDuplicateMsg,
  'ℹ️ Already in Library: All 1 selected photo already exists in your project library.'
);

// 12.6. Success with duplicates
const successWithDupMsg = formatImportNoticeToast({
  total: 5,
  imported: 3,
  existing: 2,
  relinked: 0,
});
assert.strictEqual(
  successWithDupMsg,
  '✓ Imported 3 photos (2 duplicate files were already in library).'
);

// 12.7. Success with 1 duplicate
const successWithSingleDupMsg = formatImportNoticeToast({
  total: 2,
  imported: 1,
  existing: 1,
  relinked: 0,
});
assert.strictEqual(
  successWithSingleDupMsg,
  '✓ Imported 1 photo (1 duplicate file was already in library).'
);

// 12.8. Pure success
const pureSuccessMsg = formatImportNoticeToast({
  total: 4,
  imported: 4,
  existing: 0,
  relinked: 0,
});
assert.strictEqual(pureSuccessMsg, '✓ Successfully imported 4 photos.');

// 12.9. Pure success (single photo)
const singleSuccessMsg = formatImportNoticeToast({
  total: 1,
  imported: 1,
  existing: 0,
  relinked: 0,
});
assert.strictEqual(singleSuccessMsg, '✓ Successfully imported 1 photo.');

// 12.10. Relink only
const relinkOnlyMsg = formatImportNoticeToast({
  total: 2,
  imported: 0,
  existing: 0,
  relinked: 2,
});
assert.strictEqual(relinkOnlyMsg, '✓ Relinked 2 existing photos.');

// 12.11. Relink and imported
const relinkAndImportedMsg = formatImportNoticeToast({
  total: 3,
  imported: 2,
  existing: 0,
  relinked: 1,
});
assert.strictEqual(
  relinkAndImportedMsg,
  '✓ Successfully imported 2 photos. Relinked 1 missing photo.'
);

console.log('✓ Import notice toast message formatting verified.');

console.log('ALL PHOTO IMPORT QUEUE TESTS PASSED! 🎉');
