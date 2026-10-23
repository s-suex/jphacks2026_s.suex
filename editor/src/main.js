import {
  TILE_SIZE,
  isPlayableTile,
  validateStage,
} from '@shortcut-dungeon/stage-schema';
import {
  clearDraft,
  copyStageToClipboard,
  loadDraft,
  readStageFile,
  saveDraft,
  saveStageFile,
} from './io/stage-io.js';
import { renderEditor } from './render/render-editor.js';
import { ITEM_LABELS, occupancyLabel } from './state/model.js';
import EditorStore from './state/store.js';

const TOOL_KEYS = {
  '1': 'select',
  '2': 'wall',
  '3': 'erase',
  '4': 'start',
  '5': 'goal',
  '6': 'goalBlock',
  '7': 'gate',
  '8': 'block',
  '9': 'skillPotion',
  '0': 'lifePotion',
  b: 'colorBlock',
  s: 'switch',
  w: 'colorWall',
  l: 'laser',
  m: 'magma',
};

const PAINT_TOOLS = new Set([
  'wall',
  'erase',
  'block',
  'colorBlock',
  'switch',
  'colorWall',
  'magma',
  'skillPotion',
  'lifePotion',
]);

function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} が見つかりません`);
  return found;
}

const canvas = element('editor-canvas');
const canvasFrame = element('canvas-frame');
const fileInput = element('file-input');
const blockFields = element('block-fields');
const facingField = element('facing-field');
const validationList = element('validation-list');

const els = {
  newButton: element('new-button'),
  importButton: element('import-button'),
  copyButton: element('copy-button'),
  exportButton: element('export-button'),
  previewButton: element('preview-button'),
  undoButton: element('undo-button'),
  redoButton: element('redo-button'),
  deleteButton: element('delete-button'),
  coordinate: element('coordinate'),
  modeBadge: element('mode-badge'),
  message: element('message'),
  saveStatus: element('save-status'),
  stageId: element('stage-id'),
  stageNumber: element('stage-number'),
  stageName: element('stage-name'),
  stageHint: element('stage-hint'),
  hintCount: element('hint-count'),
  fileName: element('file-name'),
  selectionLabel: element('selection-label'),
  blockName: element('block-name'),
  blockKind: element('block-kind'),
  blockColor: element('block-color'),
  paintColor: element('paint-color'),
  entityColor: element('entity-color'),
  entityColorLabel: element('entity-color-label'),
  entityColorField: element('entity-color-field'),
  laserFields: element('laser-fields'),
  laserDirection: element('laser-direction'),
  laserLength: element('laser-length'),
  facingSelect: element('facing-select'),
  validationSummary: element('validation-summary'),
  toolButtons: [...document.querySelectorAll('[data-tool]')],
};

const store = new EditorStore();
let hover = null;
let pointerState = null;
let renderQueued = false;
let saveTimer = null;

const draft = loadDraft();
if (draft) {
  const result = validateStage(draft.stage);
  if (result.ok && globalThis.confirm('前回の自動保存データがあります。復元しますか？')) {
    store.importStage(draft.stage);
    store.message = '前回の下書きを復元しました';
  } else {
    clearDraft();
  }
}

store.subscribe((state) => {
  updateUI(state);
  scheduleRender();
  scheduleSave(state);
});

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function scheduleSave(state) {
  if (saveTimer !== null) globalThis.clearTimeout(saveTimer);
  els.saveStatus.textContent = '自動保存: 待機中';
  saveTimer = globalThis.setTimeout(() => {
    saveTimer = null;
    const saved = saveDraft(state.getStage());
    els.saveStatus.textContent = saved
      ? `自動保存: ${formatTime()}`
      : '自動保存できません（localStorage不可）';
  }, 500);
}

function saveNow() {
  if (saveTimer !== null) {
    globalThis.clearTimeout(saveTimer);
    saveTimer = null;
  }
  const saved = saveDraft(store.getStage());
  if (saved) els.saveStatus.textContent = `自動保存: ${formatTime()}`;
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  globalThis.requestAnimationFrame(() => {
    renderQueued = false;
    renderEditor(canvas, store, hover);
  });
}

function setHover(tile) {
  const previous = hover;
  hover = tile;
  els.coordinate.textContent = tile ? `タイル: ${tile.x}, ${tile.y}` : 'タイル: -';
  if (previous?.x !== tile?.x || previous?.y !== tile?.y) scheduleRender();
}

function updateUI(state) {
  const { model, selection, validation, tool, preview } = state;
  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  if (document.activeElement !== els.stageId) els.stageId.value = model.id;
  if (document.activeElement !== els.stageNumber) els.stageNumber.value = model.number;
  if (document.activeElement !== els.stageName) els.stageName.value = model.name;
  if (document.activeElement !== els.stageHint) els.stageHint.value = model.hint;
  els.hintCount.textContent = `${[...model.hint].length} / 70`;
  els.fileName.textContent = `${model.id || 'id未入力'}.json`;

  for (const button of els.toolButtons) {
    button.classList.toggle('active', button.dataset.tool === tool);
  }
  canvas.dataset.tool = tool;

  els.undoButton.disabled = state.history.length === 0;
  els.redoButton.disabled = state.future.length === 0;
  els.previewButton.textContent = preview ? '編集に戻る' : 'プレビュー';
  els.modeBadge.textContent = preview ? 'プレビュー' : '編集';
  els.modeBadge.classList.toggle('preview', preview);
  els.message.textContent = state.message;

  const selectedTile = state.getSelectedTile();
  els.deleteButton.hidden = !selection;
  els.deleteButton.disabled = selection?.kind === 'start' || selection?.kind === 'goal';
  blockFields.hidden = selection?.kind !== 'block';
  facingField.hidden = selection?.kind !== 'start';
  els.entityColorField.hidden = selection?.kind !== 'colorSwitch' && selection?.kind !== 'colorWall';
  els.laserFields.hidden = selection?.kind !== 'laser';
  if (document.activeElement !== els.paintColor) els.paintColor.value = state.paintColor;

  if (!selection) {
    els.selectionLabel.textContent = 'なにも選択されていません';
  } else {
    const coordinate = selectedTile ? ` (${selectedTile.x}, ${selectedTile.y})` : '';
    let detail = occupancyLabel(selection) ?? '';
    if (selection.kind === 'block') {
      const block = model.blocks.find((candidate) => candidate.id === selection.id);
      if (block) detail = `木箱「${block.name}」`;
    } else if (selection.kind === 'item') {
      detail = ITEM_LABELS[selection.type] ?? 'アイテム';
    }
    els.selectionLabel.textContent = `${detail}${coordinate}`;
  }

  if (selection?.kind === 'block') {
    const block = model.blocks.find((candidate) => candidate.id === selection.id);
    if (block) {
      if (document.activeElement !== els.blockName) els.blockName.value = block.name;
      if (document.activeElement !== els.blockKind) els.blockKind.value = block.kind ?? 'normal';
      if (document.activeElement !== els.blockColor) els.blockColor.value = block.color;
    }
  }
  if (selection?.kind === 'colorSwitch') {
    const colorSwitch = model.colorSwitches.find((candidate) => (
      candidate.x === selection.x && candidate.y === selection.y
    ));
    els.entityColorLabel.textContent = 'カラースイッチの色';
    if (colorSwitch && document.activeElement !== els.entityColor) els.entityColor.value = colorSwitch.color;
  } else if (selection?.kind === 'colorWall') {
    const colorWall = model.colorWalls.find((candidate) => (
      candidate.x === selection.x && candidate.y === selection.y
    ));
    els.entityColorLabel.textContent = 'カラー壁の色';
    if (colorWall && document.activeElement !== els.entityColor) els.entityColor.value = colorWall.color;
  }
  if (selection?.kind === 'laser') {
    const laser = model.lasers.find((candidate) => (
      candidate.x === selection.x && candidate.y === selection.y
    ));
    if (laser) {
      if (document.activeElement !== els.laserDirection) els.laserDirection.value = laser.direction;
      if (document.activeElement !== els.laserLength) els.laserLength.value = laser.length;
    }
  }
  if (selection?.kind === 'start' && document.activeElement !== els.facingSelect) {
    els.facingSelect.value = model.start.facing;
  }

  els.validationSummary.className = 'validation-summary';
  if (errorCount > 0) {
    els.validationSummary.textContent = `エラー ${errorCount}件 / 警告 ${warningCount}件`;
    els.validationSummary.classList.add('has-errors');
  } else if (warningCount > 0) {
    els.validationSummary.textContent = `警告 ${warningCount}件（保存は可能です）`;
    els.validationSummary.classList.add('has-warnings');
  } else {
    els.validationSummary.textContent = '問題ありません';
  }

  const fragment = document.createDocumentFragment();
  for (const diagnostic of [...validation.errors, ...validation.warnings]) {
    const item = document.createElement('li');
    item.className = `validation-item ${diagnostic.severity}`;

    const button = document.createElement('button');
    button.type = 'button';
    const code = document.createElement('span');
    code.className = 'code';
    code.textContent = diagnostic.code;
    button.append(code, document.createTextNode(diagnostic.message));
    button.addEventListener('click', () => {
      if (diagnostic.tile && isPlayableTile(diagnostic.tile.x, diagnostic.tile.y)) {
        setHover({ x: diagnostic.tile.x, y: diagnostic.tile.y });
        store.selectAt(diagnostic.tile.x, diagnostic.tile.y);
      } else {
        store.setMessage(`${diagnostic.code}: ${diagnostic.message}`);
      }
    });
    item.append(button);
    fragment.append(item);
  }
  validationList.replaceChildren(fragment);
  scheduleRender();
}

function tileFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = Math.floor(((event.clientX - rect.left) * (canvas.width / rect.width)) / TILE_SIZE);
  const y = Math.floor(((event.clientY - rect.top) * (canvas.height / rect.height)) / TILE_SIZE);
  if (x < 0 || x >= canvas.width / TILE_SIZE || y < 0 || y >= canvas.height / TILE_SIZE) return null;
  return { x, y };
}

function sameTile(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

canvas.addEventListener('pointerdown', (event) => {
  if (store.preview) {
    store.setMessage('プレビュー中は編集できません。「編集に戻る」を押してください');
    return;
  }
  const tile = tileFromPointer(event);
  if (!tile) return;

  event.preventDefault();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture?.(event.pointerId);

  if (event.button === 2) {
    pointerState = { mode: 'erase', pointerId: event.pointerId, lastTile: tile };
    store.eraseAt(tile.x, tile.y);
    return;
  }
  if (event.button !== 0) return;

  if (store.tool === 'select') {
    store.selectAt(tile.x, tile.y);
    if (store.selection) {
      store.beginDrag();
      pointerState = { mode: 'drag', pointerId: event.pointerId, lastTile: tile };
    }
    return;
  }

  store.applyTool(store.tool, tile.x, tile.y);
  if (PAINT_TOOLS.has(store.tool)) {
    pointerState = { mode: 'paint', pointerId: event.pointerId, lastTile: tile };
  }
});

canvas.addEventListener('pointermove', (event) => {
  const tile = tileFromPointer(event);
  setHover(tile);
  if (!pointerState || !tile || sameTile(pointerState.lastTile, tile)) return;

  pointerState.lastTile = tile;
  if (pointerState.mode === 'drag') {
    store.moveSelectionTo(tile.x, tile.y);
  } else if (pointerState.mode === 'paint') {
    store.applyTool(store.tool, tile.x, tile.y);
  } else if (pointerState.mode === 'erase') {
    store.eraseAt(tile.x, tile.y);
  }
});

function finishPointer(event) {
  if (pointerState) {
    store.endDrag();
    pointerState = null;
  }
  if (canvas.hasPointerCapture?.(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('pointerleave', () => {
  if (!pointerState) setHover(null);
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvasFrame.addEventListener('dragover', (event) => event.preventDefault());
canvasFrame.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) await importFile(file);
});

function isEditableTarget(target) {
  return target instanceof HTMLElement
    && (target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable);
}

globalThis.addEventListener('keydown', (event) => {
  if (isEditableTarget(event.target)) return;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (modifier && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (modifier && key === 'y') {
    event.preventDefault();
    store.redo();
    return;
  }
  if (modifier && key === 's') {
    event.preventDefault();
    exportStage();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    store.deleteSelection();
    return;
  }
  if (event.key === 'Escape') {
    if (store.preview) store.setPreview(false);
    else {
      store.setTool('select');
      store.setSelection(null);
    }
    return;
  }
  if (event.key.startsWith('Arrow') && store.selection && !modifier && !event.altKey) {
    event.preventDefault();
    const offsets = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const [dx, dy] = offsets[event.key];
    store.moveSelectionBy(dx, dy);
    return;
  }
  if (!modifier && TOOL_KEYS[event.key]) {
    store.setTool(TOOL_KEYS[event.key]);
  }
});

for (const button of els.toolButtons) {
  button.addEventListener('click', () => store.setTool(button.dataset.tool));
}

els.undoButton.addEventListener('click', () => store.undo());
els.redoButton.addEventListener('click', () => store.redo());
els.deleteButton.addEventListener('click', () => store.deleteSelection());
els.previewButton.addEventListener('click', () => store.setPreview(!store.preview));

els.newButton.addEventListener('click', () => {
  if (!globalThis.confirm('現在の編集内容を破棄して新しいステージを作成しますか？')) return;
  hover = null;
  store.newStage();
  scheduleRender();
});

els.importButton.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (file) await importFile(file);
});

els.exportButton.addEventListener('click', () => exportStage());
els.copyButton.addEventListener('click', () => copyStage());

els.stageId.addEventListener('input', () => store.setMeta({ id: els.stageId.value }));
els.stageId.addEventListener('blur', () => updateUI(store));
els.stageNumber.addEventListener('input', () => store.setMeta({ number: els.stageNumber.value }));
els.stageNumber.addEventListener('blur', () => updateUI(store));
els.stageName.addEventListener('input', () => store.setMeta({ name: els.stageName.value }));
els.stageHint.addEventListener('input', () => store.setMeta({ hint: els.stageHint.value }));
els.blockName.addEventListener('input', () => store.setBlockProps({ name: els.blockName.value }));
els.blockName.addEventListener('blur', () => updateUI(store));
els.blockKind.addEventListener('change', () => store.setBlockProps({ kind: els.blockKind.value }));
els.blockColor.addEventListener('input', () => store.setEntityColor(els.blockColor.value));
els.paintColor.addEventListener('input', () => store.setPaintColor(els.paintColor.value));
els.entityColor.addEventListener('input', () => store.setEntityColor(els.entityColor.value));
els.laserDirection.addEventListener('change', () => store.setLaserProps({ direction: els.laserDirection.value }));
els.laserLength.addEventListener('input', () => store.setLaserProps({ length: els.laserLength.value }));
els.facingSelect.addEventListener('change', () => store.setFacing(els.facingSelect.value));

function diagnosticText(diagnostics, limit = 8) {
  const lines = diagnostics.slice(0, limit).map((diagnostic) => (
    `${diagnostic.code} ${diagnostic.file ? `${diagnostic.file}: ` : ''}${diagnostic.message}`
  ));
  if (diagnostics.length > limit) lines.push(`...ほか ${diagnostics.length - limit}件`);
  return lines.join('\n');
}

async function importFile(file) {
  try {
    const stage = await readStageFile(file);
    const result = validateStage(stage);
    if (!result.ok) {
      globalThis.alert(`ステージJSONを読み込めません。\n\n${diagnosticText(result.errors)}`);
      store.setMessage('読み込みに失敗しました。検証エラーを確認してください');
      return;
    }
    hover = null;
    store.importStage(stage);
    store.setMessage(
      `「${stage.name}」を読み込みました${result.warnings.length > 0 ? `（警告 ${result.warnings.length}件）` : ''}`,
    );
    setHover(null);
  } catch (error) {
    globalThis.alert(`ファイルを読み込めませんでした。\n\n${error.message}`);
    store.setMessage('ファイルの読み込みに失敗しました');
  }
}

async function exportStage() {
  const { errors, warnings } = store.validation;
  if (errors.length > 0) {
    globalThis.alert(`エラーがあるため保存できません。\n\n${diagnosticText(errors)}`);
    store.setMessage('検証エラーを修正してから保存してください');
    return;
  }
  if (warnings.length > 0 && !globalThis.confirm(`警告が ${warnings.length}件あります。保存しますか？\n\n${diagnosticText(warnings, 5)}`)) {
    return;
  }

  try {
    const result = await saveStageFile(store.getStage());
    if (result.method === 'cancelled') {
      store.setMessage('保存をキャンセルしました');
      return;
    }
    store.setMessage(`${result.fileName} を保存しました。src/data/stages/ に置いてください`);
  } catch (error) {
    globalThis.alert(`保存に失敗しました。\n\n${error.message}`);
    store.setMessage('保存に失敗しました');
  }
}

async function copyStage() {
  const { errors, warnings } = store.validation;
  if (errors.length > 0) {
    globalThis.alert(`エラーがあるためコピーできません。\n\n${diagnosticText(errors)}`);
    return;
  }
  if (warnings.length > 0 && !globalThis.confirm(`警告が ${warnings.length}件あります。コピーしますか？`)) return;

  try {
    await copyStageToClipboard(store.getStage());
    store.setMessage('ステージJSONをクリップボードにコピーしました');
  } catch (error) {
    globalThis.alert(`コピーに失敗しました。\n\n${error.message}`);
  }
}

globalThis.addEventListener('pagehide', saveNow);

updateUI(store);
scheduleRender();
