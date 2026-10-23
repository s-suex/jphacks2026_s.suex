import {
  SCHEMA_VERSION,
  isPlayableTile,
  tileKey,
} from '@shortcut-dungeon/stage-schema';

export const BLOCK_COLORS = [
  '#b57d50',
  '#c98b5e',
  '#8f9b5a',
  '#6f8fa8',
  '#a5758f',
  '#b09654',
];

export const GIMMICK_COLORS = [
  '#ff5e68',
  '#4aa8ff',
  '#70e1c1',
  '#f3c969',
  '#b98cff',
  '#ff9f4a',
];

export const ITEM_LABELS = {
  skillPotion: 'スキルポーション',
  lifePotion: 'ライフポーション',
};

export const DEFAULT_LASER = Object.freeze({ direction: 'right', length: 5 });

export function createBlankStage(number = 1) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'new-stage',
    number,
    name: '新しいステージ',
    start: { x: 2, y: 7, facing: 'right' },
    walls: new Set(),
    items: [],
    blocks: [],
    colorSwitches: [],
    colorWalls: [],
    lasers: [],
    magma: [],
    goal: { x: 21, y: 7 },
    goalBlock: null,
    shortcutGate: null,
    hint: '',
  };
}

export function obstaclesToWallTiles(obstacles) {
  const walls = new Set();
  for (const obstacle of obstacles) {
    for (let y = obstacle.y; y < obstacle.y + obstacle.height; y += 1) {
      for (let x = obstacle.x; x < obstacle.x + obstacle.width; x += 1) {
        walls.add(tileKey(x, y));
      }
    }
  }
  return walls;
}

export function wallTilesToObstacles(walls) {
  const rows = new Map();
  for (const key of walls) {
    const [x, y] = key.split(',').map(Number);
    if (!isPlayableTile(x, y)) continue;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x);
  }

  const obstacles = [];
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const columns = [...new Set(rows.get(y))].sort((a, b) => a - b);
    let start = columns[0];
    let previous = columns[0];

    for (let index = 1; index <= columns.length; index += 1) {
      const current = columns[index];
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      obstacles.push({ x: start, y, width: previous - start + 1, height: 1 });
      start = current;
      previous = current;
    }
  }
  return obstacles;
}

export function colorWallTilesToRects(tiles) {
  const rows = new Map();
  for (const tile of tiles) {
    if (!isPlayableTile(tile.x, tile.y)) continue;
    const key = `${tile.color.toLowerCase()}|${tile.y}`;
    if (!rows.has(key)) rows.set(key, { color: tile.color, y: tile.y, columns: [] });
    rows.get(key).columns.push(tile.x);
  }

  const rects = [];
  const groups = [...rows.values()].sort((a, b) => (
    a.y - b.y || a.color.localeCompare(b.color)
  ));
  for (const group of groups) {
    const columns = [...new Set(group.columns)].sort((a, b) => a - b);
    let start = columns[0];
    let previous = columns[0];

    for (let index = 1; index <= columns.length; index += 1) {
      const current = columns[index];
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      rects.push({ x: start, y: group.y, width: previous - start + 1, height: 1, color: group.color });
      start = current;
      previous = current;
    }
  }
  return rects;
}

export function colorWallRectsToTiles(rects) {
  const tiles = [];
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        tiles.push({ x, y, color: rect.color });
      }
    }
  }
  return tiles;
}

export function stageToModel(stage) {
  return {
    schemaVersion: stage.schemaVersion,
    id: stage.id,
    number: stage.number,
    name: stage.name,
    start: { ...stage.start },
    walls: obstaclesToWallTiles(stage.obstacles),
    items: stage.items.map((item) => ({ ...item })),
    blocks: stage.blocks.map((block) => ({ ...block, kind: block.kind ?? 'normal' })),
    colorSwitches: stage.colorSwitches.map((colorSwitch) => ({ ...colorSwitch })),
    colorWalls: colorWallRectsToTiles(stage.colorWalls),
    lasers: stage.lasers.map((laser) => ({ ...laser })),
    magma: stage.magma.map((tile) => ({ ...tile })),
    goal: { ...stage.goal },
    goalBlock: stage.goalBlock ? { ...stage.goalBlock } : null,
    shortcutGate: stage.shortcutGate ? { ...stage.shortcutGate } : null,
    hint: stage.hint,
  };
}

