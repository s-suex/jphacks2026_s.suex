import {
  BLOCK_FIELDS,
  BLOCK_ID_PATTERN,
  BLOCK_KINDS,
  COLOR_SWITCH_FIELDS,
  COLOR_WALL_FIELDS,
  FACINGS,
  HEX_COLOR_PATTERN,
  ITEM_FIELDS,
  ITEM_TYPES,
  LASER_FIELDS,
  MAX_BLOCK_NAME_LENGTH,
  MAX_HINT_LENGTH,
  MAX_LASER_LENGTH,
  MAX_STAGE_NAME_LENGTH,
  MIN_LASER_LENGTH,
  OBSTACLE_FIELDS,
  PLAYABLE_MAX_X,
  PLAYABLE_MAX_Y,
  RECOMMENDED_BLOCK_NAME_LENGTH,
  SCHEMA_VERSION,
  STAGE_FIELDS,
  STAGE_ID_PATTERN,
  START_FIELDS,
  TILE_FIELDS,
  isPlayableTile,
  normalizeColor,
  tileKey,
} from './constants.js';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function addDiagnostic(list, severity, code, message, extra = {}) {
  list.push({ severity, code, message, ...extra });
}

function checkUnknownKeys(object, allowedFields, path, errors) {
  for (const key of Object.keys(object)) {
    if (allowedFields.includes(key)) continue;
    addDiagnostic(errors, 'error', 'E014', `${path} に未知のフィールド "${key}" があります`, { path });
  }
}

function readTile(value, path, errors, code = 'E006') {
  if (!isPlainObject(value)) {
    addDiagnostic(errors, 'error', 'E001', `${path} は {x, y} のオブジェクトである必要があります`, { path });
    return null;
  }
  if (!isPlayableTile(value.x, value.y)) {
    addDiagnostic(
      errors,
      'error',
      code,
      `${path} は配置可能範囲（x: 1〜${PLAYABLE_MAX_X}, y: 1〜${PLAYABLE_MAX_Y}）の整数座標である必要があります`,
      { path, tile: { x: value.x, y: value.y } },
    );
    return null;
  }
  return { x: value.x, y: value.y };
}

function validateStart(value, errors) {
  if (!isPlainObject(value)) {
    addDiagnostic(errors, 'error', 'E001', 'start は {x, y, facing} のオブジェクトである必要があります', { path: 'start' });
    return null;
  }
  checkUnknownKeys(value, START_FIELDS, 'start', errors);
  const tile = readTile(value, 'start', errors);
  if (!FACINGS.includes(value.facing)) {
    addDiagnostic(errors, 'error', 'E001', `start.facing は ${FACINGS.join(' / ')} のいずれかである必要があります`, { path: 'start.facing' });
  }
  return tile ? { ...tile, facing: value.facing } : null;
}

function validateObstacles(value, errors, warnings) {
  const wallTiles = new Map();
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'obstacles は配列である必要があります', { path: 'obstacles' });
    return wallTiles;
  }

  let hasOverlap = false;
  value.forEach((obstacle, index) => {
    const path = `obstacles[${index}]`;
    if (!isPlainObject(obstacle)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(obstacle, OBSTACLE_FIELDS, path, errors);

    const { x, y, width, height } = obstacle;
    const validPosition = isPlayableTile(x, y);
    const validSize = Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1;
    const withinBounds = validPosition && validSize
      && x + width - 1 <= PLAYABLE_MAX_X
      && y + height - 1 <= PLAYABLE_MAX_Y;

    if (!validPosition) {
      addDiagnostic(errors, 'error', 'E007', `${path} の x / y が配置可能範囲外です`, { path, tile: { x, y } });
    }
    if (!validSize) {
      addDiagnostic(errors, 'error', 'E007', `${path} の width / height は1以上の整数である必要があります`, { path });
    } else if (validPosition && !withinBounds) {
      addDiagnostic(errors, 'error', 'E007', `${path} が配置可能範囲を超えています`, { path, tile: { x, y } });
    }
    if (!withinBounds) return;

    for (let tileY = y; tileY < y + height; tileY += 1) {
      for (let tileX = x; tileX < x + width; tileX += 1) {
        const key = tileKey(tileX, tileY);
        if (wallTiles.has(key)) hasOverlap = true;
        else wallTiles.set(key, { x: tileX, y: tileY });
      }
    }
  });

  if (hasOverlap) {
    addDiagnostic(warnings, 'warning', 'W008', '固定壁の矩形同士が重複しています', { path: 'obstacles' });
  }
  return wallTiles;
}

