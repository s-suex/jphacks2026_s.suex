import {
  GRID_COLUMNS,
  GRID_ROWS,
  TILE_SIZE,
  tileKey,
} from '@shortcut-dungeon/stage-schema';

const COLORS = {
  background: '#101923',
  floor: '#172631',
  grid: 'rgba(157, 190, 196, 0.09)',
  wall: '#344955',
  wallTop: '#526b75',
  player: '#70e1c1',
  playerOutline: '#d5fff2',
  accent: '#f3c969',
  skillPotion: '#4aa8ff',
  lifePotion: '#ff5e68',
  locked: '#db7d59',
  text: '#eff7f5',
  muted: '#a7b9b8',
  selection: '#ffe48a',
  error: '#ff5e68',
  warning: '#f3c969',
};

const FACING_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function drawFloor(ctx, preview) {
  const inset = TILE_SIZE;
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(inset, inset, (GRID_COLUMNS - 2) * TILE_SIZE, (GRID_ROWS - 2) * TILE_SIZE);

  if (!preview) {
    ctx.beginPath();
    for (let column = 1; column < GRID_COLUMNS; column += 1) {
      ctx.moveTo(column * TILE_SIZE, TILE_SIZE);
      ctx.lineTo(column * TILE_SIZE, (GRID_ROWS - 1) * TILE_SIZE);
    }
    for (let row = 1; row < GRID_ROWS; row += 1) {
      ctx.moveTo(TILE_SIZE, row * TILE_SIZE);
      ctx.lineTo((GRID_COLUMNS - 1) * TILE_SIZE, row * TILE_SIZE);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBorder(ctx) {
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, GRID_COLUMNS * TILE_SIZE, TILE_SIZE);
  ctx.fillRect(0, (GRID_ROWS - 1) * TILE_SIZE, GRID_COLUMNS * TILE_SIZE, TILE_SIZE);
  ctx.fillRect(0, TILE_SIZE, TILE_SIZE, (GRID_ROWS - 2) * TILE_SIZE);
  ctx.fillRect((GRID_COLUMNS - 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE, (GRID_ROWS - 2) * TILE_SIZE);

  ctx.strokeStyle = COLORS.wallTop;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    TILE_SIZE,
    TILE_SIZE,
    (GRID_COLUMNS - 2) * TILE_SIZE,
    (GRID_ROWS - 2) * TILE_SIZE,
  );
}

function drawWalls(ctx, walls) {
  for (const key of walls) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(x * TILE_SIZE + 3, y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 6, TILE_SIZE - 12, 5);
  }
}

function drawGoalSocket(ctx, goalBlock) {
  if (!goalBlock) return;
  const x = goalBlock.x * TILE_SIZE;
  const y = goalBlock.y * TILE_SIZE;
  ctx.save();
  ctx.strokeStyle = 'rgba(243, 201, 105, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PLACE', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 3);
  ctx.restore();
}

function drawGate(ctx, gate) {
  if (!gate) return;
  const x = gate.x * TILE_SIZE;
  const y = gate.y * TILE_SIZE;
  ctx.fillStyle = 'rgba(219, 125, 89, 0.35)';
  ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  ctx.strokeStyle = COLORS.locked;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.fillStyle = COLORS.locked;
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('COPY', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 3);
}

function drawGoal(ctx, goal) {
  const x = (goal.x + 0.5) * TILE_SIZE;
  const y = (goal.y + 0.5) * TILE_SIZE;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 19, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(243, 201, 105, 0.18)';
  ctx.fill();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', x, y + 4);
  ctx.restore();
}

