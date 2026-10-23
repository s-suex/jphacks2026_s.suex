import InputHandler from '../core/InputHandler.js';
import StageManager from '../core/StageManager.js';
import BossQuizScene from './BossQuizScene.js';
import STAGES from '../data/stages.js';
import {
  UI_COLORS,
  drawDivider,
  drawEnergyGem,
  drawHeart,
  drawKeycap,
  drawPanel,
  drawPotion,
  drawVignette,
  roundedRectPath,
  shadeColor,
  truncateText,
} from '../ui/canvas-ui.js';

const COLORS = {
  background: '#091118',
  floor: '#16252f',
  floorAlt: 'rgba(255, 255, 255, 0.018)',
  grid: 'rgba(133, 176, 180, 0.06)',
  wall: '#2a3f4a',
  wallDark: '#1b2b35',
  wallTop: '#5d7b84',
  player: '#70e1c1',
  playerOutline: '#d5fff2',
  accent: '#f3c969',
  skillPotion: '#4aa8ff',
  lifePotion: '#ff5e68',
  locked: '#db7d59',
  unlocked: '#70e1c1',
  laser: '#ff5e68',
  laserGlow: 'rgba(255, 94, 104, 0.42)',
  magma: '#e0532f',
  magmaGlow: 'rgba(255, 150, 60, 0.55)',
  text: '#eff7f5',
  muted: '#a7b9b8',
};

const LASER_SHIELD_SECONDS = 5;
const LASER_DAMAGE_COOLDOWN = 1.2;