function validateItems(value, errors) {
  const items = [];
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'items は配列である必要があります', { path: 'items' });
    return items;
  }

  value.forEach((item, index) => {
    const path = `items[${index}]`;
    if (!isPlainObject(item)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(item, ITEM_FIELDS, path, errors);
    if (!ITEM_TYPES.includes(item.type)) {
      addDiagnostic(errors, 'error', 'E010', `${path}.type は ${ITEM_TYPES.join(' / ')} のいずれかです`, { path });
    }
    const tile = readTile(item, path, errors);
    if (tile && ITEM_TYPES.includes(item.type)) items.push({ ...tile, type: item.type });
  });
  return items;
}

function validateBlocks(value, errors, warnings) {
  const blocks = [];
  const seenIds = new Set();
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'blocks は配列である必要があります', { path: 'blocks' });
    return blocks;
  }

  value.forEach((block, index) => {
    const path = `blocks[${index}]`;
    if (!isPlainObject(block)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(block, BLOCK_FIELDS, path, errors);

    let valid = true;
    if (typeof block.id !== 'string' || !BLOCK_ID_PATTERN.test(block.id)) {
      addDiagnostic(errors, 'error', 'E011', `${path}.id は英小文字・数字・ハイフンで始まるIDである必要があります`, { path });
      valid = false;
    } else if (seenIds.has(block.id)) {
      addDiagnostic(errors, 'error', 'E011', `${path}.id "${block.id}" がステージ内で重複しています`, { path });
      valid = false;
    } else {
      seenIds.add(block.id);
    }

    if (typeof block.name !== 'string' || block.name.length === 0 || block.name.length > MAX_BLOCK_NAME_LENGTH) {
      addDiagnostic(errors, 'error', 'E001', `${path}.name は1〜${MAX_BLOCK_NAME_LENGTH}文字である必要があります`, { path });
      valid = false;
    } else if ([...block.name].length > RECOMMENDED_BLOCK_NAME_LENGTH) {
      addDiagnostic(warnings, 'warning', 'W004', `${path}.name はタイル内表示のため${RECOMMENDED_BLOCK_NAME_LENGTH}文字以下を推奨します`, { path });
    }

    if (typeof block.color !== 'string' || !HEX_COLOR_PATTERN.test(block.color)) {
      addDiagnostic(errors, 'error', 'E012', `${path}.color は #rrggbb 形式である必要があります`, { path });
      valid = false;
    }

    const kind = block.kind ?? 'normal';
    if (!BLOCK_KINDS.includes(kind)) {
      addDiagnostic(errors, 'error', 'E001', `${path}.kind は ${BLOCK_KINDS.join(' / ')} のいずれかである必要があります`, { path });
      valid = false;
    }

    const tile = readTile(block, path, errors);
    if (!tile) valid = false;

    if (valid) {
      blocks.push({
        id: block.id,
        name: block.name,
        kind,
        x: tile.x,
        y: tile.y,
        color: block.color,
      });
    }
  });
  return blocks;
}

function validateColorSwitches(value, errors) {
  const switches = [];
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'colorSwitches は配列である必要があります', { path: 'colorSwitches' });
    return switches;
  }

  value.forEach((colorSwitch, index) => {
    const path = `colorSwitches[${index}]`;
    if (!isPlainObject(colorSwitch)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(colorSwitch, COLOR_SWITCH_FIELDS, path, errors);

    let valid = true;
    const tile = readTile(colorSwitch, path, errors);
    if (!tile) valid = false;
    if (typeof colorSwitch.color !== 'string' || !HEX_COLOR_PATTERN.test(colorSwitch.color)) {
      addDiagnostic(errors, 'error', 'E012', `${path}.color は #rrggbb 形式である必要があります`, { path });
      valid = false;
    }

    if (valid) switches.push({ x: tile.x, y: tile.y, color: colorSwitch.color });
  });
  return switches;
}

