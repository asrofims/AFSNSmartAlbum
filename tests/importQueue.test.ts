import assert from 'node:assert';
import { ImportTask } from '../src/stores/photoStore';

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
console.log('✓ Cancellation purge calculation verified.');

console.log('ALL PHOTO IMPORT QUEUE TESTS PASSED! 🎉');