export function modelToStage(model) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: model.id,
    number: model.number,
    name: model.name,
    start: { ...model.start },
    obstacles: wallTilesToObstacles(model.walls),
    items: model.items.map((item) => ({ ...item })),
    blocks: model.blocks.map((block) => ({ ...block })),
    colorSwitches: model.colorSwitches.map((colorSwitch) => ({ ...colorSwitch })),
    colorWalls: colorWallTilesToRects(model.colorWalls),
    lasers: model.lasers.map((laser) => ({ ...laser })),
    magma: model.magma.map((tile) => ({ ...tile })),
    goal: { ...model.goal },
    goalBlock: model.goalBlock ? { ...model.goalBlock } : null,
    shortcutGate: model.shortcutGate ? { ...model.shortcutGate } : null,
    hint: model.hint,
  };
}

export function snapshotModel(model) {
  return {
    ...model,
    start: { ...model.start },
    walls: [...model.walls],
    items: model.items.map((item) => ({ ...item })),
    blocks: model.blocks.map((block) => ({ ...block })),
    colorSwitches: model.colorSwitches.map((colorSwitch) => ({ ...colorSwitch })),
    colorWalls: model.colorWalls.map((wall) => ({ ...wall })),
    lasers: model.lasers.map((laser) => ({ ...laser })),
    magma: model.magma.map((tile) => ({ ...tile })),
    goal: { ...model.goal },
    goalBlock: model.goalBlock ? { ...model.goalBlock } : null,
    shortcutGate: model.shortcutGate ? { ...model.shortcutGate } : null,
  };
}

export function restoreSnapshot(snapshot) {
  return {
    ...snapshot,
    start: { ...snapshot.start },
    walls: new Set(snapshot.walls),
    items: snapshot.items.map((item) => ({ ...item })),
    blocks: snapshot.blocks.map((block) => ({ ...block })),
    colorSwitches: snapshot.colorSwitches.map((colorSwitch) => ({ ...colorSwitch })),
    colorWalls: snapshot.colorWalls.map((wall) => ({ ...wall })),
    lasers: snapshot.lasers.map((laser) => ({ ...laser })),
    magma: snapshot.magma.map((tile) => ({ ...tile })),
    goal: { ...snapshot.goal },
    goalBlock: snapshot.goalBlock ? { ...snapshot.goalBlock } : null,
    shortcutGate: snapshot.shortcutGate ? { ...snapshot.shortcutGate } : null,
  };
}

export function findBlock(model, id) {
  return model.blocks.find((block) => block.id === id) ?? null;
}

export function findItemIndex(model, type, x, y) {
  return model.items.findIndex((item) => item.type === type && item.x === x && item.y === y);
}

export function entityAt(model, x, y) {
  if (model.start.x === x && model.start.y === y) return { kind: 'start' };
  if (model.goal.x === x && model.goal.y === y) return { kind: 'goal' };
  if (model.goalBlock?.x === x && model.goalBlock?.y === y) return { kind: 'goalBlock' };
  if (model.shortcutGate?.x === x && model.shortcutGate?.y === y) return { kind: 'gate' };

  const block = model.blocks.find((candidate) => candidate.x === x && candidate.y === y);
  if (block) return { kind: 'block', id: block.id };

  const colorSwitch = model.colorSwitches.find((candidate) => candidate.x === x && candidate.y === y);
  if (colorSwitch) return { kind: 'colorSwitch', x, y };

  const item = model.items.find((candidate) => candidate.x === x && candidate.y === y);
  if (item) return { kind: 'item', type: item.type, x, y };

  if (model.walls.has(tileKey(x, y))) return { kind: 'wall', x, y };

  const colorWall = model.colorWalls.find((candidate) => candidate.x === x && candidate.y === y);
  if (colorWall) return { kind: 'colorWall', x, y };

  const laser = model.lasers.find((candidate) => candidate.x === x && candidate.y === y);
  if (laser) return { kind: 'laser', x, y };

  const magma = model.magma.find((candidate) => candidate.x === x && candidate.y === y);
  if (magma) return { kind: 'magma', x, y };

  return null;
}