function validateColorWalls(value, errors) {
  const walls = [];
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'colorWalls は配列である必要があります', { path: 'colorWalls' });
    return walls;
  }

  value.forEach((wall, index) => {
    const path = `colorWalls[${index}]`;
    if (!isPlainObject(wall)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(wall, COLOR_WALL_FIELDS, path, errors);

    let valid = true;
    const { x, y, width, height } = wall;
    const validPosition = isPlayableTile(x, y);
    const validSize = Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1;
    const withinBounds = validPosition && validSize
      && x + width - 1 <= PLAYABLE_MAX_X
      && y + height - 1 <= PLAYABLE_MAX_Y;

    if (!validPosition) {
      addDiagnostic(errors, 'error', 'E007', `${path} の x / y が配置可能範囲外です`, { path, tile: { x, y } });
      valid = false;
    }
    if (!validSize) {
      addDiagnostic(errors, 'error', 'E007', `${path} の width / height は1以上の整数である必要があります`, { path });
      valid = false;
    } else if (validPosition && !withinBounds) {
      addDiagnostic(errors, 'error', 'E007', `${path} が配置可能範囲を超えています`, { path, tile: { x, y } });
      valid = false;
    }
    if (typeof wall.color !== 'string' || !HEX_COLOR_PATTERN.test(wall.color)) {
      addDiagnostic(errors, 'error', 'E012', `${path}.color は #rrggbb 形式である必要があります`, { path });
      valid = false;
    }

    if (valid) walls.push({ x, y, width, height, color: wall.color });
  });
  return walls;
}

function validateLasers(value, errors) {
  const lasers = [];
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'lasers は配列である必要があります', { path: 'lasers' });
    return lasers;
  }

  const offsets = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  value.forEach((laser, index) => {
    const path = `lasers[${index}]`;
    if (!isPlainObject(laser)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(laser, LASER_FIELDS, path, errors);

    let valid = true;
    const tile = readTile(laser, path, errors);
    if (!tile) valid = false;

    if (!FACINGS.includes(laser.direction)) {
      addDiagnostic(errors, 'error', 'E001', `${path}.direction は ${FACINGS.join(' / ')} のいずれかである必要があります`, { path });
      valid = false;
    }

    const lengthValid = Number.isInteger(laser.length)
      && laser.length >= MIN_LASER_LENGTH
      && laser.length <= MAX_LASER_LENGTH;
    if (!lengthValid) {
      addDiagnostic(errors, 'error', 'E001', `${path}.length は ${MIN_LASER_LENGTH}〜${MAX_LASER_LENGTH} の整数である必要があります`, { path });
      valid = false;
    }

    if (valid) {
      const offset = offsets[laser.direction];
      const endX = tile.x + offset.x * laser.length;
      const endY = tile.y + offset.y * laser.length;
      if (!isPlayableTile(endX, endY)) {
        addDiagnostic(errors, 'error', 'E007', `${path} のレーザーが配置可能範囲を超えています`, {
          path,
          tile: { x: endX, y: endY },
        });
        valid = false;
      }
    }

    if (valid) {
      lasers.push({
        x: tile.x,
        y: tile.y,
        direction: laser.direction,
        length: laser.length,
      });
    }
  });
  return lasers;
}