/** 1画面のCanvasダンジョンとプレイヤー操作を管理します。 */
export default class MainGameScene {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('MainGameSceneにはCanvas要素を指定してください。');
    }

    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    if (!this.context) throw new Error('Canvas 2Dコンテキストを取得できません。');

    this.width = canvas.width;
    this.height = canvas.height;
    this.tileSize = 40;
    this.elapsed = 0;
    this.stageManager = new StageManager(STAGES);
    this.stage = this.stageManager.current;
    this.player = {
      x: (this.stage.start.x + 0.5) * this.tileSize,
      y: (this.stage.start.y + 0.5) * this.tileSize,
      radius: 13,
      facing: this.stage.start.facing,
      hp: 3,
      maxHp: 3,
      skillEnergy: 1,
    };
    this.inventory = { skillPotion: 0, lifePotion: 0 };
    this.loadStage(this.stage);
    this.lastShortcutMessage = '矢印キー / WASD で1マスずつ移動';

    this.input = new InputHandler({
      onMove: (direction, pressed) => this.handleMove(direction, pressed),
      onShortcut: (shortcut) => this.handleShortcut(shortcut),
    });
    this.input.attach(canvas);
    this.bossQuiz = new BossQuizScene({
      canvas,
      player: this.player,
      onRetry: () => this.resetRun(),
    });
    this.gameOver = false;
    this.gameOverReason = '';
    this.canvas.addEventListener('click', this.focusCanvas);
  }

  handleRetryKeyDown = (event) => {
    if (!this.gameOver) return;
    if (event.key !== 'Enter' && event.key.toLowerCase() !== 'r') return;
    event.preventDefault();
    event.stopPropagation();
    this.retryStage();
  };

  focusCanvas = () => {
    this.canvas.focus({ preventScroll: true });
  };

  handleMove(direction, pressed) {
    if (!pressed || this.bossQuiz.active || this.gameOver) return;

    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const offset = offsets[direction];
    if (!offset) return;

    this.player.facing = direction;
    const tile = this.getPlayerTile();
    const nextX = tile.x + offset.x;
    const nextY = tile.y + offset.y;
    if (!this.canOccupy(nextX, nextY)) {
      this.lastShortcutMessage = 'そのマスには進めません';
      return;
    }

    this.recordUndo();
    this.player.x = (nextX + 0.5) * this.tileSize;
    this.player.y = (nextY + 0.5) * this.tileSize;
    this.collectNearbyItems();
    if (this.applyHazards(nextX, nextY)) return;
    this.checkGoal();
  }

  applyHazards(tileX, tileY) {
    const block = this.blocks.find((candidate) => candidate.x === tileX && candidate.y === tileY);
    if (this.isMagmaTile(tileX, tileY) && block?.kind !== 'normal') {
      this.triggerGameOver('マグマに落ちてしまった！');
      return true;
    }

    const laserTile = `${tileX},${tileY}`;
    const isOnLaser = this.laserBeamTiles.has(laserTile);
    const isShieldedByBlock = !!block && block.kind === 'normal' && this.shieldedBlocks.has(block);
    if (isOnLaser && this.laserDamageCooldown <= 0 && !isShieldedByBlock) {
      this.player.hp -= 1;
      this.laserDamageCooldown = LASER_DAMAGE_COOLDOWN;
      if (this.player.hp <= 0) {
        this.triggerGameOver('レーザーにやられてしまった！');
        return true;
      }
      this.lastShortcutMessage = 'レーザーに当たった！HP -1';
    }
    return false;
  }

  isMagmaTile(tileX, tileY) {
    return this.magma.some((tile) => tile.x === tileX && tile.y === tileY);
  }

  triggerGameOver(reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameOverReason = reason;
    this.lastShortcutMessage = `${reason} R / Enter でこのステージに再挑戦`;
    this.input.setEnabled(false);
    window.addEventListener('keydown', this.handleRetryKeyDown);
  }

  retryStage() {
    window.removeEventListener('keydown', this.handleRetryKeyDown);
    this.gameOver = false;
    this.gameOverReason = '';
    this.loadStage(this.stage);
    this.lastShortcutMessage = `STAGE ${this.stage.number} に再挑戦！`;
    this.input.setEnabled(true);
    this.canvas.focus({ preventScroll: true });
  }

  handleShortcut({ action, modifier }) {
    if (action === 'undo') {
      this.undo();
      return;
    }
    if (action === 'redo') {
      this.redo();
      return;
    }

    const target = this.getTargetTile();
    const blockIndex = this.blocks.findIndex((block) => block.x === target.x && block.y === target.y);
    const block = this.blocks[blockIndex];
    const modifierLabel = modifier === 'Meta' ? 'Cmd' : 'Ctrl';

    if (action === 'copy' || action === 'cut') {
      if (!block) {
        this.lastShortcutMessage = `${modifierLabel}+${action === 'copy' ? 'C' : 'X'}: 前方に操作可能なブロックがありません`;
        return;
      }
      this.recordUndo();
      this.clipboard = { ...block };
      if (action === 'cut') {
        this.blocks.splice(blockIndex, 1);
        this.openColors = this.computeOpenColors();
        this.rebuildLaserBeams();
      }
      if (action === 'copy' && this.stage.shortcutGate) this.shortcutGateOpen = true;
      const blockLabel = block.kind === 'colored' ? `色つき木箱「${block.name}」` : `「${block.name}」`;
      this.lastShortcutMessage = action === 'copy'
        ? `${blockLabel}をコピーしました${this.shortcutGateOpen ? '。裏道ゲートが開きました' : ''}`
        : `${blockLabel}を切り取りました`;
      return;
    }

    if (action === 'paste') {
      if (!this.clipboard) {
        this.lastShortcutMessage = 'クリップボードにブロックがありません';
        return;
      }
      if (!this.isEmptyFloor(target.x, target.y)) {
        this.lastShortcutMessage = '前方が空きマスではないため配置できません';
        return;
      }
      if (this.player.skillEnergy <= 0) {
        this.lastShortcutMessage = 'スキルエナジーが不足しています。青いポーションを集めよう';
        return;
      }
      this.recordUndo();
      this.player.skillEnergy -= 1;
      this.blockIdSequence += 1;
      this.blocks.push({
        ...this.clipboard,
        id: `block-${this.blockIdSequence}`,
        x: target.x,
        y: target.y,
        shieldRemaining: null,
      });
      const switchTile = this.colorSwitches.find((colorSwitch) => (
        colorSwitch.x === target.x && colorSwitch.y === target.y
      ));
      const isColored = this.clipboard.kind === 'colored';
      const matchesSwitch = switchTile && isColored
        && this.clipboard.color.toLowerCase() === switchTile.color.toLowerCase();

      if (matchesSwitch) {
        this.openColors = this.computeOpenColors();
        this.lastShortcutMessage = `同じ色のスイッチに${this.clipboard.name}を置きました。カラー壁が開きました！`;
      } else if (switchTile && isColored) {
        this.lastShortcutMessage = `スイッチの色と木箱の色が違うため反応しません（${switchTile.color} / ${this.clipboard.color}）`;
      } else if (switchTile) {
        this.lastShortcutMessage = 'ノーマル木箱ではカラースイッチは反応しません';
      } else {
        this.lastShortcutMessage = `${this.clipboard.name}を前方に配置しました`;
      }
      return;
    }

    this.lastShortcutMessage = `${modifierLabel}+${action.toUpperCase()} はブロック操作ではありません`;
  }

  getPlayerTile() {
    return {
      x: Math.floor(this.player.x / this.tileSize),
      y: Math.floor(this.player.y / this.tileSize),
    };
  }

  loadStage(stage) {
    this.stage = stage;
    this.obstacles = stage.obstacles.map((obstacle) => ({ ...obstacle }));
    this.items = stage.items.map((item) => ({ ...item, collected: false }));
    this.blocks = stage.blocks.map((block) => ({
      ...block,
      kind: block.kind ?? 'normal',
      shieldRemaining: null,
    }));
    this.initialBlocks = this.blocks.map((block) => ({ ...block }));
    this.colorSwitches = stage.colorSwitches.map((colorSwitch) => ({ ...colorSwitch }));
    this.colorWalls = stage.colorWalls.map((wall) => ({ ...wall }));
    this.lasers = stage.lasers.map((laser) => ({ ...laser }));
    this.magma = stage.magma.map((tile) => ({ ...tile }));
    this.openColors = this.computeOpenColors();
    this.blockIdSequence = this.blocks.length;
    this.goal = { ...stage.goal, radius: 19 };
    this.shortcutGateOpen = false;
    this.clipboard = null;
    this.undoStack = [];
    this.redoStack = [];
    this.laserBeamTiles = new Set();
    this.laserVisuals = [];
    this.shieldedBlocks = new Set();
    this.laserDamageCooldown = 0;
    this.gameOver = false;
    this.gameOverReason = '';
    this.rebuildLaserBeams();
    this.player.x = (stage.start.x + 0.5) * this.tileSize;
    this.player.y = (stage.start.y + 0.5) * this.tileSize;
    this.player.facing = stage.start.facing;
    const initialPotions = Number.isInteger(stage.initialSkillPotions) ? stage.initialSkillPotions : 0;
    this.inventory.skillPotion = initialPotions;
    this.inventory.lifePotion = 0;
    this.player.skillEnergy = 1 + initialPotions * 2;
    this.player.hp = this.player.maxHp;
  }

  getTargetTile() {
    const tile = this.getPlayerTile();
    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const offset = offsets[this.player.facing];
    return { x: tile.x + offset.x, y: tile.y + offset.y };
  }

  isFixedObstacle(tileX, tileY) {
    const isWall = this.obstacles.some((obstacle) => (
      tileX >= obstacle.x
      && tileX < obstacle.x + obstacle.width
      && tileY >= obstacle.y
      && tileY < obstacle.y + obstacle.height
    ));
    const gate = this.stage.shortcutGate;
    const isClosedGate = gate && !this.shortcutGateOpen && tileX === gate.x && tileY === gate.y;
    const isClosedColorWall = this.colorWalls.some((wall) => (
      !this.openColors.has(wall.color.toLowerCase())
      && tileX >= wall.x
      && tileX < wall.x + wall.width
      && tileY >= wall.y
      && tileY < wall.y + wall.height
    ));
    const isLaserEmitter = this.lasers.some((laser) => laser.x === tileX && laser.y === tileY);
    return isWall || isClosedGate || isClosedColorWall || isLaserEmitter;
  }

  isEmptyFloor(tileX, tileY) {
    const columns = this.width / this.tileSize;
    const rows = this.height / this.tileSize;
    if (tileX <= 0 || tileY <= 0 || tileX >= columns - 1 || tileY >= rows - 1) return false;
    if (this.isFixedObstacle(tileX, tileY)) return false;
    return !this.blocks.some((block) => block.x === tileX && block.y === tileY);
  }

  captureState() {
    return {
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      blocks: this.blocks.map((block) => ({ ...block })),
      clipboard: this.clipboard ? { ...this.clipboard } : null,
      shortcutGateOpen: this.shortcutGateOpen,
      openColors: [...this.openColors],
      skillEnergy: this.player.skillEnergy,
    };
  }

  restoreState(state) {
    this.player.x = state.x;
    this.player.y = state.y;
    this.player.facing = state.facing;
    this.blocks = state.blocks.map((block) => ({ ...block }));
    this.clipboard = state.clipboard ? { ...state.clipboard } : null;
    this.shortcutGateOpen = state.shortcutGateOpen;
    this.openColors = new Set(state.openColors);
    this.player.skillEnergy = state.skillEnergy;
    this.rebuildLaserBeams();
  }

  recordUndo() {
    this.undoStack.push(this.captureState());
    this.redoStack.length = 0;
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.lastShortcutMessage = '取り消せる操作がありません';
      return;
    }
    this.redoStack.push(this.captureState());
    this.restoreState(this.undoStack.pop());
    this.openColors = this.computeOpenColors();
    this.lastShortcutMessage = '直前の操作を取り消しました';
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.lastShortcutMessage = 'やり直せる操作がありません';
      return;
    }
    this.undoStack.push(this.captureState());
    this.restoreState(this.redoStack.pop());
    this.openColors = this.computeOpenColors();
    this.lastShortcutMessage = '操作をやり直しました';
  }

  computeOpenColors() {
    const open = new Set();
    for (const switchTile of this.colorSwitches) {
      const blocksOnSwitch = this.blocks.filter(
        (block) =>
          block.kind === 'colored' &&
          block.x === switchTile.x &&
          block.y === switchTile.y,
      );
      if (blocksOnSwitch.length > 0) {
        for (const block of blocksOnSwitch) {
          if (
            block.color &&
            block.color.toLowerCase() === switchTile.color.toLowerCase()
          ) {
            open.add(switchTile.color.toLowerCase());
          }
        }
      }
    }
    return open;
  }

  rebuildLaserBeams() {
    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const beamTiles = new Set();
    const shieldedBlocks = new Set();
    const visuals = [];
    const emitterTiles = new Set(this.lasers.map((laser) => `${laser.x},${laser.y}`));

    for (const laser of this.lasers) {
      const offset = offsets[laser.direction];
      if (!offset) continue;
      const cells = [];
      for (let step = 1; step <= laser.length; step += 1) {
        const tileX = laser.x + offset.x * step;
        const tileY = laser.y + offset.y * step;
        if (tileX <= 0 || tileY <= 0 || tileX >= this.width / this.tileSize - 1 || tileY >= this.height / this.tileSize - 1) {
          break;
        }
        if (this.isFixedObstacle(tileX, tileY)) break;
        if (emitterTiles.has(`${tileX},${tileY}`)) break;

        const block = this.blocks.find((candidate) => candidate.x === tileX && candidate.y === tileY);
        if (block && block.kind !== 'colored') {
          if (block.shieldRemaining == null) block.shieldRemaining = LASER_SHIELD_SECONDS;
          shieldedBlocks.add(block);
          break;
        }

        cells.push({ x: tileX, y: tileY });
        beamTiles.add(`${tileX},${tileY}`);
      }
      visuals.push({ laser, cells });
    }

    for (const block of this.blocks) {
      if (!shieldedBlocks.has(block)) block.shieldRemaining = null;
    }
    this.laserBeamTiles = beamTiles;
    this.laserVisuals = visuals;
    this.shieldedBlocks = shieldedBlocks;
  }

  updateLaserShields(deltaTime) {
    this.rebuildLaserBeams();
    const toDestroy = [];
    for (const block of this.shieldedBlocks) {
      if (block.shieldRemaining == null) continue;
      block.shieldRemaining -= deltaTime;
      if (block.shieldRemaining <= 0) {
        toDestroy.push(block);
      }
    }
    if (toDestroy.length === 0) return;

    this.blocks = this.blocks.filter((block) => !toDestroy.includes(block));
    this.lastShortcutMessage = 'レーザーで木箱が焼き切れた！ビームが再開した';
    this.rebuildLaserBeams();
    this.openColors = this.computeOpenColors();
    // If player stands on the same tile as destroyed block, move them
    for (const block of toDestroy) {
      const playerTile = this.getPlayerTile();
      if (playerTile.x === block.x && playerTile.y === block.y) {
        // push player to nearest empty tile
        const dirs = [
          { x: 0, y: -1 },
          { x: 0, y: 1 },
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ];
        for (const d of dirs) {
          const nx = playerTile.x + d.x;
          const ny = playerTile.y + d.y;
          if (this.canOccupy(nx, ny)) {
            this.player.x = (nx + 0.5) * this.tileSize;
            this.player.y = (ny + 0.5) * this.tileSize;
            break;
          }
        }
      }
    }
  }

  update(deltaTime = 0) {
    this.elapsed += deltaTime;
    if (this.laserDamageCooldown > 0) {
      this.laserDamageCooldown = Math.max(0, this.laserDamageCooldown - deltaTime);
    }
    if (this.gameOver) return;
    if (!this.bossQuiz.active) {
      this.updateLaserShields(deltaTime);
      this.collectNearbyItems();
    }
  }

  collectNearbyItems() {
    for (const item of this.items) {
      if (item.collected) continue;
      const itemX = (item.x + 0.5) * this.tileSize;
      const itemY = (item.y + 0.5) * this.tileSize;
      if (Math.hypot(this.player.x - itemX, this.player.y - itemY) > this.player.radius + 12) continue;

      item.collected = true;
      this.inventory[item.type] += 1;
      if (item.type === 'skillPotion') {
        this.player.skillEnergy += 2;
        this.lastShortcutMessage = '青いスキルポーションを入手！エナジー +2';
      } else {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.lastShortcutMessage = '赤いライフポーションを入手！HP +1';
      }
    }
  }

  checkGoal() {
    const tile = this.getPlayerTile();
    if (tile.x !== this.goal.x || tile.y !== this.goal.y) return;

    if (this.stage.goalBlock && !this.blocks.some((block) => (
      block.x === this.stage.goalBlock.x && block.y === this.stage.goalBlock.y
    ))) {
      this.lastShortcutMessage = 'ゴールの紋章に木箱を配置してください';
      return;
    }

    const nextStage = this.stageManager.advance();
    if (nextStage) {
      this.loadStage(nextStage);
      this.lastShortcutMessage = `STAGE ${nextStage.number}開始: ${nextStage.name}`;
      return;
    }

    this.input.setEnabled(false);
    this.bossQuiz.start();
  }

  isGoalUnlocked() {
    return !this.stage.goalBlock || this.blocks.some((block) => (
      block.x === this.stage.goalBlock.x && block.y === this.stage.goalBlock.y
    ));
  }

  resetRun() {
    window.removeEventListener('keydown', this.handleRetryKeyDown);
    this.bossQuiz.stop();
    this.player.hp = this.player.maxHp;
    this.inventory.lifePotion = 0;
    this.stage = this.stageManager.reset();
    this.loadStage(this.stage);
    this.lastShortcutMessage = 'ダンジョンに再挑戦！青いポーションを回収しよう';
    this.input.setEnabled(true);
    this.canvas.focus({ preventScroll: true });
  }

  canOccupy(tileX, tileY) {
    const columns = this.width / this.tileSize;
    const rows = this.height / this.tileSize;
    if (tileX <= 0 || tileY <= 0 || tileX >= columns - 1 || tileY >= rows - 1) return false;
    if (this.isFixedObstacle(tileX, tileY)) return false;

    const block = this.blocks.find((candidate) => candidate.x === tileX && candidate.y === tileY);
    if (this.isMagmaTile(tileX, tileY)) {
      if (!block) return true;
      return block.kind === 'normal';
    }
    if (block) return false;
    return true;
  }

  render() {
    const { context: ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawBackground(ctx);
    this.drawFloor(ctx);
    this.drawMagma(ctx);
    this.drawGoal(ctx);
    this.drawShortcutGate(ctx);
    this.drawGoalSocket(ctx);
    this.drawColorWalls(ctx);
    this.drawObstacles(ctx);
    this.drawColorSwitches(ctx);
    this.drawLasers(ctx);
    this.drawBlocks(ctx);
    this.drawItems(ctx);
    this.drawTargetCursor(ctx);
    this.drawPlayer(ctx);
    drawVignette(ctx, width, height);
    this.drawHud(ctx);
    this.bossQuiz.render(ctx, width, height, this.elapsed);
    this.drawGameOver(ctx);
  }

  drawGameOver(ctx) {
    if (!this.gameOver) return;
    const { width, height } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 9, 13, 0.74)';
    ctx.fillRect(0, 0, width, height);

    const panelWidth = 380;
    const panelHeight = 150;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    drawPanel(ctx, {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 18,
      fill: 'rgba(18, 30, 39, 0.97)',
      stroke: 'rgba(255, 94, 104, 0.6)',
      lineWidth: 1.5,
      shadowBlur: 26,
      shadowColor: 'rgba(255, 94, 104, 0.28)',
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.laser;
    ctx.font = '800 24px "Cascadia Code", Consolas, monospace';
    ctx.fillText('GAME OVER', width / 2, panelY + 42);
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.gameOverReason, panelWidth - 40), width / 2, panelY + 76);

    drawKeycap(ctx, width / 2 - 68, panelY + 100, 48, 20, 'R');
    drawKeycap(ctx, width / 2 - 12, panelY + 100, 64, 20, 'Enter');
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Yu Gothic UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('でこのステージに再挑戦', width / 2 + 60, panelY + 110);
    ctx.restore();
  }

  drawBackground(ctx) {
    const { width, height } = this;
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#0a141c');
    background.addColorStop(0.55, COLORS.background);
    background.addColorStop(1, '#0d1820');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, height * 0.44, 0, width / 2, height * 0.44, width * 0.55);
    glow.addColorStop(0, 'rgba(65, 126, 124, 0.14)');
    glow.addColorStop(0.6, 'rgba(30, 78, 84, 0.05)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  drawGoal(ctx) {
    const x = (this.goal.x + 0.5) * this.tileSize;
    const y = (this.goal.y + 0.5) * this.tileSize;
    const unlocked = this.isGoalUnlocked();
    const color = unlocked ? COLORS.unlocked : COLORS.accent;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.6);

    ctx.save();
    const halo = ctx.createRadialGradient(x, y, 2, x, y, 30);
    halo.addColorStop(0, unlocked ? 'rgba(112, 225, 193, 0.34)' : 'rgba(243, 201, 105, 0.28)');
    halo.addColorStop(0.55, unlocked ? 'rgba(112, 225, 193, 0.12)' : 'rgba(243, 201, 105, 0.09)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 34, y - 34, 68, 68);

    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fillStyle = unlocked ? 'rgba(112, 225, 193, 0.16)' : 'rgba(243, 201, 105, 0.11)';
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + pulse * 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.translate(x, y);
    ctx.rotate(this.elapsed * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0.15, Math.PI * 0.85);
    ctx.arc(0, 0, 21, Math.PI + 0.15, Math.PI * 1.85);
    ctx.strokeStyle = unlocked ? 'rgba(213, 255, 242, 0.55)' : 'rgba(243, 201, 105, 0.48)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-this.elapsed * 0.35);

    ctx.beginPath();
    const sparkle = 4.5 + pulse * 1.5;
    ctx.moveTo(0, -sparkle);
    ctx.lineTo(sparkle * 0.65, 0);
    ctx.lineTo(0, sparkle);
    ctx.lineTo(-sparkle * 0.65, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = '800 8px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unlocked ? 'GOAL' : 'LOCK', 0, 12);
    ctx.restore();
  }

  drawShortcutGate(ctx) {
    const gate = this.stage.shortcutGate;
    if (!gate) return;
    const x = gate.x * this.tileSize;
    const y = gate.y * this.tileSize;
    const open = this.shortcutGateOpen;
    const color = open ? COLORS.unlocked : COLORS.locked;

    drawPanel(ctx, {
      x: x + 3,
      y: y + 3,
      width: this.tileSize - 6,
      height: this.tileSize - 6,
      radius: 7,
      fill: open ? 'rgba(112, 225, 193, 0.13)' : 'rgba(219, 125, 89, 0.18)',
      stroke: color,
      lineWidth: 1.5,
      shadowBlur: open ? 12 : 0,
      shadowColor: 'rgba(112, 225, 193, 0.45)',
    });

    if (!open) {
      ctx.save();
      roundedRectPath(ctx, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8, 6);
      ctx.clip();
      ctx.strokeStyle = 'rgba(219, 125, 89, 0.18)';
      ctx.lineWidth = 1;
      for (let offset = -this.tileSize; offset < this.tileSize; offset += 7) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + this.tileSize);
        ctx.lineTo(x + offset + this.tileSize, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    if (open) {
      ctx.font = '800 15px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('»', x + this.tileSize / 2, y + 14);
    } else {
      ctx.strokeRect(x + 16, y + 9, 8, 6);
      ctx.beginPath();
      ctx.arc(x + 20, y + 9, 3, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '800 7.5px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'OPEN' : 'COPY', x + this.tileSize / 2, y + 27);
    ctx.restore();
  }

  drawGoalSocket(ctx) {
    if (!this.stage.goalBlock) return;
    const x = this.stage.goalBlock.x * this.tileSize;
    const y = this.stage.goalBlock.y * this.tileSize;
    const unlocked = this.isGoalUnlocked();
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.1);

    ctx.save();
    ctx.fillStyle = unlocked ? 'rgba(112, 225, 193, 0.06)' : `rgba(243, 201, 105, ${0.05 + pulse * 0.05})`;
    ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
    ctx.strokeStyle = unlocked ? 'rgba(112, 225, 193, 0.38)' : 'rgba(243, 201, 105, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -this.elapsed * 8;
    roundedRectPath(ctx, x + 6, y + 6, this.tileSize - 12, this.tileSize - 12, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    if (!unlocked) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = '800 7.5px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PLACE', x + this.tileSize / 2, y + this.tileSize / 2 + 1);
    }
    ctx.restore();
  }

  drawFloor(ctx) {
    const { width, height, tileSize } = this;
    const columns = width / tileSize;
    const rows = height / tileSize;
    const floorGradient = ctx.createLinearGradient(0, tileSize, 0, height - tileSize);
    floorGradient.addColorStop(0, '#1a2d38');
    floorGradient.addColorStop(0.5, COLORS.floor);
    floorGradient.addColorStop(1, '#111e27');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(tileSize, tileSize, width - tileSize * 2, height - tileSize * 2);

    for (let row = 1; row < rows - 1; row += 1) {
      for (let column = 1; column < columns - 1; column += 1) {
        if ((row + column) % 2 === 0) continue;
        ctx.fillStyle = COLORS.floorAlt;
        ctx.fillRect(column * tileSize, row * tileSize, tileSize, tileSize);
      }
    }

    ctx.beginPath();
    for (let x = tileSize; x <= width - tileSize; x += tileSize) {
      ctx.moveTo(x, tileSize);
      ctx.lineTo(x, height - tileSize);
    }
    for (let y = tileSize; y <= height - tileSize; y += tileSize) {
      ctx.moveTo(tileSize, y);
      ctx.lineTo(width - tileSize, y);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    const wallGradient = ctx.createLinearGradient(0, 0, 0, height);
    wallGradient.addColorStop(0, '#304650');
    wallGradient.addColorStop(0.5, COLORS.wallDark);
    wallGradient.addColorStop(1, '#22343e');
    ctx.fillStyle = wallGradient;
    ctx.fillRect(0, 0, width, tileSize);
    ctx.fillRect(0, height - tileSize, width, tileSize);
    ctx.fillRect(0, tileSize, tileSize, height - tileSize * 2);
    ctx.fillRect(width - tileSize, tileSize, tileSize, height - tileSize * 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(0, 1, width, 1);
    ctx.fillRect(0, height - tileSize, width, 1);
    ctx.fillRect(1, 0, 1, height);
    ctx.fillRect(width - 2, 0, 1, height);

    ctx.strokeStyle = 'rgba(112, 225, 193, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tileSize - 0.5, tileSize - 0.5, width - tileSize * 2 + 1, height - tileSize * 2 + 1);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.strokeRect(tileSize + 1.5, tileSize + 1.5, width - tileSize * 2 - 3, height - tileSize * 2 - 3);

    const corner = 16;
    const inset = 12;
    ctx.strokeStyle = 'rgba(243, 201, 105, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inset, inset + corner);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset + corner, inset);
    ctx.moveTo(width - inset - corner, inset);
    ctx.lineTo(width - inset, inset);
    ctx.lineTo(width - inset, inset + corner);
    ctx.moveTo(inset, height - inset - corner);
    ctx.lineTo(inset, height - inset);
    ctx.lineTo(inset + corner, height - inset);
    ctx.moveTo(width - inset - corner, height - inset);
    ctx.lineTo(width - inset, height - inset);
    ctx.lineTo(width - inset, height - inset - corner);
    ctx.stroke();
  }

  drawObstacles(ctx) {
    for (const obstacle of this.obstacles) {
      const x = obstacle.x * this.tileSize;
      const y = obstacle.y * this.tileSize;
      const width = obstacle.width * this.tileSize;
      const height = obstacle.height * this.tileSize;
      const gradient = ctx.createLinearGradient(0, y, 0, y + height);
      gradient.addColorStop(0, '#405b65');
      gradient.addColorStop(0.14, '#344b56');
      gradient.addColorStop(1, '#1f313b');

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      roundedRectPath(ctx, x + 3, y + 3, width - 6, height - 6, 5);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = 'rgba(157, 190, 196, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.fillRect(x + 7, y + 7, width - 14, 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(x + 7, y + height - 8, width - 14, 2);

      if (width >= this.tileSize && height >= this.tileSize) {
        ctx.fillStyle = 'rgba(157, 190, 196, 0.15)';
        ctx.fillRect(x + 10, y + 16, width - 20, 1);
      }
      ctx.restore();
    }
  }

  drawColorWalls(ctx) {
    for (const wall of this.colorWalls) {
      const open = this.openColors.has(wall.color.toLowerCase());
      for (let tileY = wall.y; tileY < wall.y + wall.height; tileY += 1) {
        for (let tileX = wall.x; tileX < wall.x + wall.width; tileX += 1) {
          const x = tileX * this.tileSize;
          const y = tileY * this.tileSize;
          const baseX = wall.x * this.tileSize;
          const baseY = wall.y * this.tileSize;
          const baseWidth = wall.width * this.tileSize;
          const baseHeight = wall.height * this.tileSize;

          if (open) {
            ctx.save();
            ctx.strokeStyle = wall.color;
            ctx.globalAlpha = 0.28;
            ctx.lineWidth = 1.5;
            roundedRectPath(ctx, x + 6, y + 6, this.tileSize - 12, this.tileSize - 12, 4);
            ctx.stroke();
            ctx.restore();
            continue;
          }

          ctx.save();
          const gradient = ctx.createLinearGradient(0, y, 0, y + this.tileSize);
          gradient.addColorStop(0, shadeColor(wall.color, 26));
          gradient.addColorStop(0.55, wall.color);
          gradient.addColorStop(1, shadeColor(wall.color, -46));
          ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 2;
          roundedRectPath(ctx, x + 3, y + 3, this.tileSize - 6, this.tileSize - 6, 5);
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.shadowColor = 'transparent';

          roundedRectPath(ctx, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8, 4);
          ctx.clip();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1;
          for (let offset = -this.tileSize; offset < this.tileSize; offset += 8) {
            ctx.beginPath();
            ctx.moveTo(x + offset, y + this.tileSize);
            ctx.lineTo(x + offset + this.tileSize, y);
            ctx.stroke();
          }
          ctx.restore();

          if (tileX === wall.x && tileY === wall.y) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.font = '800 7px "Cascadia Code", Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('COLOR', baseX + baseWidth / 2, baseY + baseHeight / 2);
            ctx.restore();
          }
        }
      }
    }
  }

  drawMagma(ctx) {
    for (const tile of this.magma) {
      const x = tile.x * this.tileSize;
      const y = tile.y * this.tileSize;
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4 + tile.x * 0.8 + tile.y * 0.5);

      ctx.save();
      const glow = ctx.createRadialGradient(
        x + this.tileSize / 2,
        y + this.tileSize / 2,
        2,
        x + this.tileSize / 2,
        y + this.tileSize / 2,
        this.tileSize * 0.7,
      );
      glow.addColorStop(0, 'rgba(255, 176, 74, 0.5)');
      glow.addColorStop(1, 'rgba(255, 90, 45, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 6, y - 6, this.tileSize + 12, this.tileSize + 12);

      const lava = ctx.createLinearGradient(0, y, 0, y + this.tileSize);
      lava.addColorStop(0, '#ffa23f');
      lava.addColorStop(0.45, COLORS.magma);
      lava.addColorStop(1, '#8e2b19');
      ctx.fillStyle = lava;
      ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);

      ctx.fillStyle = `rgba(255, 224, 138, ${0.35 + pulse * 0.4})`;
      for (let offset = 9; offset < this.tileSize - 4; offset += 9) {
        const bubble = Math.sin(this.elapsed * 2 + offset + tile.x) * 2;
        ctx.beginPath();
        ctx.arc(x + offset, y + this.tileSize - 12 + bubble, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255, 194, 102, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2.5, y + 2.5, this.tileSize - 5, this.tileSize - 5);
      ctx.restore();
    }
  }

  drawLasers(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 6);
    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    for (const visual of this.laserVisuals) {
      const direction = directions[visual.laser.direction] ?? directions.right;
      for (const cell of visual.cells) {
        const x = cell.x * this.tileSize;
        const y = cell.y * this.tileSize;
        ctx.save();
        const glow = ctx.createRadialGradient(
          x + this.tileSize / 2,
          y + this.tileSize / 2,
          2,
          x + this.tileSize / 2,
          y + this.tileSize / 2,
          this.tileSize * 0.62,
        );
        glow.addColorStop(0, `rgba(255, 94, 104, ${0.5 + pulse * 0.25})`);
        glow.addColorStop(1, 'rgba(255, 94, 104, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 4, y - 4, this.tileSize + 8, this.tileSize + 8);

        ctx.strokeStyle = `rgba(255, 148, 156, ${0.55 + pulse * 0.35})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -this.elapsed * 34;
        ctx.beginPath();
        ctx.moveTo(
          x + this.tileSize / 2 - direction.x * 10,
          y + this.tileSize / 2 - direction.y * 10,
        );
        ctx.lineTo(
          x + this.tileSize / 2 + direction.x * 10,
          y + this.tileSize / 2 + direction.y * 10,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      this.drawLaserEmitter(ctx, visual.laser, pulse);
    }
  }

  drawLaserEmitter(ctx, laser, pulse) {
    const x = laser.x * this.tileSize;
    const y = laser.y * this.tileSize;
    const centerX = x + this.tileSize / 2;
    const centerY = y + this.tileSize / 2;
    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const direction = offsets[laser.direction] ?? offsets.right;

    ctx.save();
    const body = ctx.createLinearGradient(0, y, 0, y + this.tileSize);
    body.addColorStop(0, '#5b3340');
    body.addColorStop(1, '#2a1a22');
    roundedRectPath(ctx, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8, 6);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = COLORS.laser;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.shadowColor = COLORS.laser;
    ctx.shadowBlur = 8 + pulse * 8;
    ctx.fillStyle = '#ff9ba2';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.laser;
    ctx.beginPath();
    ctx.moveTo(centerX + direction.x * 13, centerY + direction.y * 13);
    ctx.lineTo(
      centerX - direction.y * 5 - direction.x * 5,
      centerY + direction.x * 5 - direction.y * 5,
    );
    ctx.lineTo(
      centerX + direction.y * 5 - direction.x * 5,
      centerY - direction.x * 5 - direction.y * 5,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawColorSwitches(ctx) {
    for (const colorSwitch of this.colorSwitches) {
      const x = (colorSwitch.x + 0.5) * this.tileSize;
      const y = (colorSwitch.y + 0.5) * this.tileSize;
      const open = this.openColors.has(colorSwitch.color.toLowerCase());
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.2 + colorSwitch.x);

      ctx.save();
      const halo = ctx.createRadialGradient(x, y, 1, x, y, 22);
      halo.addColorStop(0, `${colorSwitch.color}55`);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - 22, y - 22, 44, 44);

      ctx.strokeStyle = colorSwitch.color;
      ctx.shadowColor = colorSwitch.color;
      ctx.shadowBlur = open ? 4 : 8 + pulse * 6;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(x, y, open ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = open ? 'rgba(255, 255, 255, 0.85)' : colorSwitch.color;
      ctx.fill();

      ctx.fillStyle = open ? '#d5fff2' : colorSwitch.color;
      ctx.font = '800 7px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(open ? 'OPEN' : 'COLOR', x, y + 20);
      ctx.restore();
    }
  }

  drawBlocks(ctx) {
    for (const block of this.blocks) {
      const x = block.x * this.tileSize;
      const y = block.y * this.tileSize;
      const colored = block.kind === 'colored';
      const gradient = ctx.createLinearGradient(0, y + 4, 0, y + this.tileSize - 4);
      gradient.addColorStop(0, shadeColor(block.color, 24));
      gradient.addColorStop(0.48, block.color);
      gradient.addColorStop(1, shadeColor(block.color, -38));

      ctx.save();
      if (colored) {
        ctx.shadowColor = block.color;
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
      }
      ctx.shadowOffsetY = 4;
      roundedRectPath(ctx, x + 5, y + 4, this.tileSize - 10, this.tileSize - 11, 5);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = colored ? '#ffffff' : 'rgba(255, 239, 210, 0.55)';
      ctx.lineWidth = colored ? 1.6 : 1.2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 247, 233, 0.22)';
      ctx.fillRect(x + 9, y + 8, this.tileSize - 18, 3);
      ctx.fillStyle = 'rgba(38, 22, 12, 0.28)';
      ctx.fillRect(x + 8, y + this.tileSize - 12, this.tileSize - 16, 2);

      ctx.fillStyle = '#fff7e9';
      ctx.font = `800 ${block.name.length > 4 ? 8 : 10}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateText(ctx, block.name, this.tileSize - 12), x + this.tileSize / 2, y + this.tileSize / 2 + 1);

      if (colored) {
        ctx.beginPath();
        ctx.arc(x + this.tileSize - 10, y + 10, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255, 247, 233, 0.55)';
      ctx.beginPath();
      ctx.arc(x + 10, y + this.tileSize - 11, 1.2, 0, Math.PI * 2);
      ctx.arc(x + this.tileSize - 10, y + this.tileSize - 11, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (!colored && block.shieldRemaining != null) {
        const ratio = Math.max(0, Math.min(1, block.shieldRemaining / LASER_SHIELD_SECONDS));
        const centerX = x + this.tileSize / 2;
        const centerY = y + this.tileSize / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 94, 104, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.tileSize / 2 - 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = COLORS.laser;
        ctx.shadowColor = COLORS.laser;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.tileSize / 2 - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.text;
        ctx.font = '800 8px "Cascadia Code", Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(block.shieldRemaining)}s`, centerX, y + 9);
        ctx.restore();
      }
    }
  }

  drawTargetCursor(ctx) {
    const target = this.getTargetTile();
    const x = target.x * this.tileSize;
    const y = target.y * this.tileSize;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 4);
    const length = 8;

    ctx.save();
    ctx.fillStyle = `rgba(112, 225, 193, ${0.035 + pulse * 0.035})`;
    ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
    ctx.strokeStyle = `rgba(172, 255, 226, ${0.55 + pulse * 0.28})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5 + length);
    ctx.lineTo(x + 5, y + 5);
    ctx.lineTo(x + 5 + length, y + 5);
    ctx.moveTo(x + this.tileSize - 5 - length, y + 5);
    ctx.lineTo(x + this.tileSize - 5, y + 5);
    ctx.lineTo(x + this.tileSize - 5, y + 5 + length);
    ctx.moveTo(x + 5, y + this.tileSize - 5 - length);
    ctx.lineTo(x + 5, y + this.tileSize - 5);
    ctx.lineTo(x + 5 + length, y + this.tileSize - 5);
    ctx.moveTo(x + this.tileSize - 5 - length, y + this.tileSize - 5);
    ctx.lineTo(x + this.tileSize - 5, y + this.tileSize - 5);
    ctx.lineTo(x + this.tileSize - 5, y + this.tileSize - 5 - length);
    ctx.stroke();
    ctx.restore();
  }

  drawItems(ctx) {
    for (const item of this.items) {
      if (item.collected) continue;
      const x = (item.x + 0.5) * this.tileSize;
      const y = (item.y + 0.5) * this.tileSize;
      const bob = Math.sin(this.elapsed * 3 + item.x * 0.9 + item.y * 0.7) * 2.4;
      const color = item.type === 'skillPotion' ? COLORS.skillPotion : COLORS.lifePotion;
      const label = item.type === 'skillPotion' ? 'S' : '+';

      ctx.save();
      const halo = ctx.createRadialGradient(x, y + bob, 1, x, y + bob, 21);
      halo.addColorStop(0, item.type === 'skillPotion' ? 'rgba(74, 168, 255, 0.28)' : 'rgba(255, 94, 104, 0.26)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - 22, y + bob - 22, 44, 44);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y + 13, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      drawPotion(ctx, x, y + bob, 18, color, label);
      ctx.restore();
    }
  }

  drawHud(ctx) {
    ctx.save();
    const panelFill = ctx.createLinearGradient(0, 10, 0, 64);
    panelFill.addColorStop(0, 'rgba(22, 41, 51, 0.94)');
    panelFill.addColorStop(1, 'rgba(8, 17, 24, 0.88)');
    this.drawBrandPanel(ctx, panelFill);
    this.drawStagePanel(ctx, panelFill);
    this.drawStatusPanel(ctx, panelFill);
    this.drawMessageBar(ctx);
    ctx.restore();
  }

  drawBrandPanel(ctx, panelFill) {
    drawPanel(ctx, {
      x: 52,
      y: 10,
      width: 210,
      height: 54,
      radius: 14,
      fill: panelFill,
      shadowBlur: 16,
      shadowOffsetY: 5,
      highlight: true,
    });
    drawPanel(ctx, {
      x: 64,
      y: 23,
      width: 28,
      height: 28,
      radius: 9,
      fill: 'rgba(243, 201, 105, 0.1)',
      stroke: 'rgba(243, 201, 105, 0.5)',
      lineWidth: 1.2,
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.accent;
    ctx.font = '800 14px "Cascadia Code", Consolas, monospace';
    ctx.fillText('K', 78, 38);

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 12px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('SHORTCUT', 102, 30);
    ctx.fillStyle = COLORS.unlocked;
    ctx.font = '800 12px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('DUNGEON', 102, 46);
  }

  drawStagePanel(ctx, panelFill) {
    drawPanel(ctx, {
      x: 274,
      y: 10,
      width: 270,
      height: 54,
      radius: 14,
      fill: panelFill,
      shadowBlur: 16,
      shadowOffsetY: 5,
      highlight: true,
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('STAGE', 288, 23);

    ctx.fillStyle = COLORS.accent;
    ctx.font = '800 24px "Cascadia Code", Consolas, monospace';
    ctx.fillText(String(this.stage.number).padStart(2, '0'), 287, 45);

    drawDivider(ctx, 334, 18, 38);

    ctx.fillStyle = COLORS.text;
    ctx.font = '700 13px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.stage.name, 128), 346, 28);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Yu Gothic UI", sans-serif';
    const hint = this.stage.hint || '自由に探索してゴールを目指そう';
    ctx.fillText(truncateText(ctx, hint, 188), 346, 48);

    const ready = this.isGoalUnlocked();
    const statusColor = ready ? COLORS.unlocked : COLORS.accent;
    drawPanel(ctx, {
      x: 480,
      y: 18,
      width: 52,
      height: 19,
      radius: 9,
      fill: ready ? 'rgba(112, 225, 193, 0.12)' : 'rgba(243, 201, 105, 0.12)',
      stroke: ready ? 'rgba(112, 225, 193, 0.45)' : 'rgba(243, 201, 105, 0.45)',
      lineWidth: 1,
    });
    ctx.fillStyle = statusColor;
    ctx.shadowColor = statusColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(491, 27.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '800 8px "Cascadia Code", Consolas, monospace';
    ctx.fillText(ready ? 'READY' : 'LOCK', 499, 28);
  }

  drawStatusPanel(ctx, panelFill) {
    drawPanel(ctx, {
      x: 556,
      y: 10,
      width: 352,
      height: 54,
      radius: 14,
      fill: panelFill,
      shadowBlur: 16,
      shadowOffsetY: 5,
      highlight: true,
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';

    ctx.fillText('LIFE', 570, 23);
    for (let index = 0; index < this.player.maxHp; index += 1) {
      drawHeart(ctx, 572 + index * 22, 43, 14, COLORS.lifePotion, index < this.player.hp);
    }

    drawDivider(ctx, 640, 18, 38);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('SKILL', 650, 23);
    drawEnergyGem(ctx, 656, 43, 8, COLORS.skillPotion, this.player.skillEnergy > 0);
    ctx.fillStyle = COLORS.skillPotion;
    ctx.font = '800 11px "Cascadia Code", Consolas, monospace';
    ctx.fillText(`x${this.player.skillEnergy}`, 668, 43);

    drawDivider(ctx, 704, 18, 38);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('ITEMS', 716, 23);
    drawPotion(ctx, 723, 43, 13, COLORS.skillPotion, 'S');
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 10px "Cascadia Code", Consolas, monospace';
    ctx.fillText(`x${this.inventory.skillPotion}`, 735, 43);
    drawPotion(ctx, 771, 43, 13, COLORS.lifePotion, '+');
    ctx.fillText(`x${this.inventory.lifePotion}`, 783, 43);

    drawDivider(ctx, 812, 18, 38);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('CLIP', 822, 23);
    drawKeycap(ctx, 822, 33, 17, 17, 'C', { color: COLORS.unlocked });
    ctx.fillStyle = this.clipboard ? COLORS.text : COLORS.muted;
    ctx.font = '700 10.5px "Yu Gothic UI", sans-serif';
    const clipboardLabel = this.clipboard
      ? `${this.clipboard.kind === 'colored' ? '色:' : ''}${this.clipboard.name}`
      : 'なし';
    ctx.fillText(truncateText(ctx, clipboardLabel, 52), 845, 42);
  }

  drawMessageBar(ctx) {
    drawPanel(ctx, {
      x: 52,
      y: this.height - 39,
      width: this.width - 104,
      height: 30,
      radius: 10,
      fill: 'rgba(7, 15, 21, 0.94)',
      stroke: 'rgba(157, 212, 208, 0.18)',
      shadowBlur: 12,
      shadowOffsetY: 4,
    });

    const pulse = 0.6 + 0.4 * Math.sin(this.elapsed * 2.2);
    ctx.fillStyle = COLORS.unlocked;
    ctx.shadowColor = COLORS.unlocked;
    ctx.shadowBlur = 6 * pulse;
    ctx.beginPath();
    ctx.arc(66, this.height - 24, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.font = '11.5px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.lastShortcutMessage, 500), 78, this.height - 23);

    drawKeycap(ctx, 682, this.height - 30, 44, 18, 'Ctrl+Z');
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('Undo', 734, this.height - 21);
    drawKeycap(ctx, 786, this.height - 30, 44, 18, 'Ctrl+Y');
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('Redo', 838, this.height - 21);
  }

  drawPlayer(ctx) {
    const { x, radius } = this.player;
    const y = this.player.y + Math.sin(this.elapsed * 3.4) * 1.2;
    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const direction = directions[this.player.facing] ?? directions.right;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x, this.player.y + radius + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(x, y, 2, x, y, radius + 16);
    glow.addColorStop(0, 'rgba(112, 225, 193, 0.4)');
    glow.addColorStop(0.55, 'rgba(112, 225, 193, 0.12)');
    glow.addColorStop(1, 'rgba(112, 225, 193, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius - 18, y - radius - 18, (radius + 18) * 2, (radius + 18) * 2);

    const body = ctx.createRadialGradient(x - 5, y - 6, 1, x, y, radius);
    body.addColorStop(0, '#d5fff2');
    body.addColorStop(0.35, '#8ff0d6');
    body.addColorStop(1, '#38a98f');
    ctx.shadowColor = 'rgba(112, 225, 193, 0.65)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x - 3.5, y - 4, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.fill();

    const arrowX = x + direction.x * (radius + 6);
    const arrowY = y + direction.y * (radius + 6);
    ctx.translate(arrowX, arrowY);
    ctx.rotate(Math.atan2(direction.y, direction.x) + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fillStyle = COLORS.playerOutline;
    ctx.shadowColor = COLORS.unlocked;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  dispose() {
    window.removeEventListener('keydown', this.handleRetryKeyDown);
    this.input.detach();
    this.bossQuiz.dispose();
    this.canvas.removeEventListener('click', this.focusCanvas);
  }
}