export function occupancyLabel(selection) {
  if (!selection) return null;
  switch (selection.kind) {
    case 'start': return '開始位置';
    case 'goal': return 'ゴール';
    case 'goalBlock': return 'goalBlock';
    case 'gate': return 'ショートカットゲート';
    case 'block': return '木箱';
    case 'colorSwitch': return 'カラースイッチ';
    case 'colorWall': return 'カラー壁';
    case 'laser': return 'レーザー発射装置';
    case 'magma': return 'マグマ';
    case 'item': return ITEM_LABELS[selection.type] ?? 'アイテム';
    case 'wall': return '固定壁';
    default: return null;
  }
}

export function occupiedByOther(model, x, y, selection) {
  const isSelectedWall = selection?.kind === 'wall'
    && selection.x === x
    && selection.y === y;
  if (model.walls.has(tileKey(x, y)) && !isSelectedWall) {
    return '固定壁';
  }

  const checks = [
    { kind: 'start', x: model.start.x, y: model.start.y, label: '開始位置' },
    { kind: 'goal', x: model.goal.x, y: model.goal.y, label: 'ゴール' },
  ];
  if (model.goalBlock) checks.push({ kind: 'goalBlock', x: model.goalBlock.x, y: model.goalBlock.y, label: 'goalBlock' });
  if (model.shortcutGate) checks.push({ kind: 'gate', x: model.shortcutGate.x, y: model.shortcutGate.y, label: 'ショートカットゲート' });

  for (const check of checks) {
    if (check.x === x && check.y === y && selection?.kind !== check.kind) return check.label;
  }

  for (const block of model.blocks) {
    if (block.x === x && block.y === y && !(selection?.kind === 'block' && selection.id === block.id)) {
      return `木箱「${block.name}」`;
    }
  }

  for (const colorSwitch of model.colorSwitches) {
    const isSelected = selection?.kind === 'colorSwitch'
      && selection.x === x
      && selection.y === y;
    if (colorSwitch.x === x && colorSwitch.y === y && !isSelected) {
      return 'カラースイッチ';
    }
  }

  for (const colorWall of model.colorWalls) {
    const isSelected = selection?.kind === 'colorWall'
      && selection.x === x
      && selection.y === y;
    if (colorWall.x === x && colorWall.y === y && !isSelected) {
      return 'カラー壁';
    }
  }

  for (const laser of model.lasers) {
    const isSelected = selection?.kind === 'laser'
      && selection.x === x
      && selection.y === y;
    if (laser.x === x && laser.y === y && !isSelected) {
      return 'レーザー発射装置';
    }
  }

  for (const magma of model.magma) {
    const isSelected = selection?.kind === 'magma'
      && selection.x === x
      && selection.y === y;
    if (magma.x === x && magma.y === y && !isSelected) {
      return 'マグマ';
    }
  }

  for (const item of model.items) {
    const isSelectedItem = selection?.kind === 'item'
      && selection.type === item.type
      && selection.x === item.x
      && selection.y === item.y;
    if (item.x === x && item.y === y && !isSelectedItem) {
      return ITEM_LABELS[item.type] ?? 'アイテム';
    }
  }

  return null;
}

export function selectionTile(model, selection) {
  if (!selection) return null;
  switch (selection.kind) {
    case 'start': return { x: model.start.x, y: model.start.y };
    case 'goal': return { x: model.goal.x, y: model.goal.y };
    case 'goalBlock': return model.goalBlock ? { ...model.goalBlock } : null;
    case 'gate': return model.shortcutGate ? { ...model.shortcutGate } : null;
    case 'block': {
      const block = findBlock(model, selection.id);
      return block ? { x: block.x, y: block.y } : null;
    }
    case 'item':
    case 'wall':
    case 'colorSwitch':
    case 'colorWall':
    case 'laser':
    case 'magma':
      return { x: selection.x, y: selection.y };
    default:
      return null;
  }
}

export function makeBlockId(model) {
  let index = model.blocks.length + 1;
  while (model.blocks.some((block) => block.id === `block-${index}`)) index += 1;
  return `block-${index}`;
}