function validateMagma(value, errors) {
  const magma = [];
  if (!Array.isArray(value)) {
    addDiagnostic(errors, 'error', 'E001', 'magma は配列である必要があります', { path: 'magma' });
    return magma;
  }

  value.forEach((tileValue, index) => {
    const path = `magma[${index}]`;
    if (!isPlainObject(tileValue)) {
      addDiagnostic(errors, 'error', 'E001', `${path} はオブジェクトである必要があります`, { path });
      return;
    }
    checkUnknownKeys(tileValue, TILE_FIELDS, path, errors);
    const tile = readTile(tileValue, path, errors);
    if (tile) magma.push(tile);
  });
  return magma;
}

function validateOptionalTile(value, path, errors) {
  if (value === null) return null;
  if (value === undefined) {
    addDiagnostic(errors, 'error', 'E001', `${path} は必須です（不要な場合は null）`, { path });
    return null;
  }
  if (isPlainObject(value)) checkUnknownKeys(value, TILE_FIELDS, path, errors);
  return readTile(value, path, errors);
}

function findPath(start, goal, blocked) {
  if (!start || !goal) return false;
  const key = tileKey(start.x, start.y);
  if (blocked.has(key)) return false;

  const queue = [[start.x, start.y]];
  const visited = new Set([key]);
  const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    if (x === goal.x && y === goal.y) return true;
    for (const [dx, dy] of offsets) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (!isPlayableTile(nextX, nextY)) continue;
      const nextKey = tileKey(nextX, nextY);
      if (visited.has(nextKey) || blocked.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push([nextX, nextY]);
    }
  }
  return false;
}

