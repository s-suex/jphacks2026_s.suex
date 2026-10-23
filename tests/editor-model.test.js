import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateStage, tileKey } from '@shortcut-dungeon/stage-schema';
import EditorStore from '../editor/src/state/store.js';
import {
  createBlankStage,
  modelToStage,
  stageToModel,
  wallTilesToObstacles,
} from '../editor/src/state/model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readStage(fileName) {
  return JSON.parse(readFileSync(join(root, 'src', 'data', 'stages', fileName), 'utf8'));
}

function stateToWallSet(stage) {
  return [...stageToModel(stage).walls].sort();
}

test('JSONステージをモデルへ往復しても検証を通る', () => {
  for (const fileName of ['crate-intro.json', 'copy-gate-maze.json', 'color-switch-gate.json', 'laser-magma-lab.json']) {
    const stage = readStage(fileName);
    const roundTripped = modelToStage(stageToModel(stage));
    const result = validateStage(roundTripped);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(roundTripped.start, stage.start);
    assert.deepEqual(roundTripped.goal, stage.goal);
    assert.deepEqual(roundTripped.items, stage.items);
    assert.deepEqual(roundTripped.blocks, stage.blocks);
    assert.deepEqual(roundTripped.colorSwitches, stage.colorSwitches);
    assert.deepEqual(
      [...stageToModel(roundTripped).colorWalls].sort((a, b) => (
        a.y - b.y || a.x - b.x || a.color.localeCompare(b.color)
      )),
      [...stageToModel(stage).colorWalls].sort((a, b) => (
        a.y - b.y || a.x - b.x || a.color.localeCompare(b.color)
      )),
    );
    assert.deepEqual(
      stateToWallSet(roundTripped),
      stateToWallSet(stage),
    );
  }
});

test('壁タイルを水平方向の矩形へ変換する', () => {
  const walls = new Set([
    tileKey(1, 1),
    tileKey(2, 1),
    tileKey(4, 1),
    tileKey(6, 3),
  ]);
  assert.deepEqual(wallTilesToObstacles(walls), [
    { x: 1, y: 1, width: 2, height: 1 },
    { x: 4, y: 1, width: 1, height: 1 },
    { x: 6, y: 3, width: 1, height: 1 },
  ]);
});

test('空白ステージは検証を通り、警告のみになる', () => {
  const stage = modelToStage(createBlankStage());
  const result = validateStage(stage);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.length > 0);
});

test('壁と重なる開始位置の配置を拒否する', () => {
  const store = new EditorStore();
  store.applyTool('wall', 1, 1);
  store.applyTool('start', 1, 1);
  assert.deepEqual(store.model.start, { x: 2, y: 7, facing: 'right' });
});

test('配置・移動・Undo・Redoが動作する', () => {
  const store = new EditorStore();
  store.applyTool('block', 2, 2);
  assert.equal(store.model.blocks.length, 1);
  assert.deepEqual(
    { x: store.model.blocks[0].x, y: store.model.blocks[0].y },
    { x: 2, y: 2 },
  );

  store.moveSelectionBy(1, 0);
  assert.equal(store.model.blocks[0].x, 3);

  store.undo();
  assert.equal(store.model.blocks[0].x, 2);

  store.undo();
  assert.equal(store.model.blocks.length, 0);

  store.redo();
  assert.equal(store.model.blocks.length, 1);
});

test('木箱のプロパティ変更をUndoできる', () => {
  const store = new EditorStore();
  store.applyTool('block', 2, 2);
  store.setBlockProps({ name: '宝箱', color: '#123456' });
  assert.equal(store.model.blocks[0].name, '宝箱');

  store.undo();
  assert.equal(store.model.blocks[0].name, '木箱');
  assert.equal(store.model.blocks[0].color, '#b57d50');
});

test('消去した要素の選択が解除される', () => {
  const store = new EditorStore();
  store.applyTool('block', 2, 2);
  assert.ok(store.selection);
  store.eraseAt(2, 2);
  assert.equal(store.selection, null);
  assert.equal(store.model.blocks.length, 0);
});

