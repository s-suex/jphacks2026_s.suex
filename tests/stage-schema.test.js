import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  validateStage,
  validateStageCollection,
} from '@shortcut-dungeon/stage-schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stageDirectory = join(root, 'src', 'data', 'stages');

function readStage(fileName) {
  return JSON.parse(readFileSync(join(stageDirectory, fileName), 'utf8'));
}

function validEntries() {
  return [
    { file: 'crate-intro.json', stage: readStage('crate-intro.json') },
    { file: 'copy-gate-maze.json', stage: readStage('copy-gate-maze.json') },
    { file: 'color-switch-gate.json', stage: readStage('color-switch-gate.json') },
    { file: 'laser-magma-lab.json', stage: readStage('laser-magma-lab.json') },
  ];
}

function codes(diagnostics) {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

test('既存ステージは単体・コレクションともエラーにならない', () => {
  for (const { stage } of validEntries()) {
    const result = validateStage(stage);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
  }

  const collection = validateStageCollection(validEntries());
  assert.equal(collection.ok, true, JSON.stringify(collection.errors));
});

test('idの重複とファイル名不一致を検出する', () => {
  const entries = validEntries();
  entries[1].stage.id = 'crate-intro';
  entries[1].file = 'copy-gate-maze.json';

  const result = validateStageCollection(entries);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E004'));
});

test('numberの重複を検出する', () => {
  const entries = validEntries();
  entries[1].stage.number = 1;
  entries[1].stage.id = 'another-stage';
  entries[1].file = 'another-stage.json';

  const result = validateStageCollection(entries);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E005'));
});

test('同一マスへの配置を検出する', () => {
  const stage = readStage('crate-intro.json');
  stage.items[0].x = stage.start.x;
  stage.items[0].y = stage.start.y;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E008'));
});

test('未知フィールドを検出する', () => {
  const stage = readStage('crate-intro.json');
  stage.unexpected = true;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E014'));
});

test('範囲外の壁を検出する', () => {
  const stage = readStage('crate-intro.json');
  stage.obstacles[0].x = 23;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E007'));
});

test('必須フィールド欠落を検出する', () => {
  const stage = readStage('crate-intro.json');
  delete stage.goal;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E001'));
});

test('閉じたゲートと壁の重複をE009で検出する', () => {
  const stage = readStage('crate-intro.json');
  stage.shortcutGate = { x: 8, y: 1 };

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E009'));
});

test('ステージ0件を検出する', () => {
  const result = validateStageCollection([]);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E016'));
});

test('色つき木箱・カラースイッチ・カラー壁のステージはエラーにならない', () => {
  const stage = readStage('color-switch-gate.json');
  const result = validateStage(stage);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});

test('カラー壁と固定壁の重複をE008で検出する', () => {
  const stage = readStage('color-switch-gate.json');
  stage.colorWalls[0].y = 2;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E008'));
});

test('カラー要素の不正な色をE012で検出する', () => {
  const stage = readStage('color-switch-gate.json');
  stage.colorSwitches[0].color = 'red';

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E012'));
});

test('不正な木箱の種類を検出する', () => {
  const stage = readStage('color-switch-gate.json');
  stage.blocks[0].kind = 'rainbow';

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E001'));
});

test('レーザーとマグマのデモステージはエラーにならない', () => {
  const stage = readStage('laser-magma-lab.json');
  const result = validateStage(stage);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});

test('レーザーの不正な向き・長さをE001で検出する', () => {
  const stage = readStage('laser-magma-lab.json');
  stage.lasers[0].direction = 'diagonal';
  stage.lasers[0].length = 0;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E001'));
});

test('配置可能範囲を超えるレーザーをE007で検出する', () => {
  const stage = readStage('laser-magma-lab.json');
  stage.lasers[0].x = 20;
  stage.lasers[0].direction = 'right';
  stage.lasers[0].length = 5;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E007'));
});

test('レーザー発射装置と要素の重複をE008で検出する', () => {
  const stage = readStage('laser-magma-lab.json');
  stage.lasers[0].x = stage.blocks[0].x;
  stage.lasers[0].y = stage.blocks[0].y;

  const result = validateStage(stage);
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes('E008'));
});

test('マグマと足場用木箱がない場合の警告を出す', () => {
  const stage = readStage('laser-magma-lab.json');
  stage.blocks = stage.blocks.filter((block) => block.id !== 'magma-crate');
  stage.blocks[0].id = 'colored-crate';
  stage.blocks[0].kind = 'colored';
  stage.blocks[0].color = '#ff5e68';

  const result = validateStage(stage);
  assert.ok(codes(result.warnings).includes('W014'));
});