export function validateStage(stage, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(stage)) {
    addDiagnostic(errors, 'error', 'E001', 'ステージはJSONオブジェクトである必要があります');
    return { ok: false, errors, warnings };
  }

  const allowedFieldsWithOptional = [...STAGE_FIELDS, 'initialSkillPotions'];
  checkUnknownKeys(stage, allowedFieldsWithOptional, 'stage', errors);

  for (const field of STAGE_FIELDS) {
    if (!hasOwn(stage, field)) {
      addDiagnostic(errors, 'error', 'E001', `必須フィールド "${field}" がありません`, { path: field });
    }
  }

  if (stage.schemaVersion !== SCHEMA_VERSION) {
    addDiagnostic(
      errors,
      'error',
      'E002',
      `schemaVersion は ${SCHEMA_VERSION} である必要があります（受信値: ${String(stage.schemaVersion)}）`,
      { path: 'schemaVersion' },
    );
  }

  if (typeof stage.id !== 'string' || !STAGE_ID_PATTERN.test(stage.id)) {
    addDiagnostic(errors, 'error', 'E003', 'id は3〜64文字の英小文字・数字・ハイフンで指定してください', { path: 'id' });
  }

  if (!Number.isInteger(stage.number) || stage.number < 1) {
    addDiagnostic(errors, 'error', 'E005', 'number は1以上の整数である必要があります', { path: 'number' });
  }

  if (typeof stage.name !== 'string' || stage.name.length === 0 || stage.name.length > MAX_STAGE_NAME_LENGTH) {
    addDiagnostic(errors, 'error', 'E001', `name は1〜${MAX_STAGE_NAME_LENGTH}文字である必要があります`, { path: 'name' });
  }

  if (typeof stage.hint !== 'string') {
    addDiagnostic(errors, 'error', 'E001', 'hint は文字列である必要があります', { path: 'hint' });
  } else if ([...stage.hint].length > MAX_HINT_LENGTH) {
    addDiagnostic(warnings, 'warning', 'W004', `hint はHUD表示のため${MAX_HINT_LENGTH}文字以下を推奨します`, { path: 'hint' });
  }

  if (stage.initialSkillPotions !== undefined && (!Number.isInteger(stage.initialSkillPotions) || stage.initialSkillPotions < 0)) {
    addDiagnostic(errors, 'error', 'E001', 'initialSkillPotions は0以上の整数である必要があります', { path: 'initialSkillPotions' });
  }

  const start = validateStart(stage.start, errors);
  if (isPlainObject(stage.goal)) checkUnknownKeys(stage.goal, TILE_FIELDS, 'goal', errors);
  const goal = readTile(stage.goal, 'goal', errors);
  const wallTiles = validateObstacles(stage.obstacles, errors, warnings);
  const items = validateItems(stage.items, errors);
  const blocks = validateBlocks(stage.blocks, errors, warnings);
  const colorSwitches = validateColorSwitches(stage.colorSwitches, errors);
  const colorWalls = validateColorWalls(stage.colorWalls, errors);
  const lasers = validateLasers(stage.lasers, errors);
  const magma = validateMagma(stage.magma, errors);
  const goalBlock = validateOptionalTile(stage.goalBlock, 'goalBlock', errors);
  const shortcutGate = validateOptionalTile(stage.shortcutGate, 'shortcutGate', errors);

  const occupancy = new Map();
  const place = (label, tile, code = 'E008') => {
    if (!tile) return;
    const key = tileKey(tile.x, tile.y);
    const existing = occupancy.get(key);
    if (existing) {
      addDiagnostic(errors, 'error', code, `${existing}と${label}が同じマス (${tile.x}, ${tile.y}) にあります`, {
        path: label,
        tile: { x: tile.x, y: tile.y },
      });
      return;
    }
    occupancy.set(key, label);
  };

  for (const tile of wallTiles.values()) place('固定壁', tile);

  place('開始位置', start);
  place('ゴール', goal);
  blocks.forEach((block) => place(`木箱「${block.name}」`, block));
  items.forEach((item) => place(item.type === 'skillPotion' ? 'スキルポーション' : 'ライフポーション', item));
  colorSwitches.forEach((colorSwitch) => place('カラースイッチ', colorSwitch));
  colorWalls.forEach((wall) => {
    for (let tileY = wall.y; tileY < wall.y + wall.height; tileY += 1) {
      for (let tileX = wall.x; tileX < wall.x + wall.width; tileX += 1) {
        place('カラー壁', { x: tileX, y: tileY });
      }
    }
  });
  lasers.forEach((laser) => place('レーザー発射装置', laser));
  magma.forEach((tile) => place('マグマ', tile));
  place('goalBlock', goalBlock, 'E009');
  place('shortcutGate', shortcutGate, 'E009');

  if (goalBlock && blocks.length === 0) {
    addDiagnostic(warnings, 'warning', 'W001', 'goalBlock がありますが、初期配置の木箱がありません', { path: 'blocks' });
  }
  if (shortcutGate && blocks.length === 0) {
    addDiagnostic(warnings, 'warning', 'W002', 'shortcutGate がありますが、コピー元になる初期木箱がありません', { path: 'blocks' });
  }
  if (items.length === 0) {
    addDiagnostic(warnings, 'warning', 'W006', 'アイテムが1つも配置されていません', { path: 'items' });
  }

  const coloredBlocks = blocks.filter((block) => block.kind === 'colored');
  const normalBlocks = blocks.filter((block) => block.kind === 'normal');
  const switchColors = new Set(colorSwitches.map((colorSwitch) => normalizeColor(colorSwitch.color)));
  const wallColors = new Set(colorWalls.map((wall) => normalizeColor(wall.color)));
  const coloredBlockColors = new Set(coloredBlocks.map((block) => normalizeColor(block.color)));

  if (colorSwitches.length > 0 && coloredBlocks.length === 0) {
    addDiagnostic(warnings, 'warning', 'W009', 'カラースイッチがありますが、色つき木箱がありません', { path: 'blocks' });
  }
  for (const color of switchColors) {
    if (!coloredBlockColors.has(color)) {
      addDiagnostic(warnings, 'warning', 'W010', `カラースイッチ（${color}）と同じ色の色つき木箱が初期配置にありません`, { path: 'colorSwitches' });
    }
    if (!wallColors.has(color)) {
      addDiagnostic(warnings, 'warning', 'W011', `カラースイッチ（${color}）に対応するカラー壁がありません`, { path: 'colorSwitches' });
    }
  }
  for (const color of wallColors) {
    if (!switchColors.has(color)) {
      addDiagnostic(warnings, 'warning', 'W012', `カラー壁（${color}）に対応するカラースイッチがありません`, { path: 'colorWalls' });
    }
  }
  for (const color of coloredBlockColors) {
    if (!switchColors.has(color)) {
      addDiagnostic(warnings, 'warning', 'W013', `色つき木箱（${color}）に対応するカラースイッチがありません`, { path: 'blocks' });
    }
  }
  if (magma.length > 0 && normalBlocks.length === 0) {
    addDiagnostic(warnings, 'warning', 'W014', 'マグマがありますが、足場になるノーマル木箱がありません', { path: 'blocks' });
  }
  if (lasers.length > 0 && normalBlocks.length === 0) {
    addDiagnostic(warnings, 'warning', 'W015', 'レーザーがありますが、遮るノーマル木箱がありません', { path: 'blocks' });
  }

  const openableColors = new Set();
  for (const color of switchColors) {
    if (coloredBlockColors.has(color)) openableColors.add(color);
  }

  const blocked = new Set(wallTiles.keys());
  blocks.forEach((block) => blocked.add(tileKey(block.x, block.y)));
  lasers.forEach((laser) => blocked.add(tileKey(laser.x, laser.y)));
  if (normalBlocks.length === 0) {
    magma.forEach((tile) => blocked.add(tileKey(tile.x, tile.y)));
  }
  colorWalls.forEach((wall) => {
    if (openableColors.has(normalizeColor(wall.color))) return;
    for (let tileY = wall.y; tileY < wall.y + wall.height; tileY += 1) {
      for (let tileX = wall.x; tileX < wall.x + wall.width; tileX += 1) {
        blocked.add(tileKey(tileX, tileY));
      }
    }
  });
  if (shortcutGate) blocked.add(tileKey(shortcutGate.x, shortcutGate.y));

  if (start && goal && !findPath(start, goal, blocked)) {
    addDiagnostic(
      warnings,
      'warning',
      'W005',
      '壁・初期木箱・閉じたゲートだけを考慮すると、開始位置からゴールへの経路がありません',
      { path: 'goal' },
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateStageCollection(entries, options = {}) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(entries) || entries.length === 0) {
    addDiagnostic(errors, 'error', 'E016', 'ステージが1件もありません', { path: 'stages' });
    return { ok: false, errors, warnings };
  }

  const idOwners = new Map();
  const numberOwners = new Map();

  for (const entry of entries) {
    const file = typeof entry?.file === 'string' ? entry.file : undefined;
    const stage = entry?.stage;
    const result = validateStage(stage, options);

    for (const diagnostic of result.errors) errors.push({ ...diagnostic, file });
    for (const diagnostic of result.warnings) warnings.push({ ...diagnostic, file });

    if (!isPlainObject(stage)) continue;

    if (typeof stage.id === 'string' && STAGE_ID_PATTERN.test(stage.id)) {
      if (idOwners.has(stage.id)) {
        addDiagnostic(errors, 'error', 'E004', `id "${stage.id}" が複数ファイルで使われています`, {
          file,
          path: 'id',
        });
      } else {
        idOwners.set(stage.id, file);
      }
      if (file && file !== `${stage.id}.json`) {
        addDiagnostic(errors, 'error', 'E004', `ファイル名は "${stage.id}.json" にしてください`, {
          file,
          path: 'id',
        });
      }
    }

    if (Number.isInteger(stage.number) && stage.number >= 1) {
      if (numberOwners.has(stage.number)) {
        addDiagnostic(errors, 'error', 'E005', `number ${stage.number} が複数ステージで使われています`, {
          file,
          path: 'number',
        });
      } else {
        numberOwners.set(stage.number, file);
      }
    }
  }

  if (numberOwners.size > 0) {
    const numbers = [...numberOwners.keys()].sort((a, b) => a - b);
    const hasGap = numbers.some((number, index) => number !== index + 1);
    if (hasGap) {
      addDiagnostic(warnings, 'warning', 'W003', `ステージ番号に欠番があります（${numbers.join(', ')}）`, {
        path: 'number',
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