test('IDは小文字とハイフンへ正規化される', () => {
  const store = new EditorStore();
  store.setMeta({ id: 'My Stage! 01' });
  assert.equal(store.model.id, 'my-stage-01');
});

test('既存ステージを読み込むとエラーなしになる', () => {
  const store = new EditorStore();
  store.importStage(readStage('copy-gate-maze.json'));
  assert.equal(store.validation.errors.length, 0);
  assert.equal(store.model.blocks[0].name, '複製キー箱');
});

test('色つき木箱・カラースイッチ・カラー壁を配置できる', () => {
  const store = new EditorStore();
  store.setPaintColor('#4aa8ff');
  store.applyTool('colorBlock', 2, 2);
  store.applyTool('switch', 3, 2);
  store.applyTool('colorWall', 4, 2);

  assert.equal(store.model.blocks[0].kind, 'colored');
  assert.equal(store.model.blocks[0].color, '#4aa8ff');
  assert.deepEqual(store.model.colorSwitches[0], { x: 3, y: 2, color: '#4aa8ff' });
  assert.deepEqual(store.model.colorWalls[0], { x: 4, y: 2, color: '#4aa8ff' });

  const stage = store.getStage();
  assert.deepEqual(stage.colorWalls, [
    { x: 4, y: 2, width: 1, height: 1, color: '#4aa8ff' },
  ]);
});

test('カラースイッチとカラー壁の色を変更できる', () => {
  const store = new EditorStore();
  store.applyTool('switch', 3, 2);
  store.applyTool('colorWall', 4, 2);

  store.selectAt(3, 2);
  store.setEntityColor('#f3c969');
  assert.equal(store.model.colorSwitches[0].color, '#f3c969');

  store.selectAt(4, 2);
  store.setEntityColor('#f3c969');
  assert.equal(store.model.colorWalls[0].color, '#f3c969');
});

test('色つき木箱の種類を切り替えられる', () => {
  const store = new EditorStore();
  store.applyTool('block', 2, 2);
  store.setBlockProps({ kind: 'colored' });
  assert.equal(store.model.blocks[0].kind, 'colored');

  store.undo();
  assert.equal(store.model.blocks[0].kind, 'normal');
});

test('レーザーとマグマを配置し、レーザーの向きと長さを変更できる', () => {
  const store = new EditorStore();
  store.applyTool('laser', 5, 5);
  store.applyTool('magma', 8, 5);

  assert.equal(store.model.lasers.length, 1);
  assert.deepEqual(store.model.magma[0], { x: 8, y: 5 });
  assert.equal(store.model.lasers[0].direction, 'right');
  assert.equal(store.model.lasers[0].length, 5);

  store.selectAt(5, 5);
  store.setLaserProps({ direction: 'down', length: 3 });
  assert.equal(store.model.lasers[0].direction, 'down');
  assert.equal(store.model.lasers[0].length, 3);

  const stage = store.getStage();
  assert.deepEqual(stage.lasers, [{ x: 5, y: 5, direction: 'down', length: 3 }]);
  assert.deepEqual(stage.magma, [{ x: 8, y: 5 }]);

  store.undo();
  assert.equal(store.model.lasers[0].direction, 'right');
});

test('レーザーの長さは配置可能範囲に収まる', () => {
  const store = new EditorStore();
  store.applyTool('laser', 20, 5);
  store.setLaserProps({ direction: 'right', length: 21 });
  assert.equal(store.model.lasers[0].length, 2);
});

test('レーザーとマグマを消去できる', () => {
  const store = new EditorStore();
  store.applyTool('laser', 5, 5);
  store.applyTool('magma', 8, 5);

  store.eraseAt(5, 5);
  assert.equal(store.model.lasers.length, 0);

  store.eraseAt(8, 5);
  assert.equal(store.model.magma.length, 0);
});