function drawColorWalls(ctx, colorWalls) {
  for (const wall of colorWalls) {
    const x = wall.x * TILE_SIZE;
    const y = wall.y * TILE_SIZE;
    ctx.save();
    ctx.fillStyle = wall.color;
    ctx.globalAlpha = 0.42;
    ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = wall.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let offset = -TILE_SIZE; offset < TILE_SIZE; offset += 8) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + TILE_SIZE);
      ctx.lineTo(x + offset + TILE_SIZE, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawColorSwitches(ctx, colorSwitches) {
  for (const colorSwitch of colorSwitches) {
    const x = (colorSwitch.x + 0.5) * TILE_SIZE;
    const y = (colorSwitch.y + 0.5) * TILE_SIZE;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 16, 22, 0.6)';
    ctx.fillRect(colorSwitch.x * TILE_SIZE + 4, colorSwitch.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.shadowColor = colorSwitch.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = colorSwitch.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colorSwitch.color;
    ctx.fill();
    ctx.restore();
  }
}

function drawMagma(ctx, magma) {
  for (const tile of magma) {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;
    ctx.save();
    ctx.fillStyle = '#e0532f';
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = 'rgba(255, 196, 92, 0.55)';
    for (let offset = 8; offset < TILE_SIZE - 4; offset += 10) {
      ctx.beginPath();
      ctx.arc(x + offset, y + TILE_SIZE - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.restore();
  }
}

function drawLasers(ctx, lasers) {
  for (const laser of lasers) {
    const vector = FACING_VECTORS[laser.direction] ?? FACING_VECTORS.right;
    const centerX = (laser.x + 0.5) * TILE_SIZE;
    const centerY = (laser.y + 0.5) * TILE_SIZE;
    const endX = centerX + vector.x * laser.length * TILE_SIZE;
    const endY = centerY + vector.y * laser.length * TILE_SIZE;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 94, 104, 0.65)';
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#5b2b36';
    ctx.fillRect(laser.x * TILE_SIZE + 5, laser.y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    ctx.strokeStyle = '#ff5e68';
    ctx.lineWidth = 2;
    ctx.strokeRect(laser.x * TILE_SIZE + 6, laser.y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    ctx.fillStyle = '#ff8b93';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5e68';
    ctx.beginPath();
    ctx.moveTo(centerX + vector.x * 12, centerY + vector.y * 12);
    ctx.lineTo(centerX - vector.y * 6 - vector.x * 6, centerY + vector.x * 6 - vector.y * 6);
    ctx.lineTo(centerX + vector.y * 6 - vector.x * 6, centerY - vector.x * 6 - vector.y * 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawBlocks(ctx, blocks) {
  for (const block of blocks) {
    const x = block.x * TILE_SIZE;
    const y = block.y * TILE_SIZE;
    const colored = block.kind === 'colored';
    ctx.save();
    if (colored) {
      ctx.shadowColor = block.color;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = block.color;
    ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colored ? '#ffffff' : '#e8d1ae';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 7, y + 7, TILE_SIZE - 14, TILE_SIZE - 14);
    if (colored) {
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE - 10, y + 10, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.fillStyle = '#fff7e9';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(block.name, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 4, TILE_SIZE - 10);
    ctx.restore();
  }
}

function drawItems(ctx, items) {
  for (const item of items) {
    const x = (item.x + 0.5) * TILE_SIZE;
    const y = (item.y + 0.5) * TILE_SIZE;
    const isSkill = item.type === 'skillPotion';
    ctx.save();
    ctx.shadowColor = isSkill ? COLORS.skillPotion : COLORS.lifePotion;
    ctx.shadowBlur = 13;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = isSkill ? COLORS.skillPotion : COLORS.lifePotion;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isSkill ? 'S' : '+', x, y + 4);
    ctx.restore();
  }
}

function drawStart(ctx, start) {
  const x = (start.x + 0.5) * TILE_SIZE;
  const y = (start.y + 0.5) * TILE_SIZE;
  const vector = FACING_VECTORS[start.facing] ?? FACING_VECTORS.right;

  ctx.save();
  ctx.shadowColor = 'rgba(112, 225, 193, 0.55)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.playerOutline;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + vector.x * 24, y + vector.y * 24);
  ctx.strokeStyle = COLORS.playerOutline;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + vector.x * 24, y + vector.y * 24, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.playerOutline;
  ctx.fill();
  ctx.restore();
}

function drawSelection(ctx, tile) {
  if (!tile) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 228, 138, 0.12)';
  ctx.fillRect(tile.x * TILE_SIZE + 2, tile.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  ctx.strokeStyle = COLORS.selection;
  ctx.lineWidth = 3;
  ctx.strokeRect(tile.x * TILE_SIZE + 3, tile.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  ctx.restore();
}

function drawHover(ctx, tile, tool) {
  if (!tile) return;
  const isErase = tool === 'erase';
  ctx.save();
  ctx.strokeStyle = isErase ? COLORS.error : 'rgba(172, 255, 226, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash(isErase ? [5, 3] : []);
  ctx.strokeRect(tile.x * TILE_SIZE + 3, tile.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  ctx.restore();
}

function drawDiagnostics(ctx, validation) {
  const marked = new Set();
  for (const diagnostic of validation.errors) {
    if (!diagnostic.tile) continue;
    const { x, y } = diagnostic.tile;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (x < 0 || x >= GRID_COLUMNS || y < 0 || y >= GRID_ROWS) continue;
    const key = tileKey(x, y);
    if (marked.has(key)) continue;
    marked.add(key);
    ctx.fillStyle = 'rgba(255, 94, 104, 0.28)';
    ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeStyle = COLORS.error;
    ctx.lineWidth = 2;
    ctx.strokeRect(x * TILE_SIZE + 3, y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  }
}

export function renderEditor(canvas, store, hover) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { model, selection, preview, validation, tool } = store;
  const selectedTile = store.getSelectedTile();

  const pixelWidth = GRID_COLUMNS * TILE_SIZE;
  const pixelHeight = GRID_ROWS * TILE_SIZE;

  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  drawFloor(ctx, preview);
  drawBorder(ctx);
  drawGoalSocket(ctx, model.goalBlock);
  drawGate(ctx, model.shortcutGate);
  drawWalls(ctx, model.walls);
  drawColorWalls(ctx, model.colorWalls);
  drawMagma(ctx, model.magma);
  drawGoal(ctx, model.goal);
  drawColorSwitches(ctx, model.colorSwitches);
  drawLasers(ctx, model.lasers);
  drawBlocks(ctx, model.blocks);
  drawItems(ctx, model.items);
  drawStart(ctx, model.start);

  if (!preview) {
    drawSelection(ctx, selectedTile);
    drawHover(ctx, hover, tool);
    drawDiagnostics(ctx, validation);
  }

  ctx.textAlign = 'left';
}

export { COLORS };
