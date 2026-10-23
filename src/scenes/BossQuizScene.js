import { drawHeart, drawKeycap, drawPanel, truncateText } from '../ui/canvas-ui.js';

const QUIZZES = [
  { key: 'z', question: '操作をひとつ前の状態に戻すには？', answer: 'Ctrl+Z' },
  { key: 'c', question: '選択した内容をコピーするには？', answer: 'Ctrl+C' },
  { key: 'v', question: 'コピーした内容を貼り付けるには？', answer: 'Ctrl+V' },
];

/** 実際のショートカット入力で回答するボス戦モーダルです。 */
export default class BossQuizScene {
  constructor({ canvas, player, onRetry }) {
    this.canvas = canvas;
    this.player = player;
    this.onRetry = onRetry;
    this.platform = /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform ?? '')
      ? 'mac'
      : 'windows';
    this.active = false;
    this.state = 'inactive';
    this.questionIndex = 0;
    this.correctCount = 0;
    this.feedback = '';
    this.feedbackTone = 'info';
    this.modifierName = this.platform === 'mac' ? 'Command' : 'Control';
    this.modifierLabel = this.platform === 'mac' ? 'Cmd' : 'Ctrl';
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.state = 'quiz';
    this.questionIndex = 0;
    this.correctCount = 0;
    this.feedback = '正解のショートカットを実際に入力してください';
    this.feedbackTone = 'info';
    this.canvas.addEventListener('keydown', this.handleKeyDown, true);
    this.canvas.focus({ preventScroll: true });
  }

  handleKeyDown(event) {
    if (!this.active || event.key === 'Control' || event.key === 'Meta' || event.key === 'Shift' || event.key === 'Alt') {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (this.state === 'clear' || this.state === 'gameover') {
      if (event.key === 'Enter' || event.key.toLowerCase() === 'r') this.onRetry();
      return;
    }

    if (event.repeat) return;

    const quiz = QUIZZES[this.questionIndex];
    const modifierPressed = this.platform === 'mac' ? event.metaKey : event.ctrlKey;
    const isCorrect = event.key.toLowerCase() === quiz.key
      && modifierPressed
      && !event.altKey
      && !event.shiftKey;

    if (!isCorrect) {
      this.player.hp = Math.max(0, this.player.hp - 1);
      this.feedbackTone = 'error';
      if (this.player.hp === 0) {
        this.state = 'gameover';
        this.feedback = 'HPがなくなった...もう一度挑戦しよう';
      } else {
        this.feedback = `不正解！HP -1  残り ${this.player.hp}`;
      }
      return;
    }

    this.correctCount += 1;
    this.questionIndex += 1;
    this.feedbackTone = 'success';
    if (this.correctCount === QUIZZES.length) {
      this.state = 'clear';
      this.feedback = '3問正解！ボスを撃破した！';
    } else {
      this.feedback = '正解！次の問題へ';
    }
  }

  render(ctx, width, height, time = 0) {
    if (!this.active) return;

    const cleared = this.state === 'clear';
    const failed = this.state === 'gameover';
    const accent = cleared ? '#70e1c1' : failed ? '#ff6b74' : '#f3c969';
    const centerX = width / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(3, 8, 12, 0.86)';
    ctx.fillRect(0, 0, width, height);

    const overlayGlow = ctx.createRadialGradient(centerX, height / 2, 20, centerX, height / 2, width * 0.45);
    overlayGlow.addColorStop(0, cleared ? 'rgba(112, 225, 193, 0.15)' : failed ? 'rgba(255, 107, 116, 0.13)' : 'rgba(243, 201, 105, 0.1)');
    overlayGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = overlayGlow;
    ctx.fillRect(0, 0, width, height);

    const panelWidth = Math.min(700, width - 56);
    const panelHeight = 412;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    const panelFill = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
    panelFill.addColorStop(0, 'rgba(25, 46, 57, 0.98)');
    panelFill.addColorStop(0.6, 'rgba(14, 29, 38, 0.98)');
    panelFill.addColorStop(1, 'rgba(8, 18, 24, 0.98)');

    drawPanel(ctx, {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 24,
      fill: panelFill,
      stroke: accent,
      lineWidth: 1.5,
      shadowBlur: 42,
      shadowColor: 'rgba(0, 0, 0, 0.7)',
      shadowOffsetY: 18,
      highlight: true,
    });

    drawPanel(ctx, {
      x: panelX + 10,
      y: panelY + 10,
      width: panelWidth - 20,
      height: panelHeight - 20,
      radius: 18,
      fill: 'rgba(0, 0, 0, 0)',
      stroke: 'rgba(157, 212, 208, 0.1)',
      lineWidth: 1,
    });

    this.drawBossEmblem(ctx, centerX, panelY + 52, accent, time);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = '800 10px "Cascadia Code", Consolas, monospace';
    ctx.fillText('BOSS BATTLE', centerX, panelY + 96);
    ctx.fillStyle = '#8fa7a6';
    ctx.font = '10px "Yu Gothic UI", sans-serif';
    ctx.fillText(cleared ? 'DUNGEON CONQUERED' : failed ? 'CHALLENGE FAILED' : 'SHORTCUT TRIAL', centerX, panelY + 112);

    this.drawProgress(ctx, centerX, panelY + 136, accent);

    if (cleared || failed) {
      this.drawResult(ctx, centerX, panelY, panelWidth, accent, cleared);
    } else {
      this.drawQuiz(ctx, centerX, panelY, panelWidth, accent);
    }

    ctx.restore();
  }

  drawBossEmblem(ctx, x, y, accent, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.rotate(time * 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-time * 0.55);

    ctx.globalAlpha = 1;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(7, 16, 22, 0.92)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(16, -9);
    ctx.lineTo(16, 9);
    ctx.lineTo(0, 18);
    ctx.lineTo(-16, 9);
    ctx.lineTo(-16, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = accent;
    ctx.font = '900 18px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }

  drawProgress(ctx, centerX, y, accent) {
    const gap = 8;
    const width = 44;
    const total = QUIZZES.length;
    const startX = centerX - (width * total + gap * (total - 1)) / 2;
    for (let index = 0; index < total; index += 1) {
      const complete = index < this.correctCount;
      const current = !complete && index === this.questionIndex && this.state === 'quiz';
      drawPanel(ctx, {
        x: startX + index * (width + gap),
        y,
        width,
        height: 6,
        radius: 3,
        fill: complete ? accent : current ? 'rgba(243, 201, 105, 0.55)' : 'rgba(143, 167, 166, 0.16)',
        stroke: complete || current ? accent : 'rgba(143, 167, 166, 0.18)',
        lineWidth: 1,
        shadowBlur: current ? 8 : 0,
        shadowColor: accent,
        shadowOffsetY: 0,
      });
    }
  }

  drawQuiz(ctx, centerX, panelY, panelWidth, accent) {
    const quiz = QUIZZES[this.questionIndex];
    const feedbackColor = this.feedbackTone === 'error'
      ? '#ff8b91'
      : this.feedbackTone === 'success'
        ? '#70e1c1'
        : '#f3c969';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3c969';
    ctx.font = '800 9px "Cascadia Code", Consolas, monospace';
    ctx.fillText(`QUESTION 0${this.questionIndex + 1} / 0${QUIZZES.length}`, centerX, panelY + 162);

    ctx.fillStyle = '#eff7f5';
    ctx.font = '600 21px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, quiz.question, panelWidth - 96), centerX, panelY + 196);

    const answerBoxWidth = 260;
    const answerBoxY = panelY + 226;
    drawPanel(ctx, {
      x: centerX - answerBoxWidth / 2,
      y: answerBoxY,
      width: answerBoxWidth,
      height: 54,
      radius: 12,
      fill: 'rgba(8, 18, 25, 0.82)',
      stroke: 'rgba(243, 201, 105, 0.3)',
      lineWidth: 1,
    });
    drawKeycap(ctx, centerX - 100, answerBoxY + 13, 72, 28, this.modifierLabel, {
      color: accent,
      fill: 'rgba(20, 38, 48, 0.98)',
      stroke: 'rgba(157, 212, 208, 0.3)',
      fontSize: 12,
    });
    ctx.fillStyle = '#8fa7a6';
    ctx.font = '800 16px "Cascadia Code", Consolas, monospace';
    ctx.fillText('+', centerX - 12, answerBoxY + 27);
    drawKeycap(ctx, centerX + 8, answerBoxY + 13, 56, 28, '?', {
      color: '#eff7f5',
      fill: 'rgba(20, 38, 48, 0.98)',
      stroke: 'rgba(243, 201, 105, 0.45)',
      fontSize: 15,
    });

    ctx.fillStyle = feedbackColor;
    ctx.font = '600 14px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.feedback, panelWidth - 80), centerX, panelY + 310);

    this.drawHearts(ctx, centerX, panelY + 345);

    ctx.fillStyle = '#8fa7a6';
    ctx.font = '11px "Yu Gothic UI", sans-serif';
    ctx.fillText(`${this.modifierName} キーを押しながら答えのキーを入力`, centerX, panelY + 382);
  }

  drawHearts(ctx, centerX, y) {
    const size = 15;
    const gap = 23;
    const startX = centerX - gap;
    for (let index = 0; index < this.player.maxHp; index += 1) {
      drawHeart(ctx, startX + index * gap, y, size, '#ff5e68', index < this.player.hp);
    }
    ctx.fillStyle = '#8fa7a6';
    ctx.font = '700 10px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.player.hp} / ${this.player.maxHp}`, centerX + 44, y);
    ctx.textAlign = 'center';
  }

  drawResult(ctx, centerX, panelY, panelWidth, accent, cleared) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = accent;
    ctx.shadowBlur = cleared ? 26 : 18;
    ctx.fillStyle = cleared ? '#70e1c1' : '#ff7a80';
    ctx.font = '900 36px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText(cleared ? 'GAME CLEAR' : 'GAME OVER', centerX, panelY + 176);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#eff7f5';
    ctx.font = '600 17px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.feedback, panelWidth - 96), centerX, panelY + 222);

    const chipWidth = 154;
    const chipGap = 14;
    const chipY = panelY + 260;
    const startX = centerX - (chipWidth * 2 + chipGap) / 2;
    this.drawResultChip(ctx, startX, chipY, chipWidth, '正解数', `${this.correctCount} / ${QUIZZES.length}`);
    this.drawResultChip(ctx, startX + chipWidth + chipGap, chipY, chipWidth, '残りHP', `${this.player.hp} / ${this.player.maxHp}`);

    ctx.fillStyle = '#8fa7a6';
    ctx.font = '11px "Yu Gothic UI", sans-serif';
    ctx.fillText('もう一度挑戦して、ショートカットを極めよう', centerX, panelY + 338);

    drawKeycap(ctx, centerX - 92, panelY + 360, 62, 24, 'Enter', { color: '#eff7f5' });
    ctx.fillStyle = '#8fa7a6';
    ctx.font = '11px "Yu Gothic UI", sans-serif';
    ctx.fillText('または', centerX - 10, panelY + 372);
    drawKeycap(ctx, centerX + 22, panelY + 360, 28, 24, 'R', { color: '#eff7f5' });
    ctx.fillStyle = '#eff7f5';
    ctx.font = '600 11px "Yu Gothic UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('でリトライ', centerX + 58, panelY + 372);
    ctx.textAlign = 'center';
  }

  drawResultChip(ctx, x, y, width, label, value) {
    drawPanel(ctx, {
      x,
      y,
      width,
      height: 58,
      radius: 12,
      fill: 'rgba(8, 18, 25, 0.72)',
      stroke: 'rgba(157, 212, 208, 0.18)',
      lineWidth: 1,
    });
    ctx.fillStyle = '#8fa7a6';
    ctx.font = '700 8px "Cascadia Code", Consolas, monospace';
    ctx.fillText(label, x + width / 2, y + 18);
    ctx.fillStyle = '#eff7f5';
    ctx.font = '800 18px "Cascadia Code", Consolas, monospace';
    ctx.fillText(value, x + width / 2, y + 39);
  }

  stop() {
    if (!this.active) return;
    this.canvas.removeEventListener('keydown', this.handleKeyDown, true);
    this.active = false;
    this.state = 'inactive';
  }

  dispose() {
    this.stop();
  }
}
