export const UI_COLORS = {
  panel: 'rgba(9, 18, 25, 0.82)',
  panelStrong: 'rgba(14, 28, 37, 0.94)',
  panelStroke: 'rgba(157, 212, 208, 0.2)',
  panelHighlight: 'rgba(255, 255, 255, 0.07)',
  text: '#eff7f5',
  muted: '#8fa7a6',
  accent: '#70e1c1',
  gold: '#f3c969',
  danger: '#ff6b74',
  blue: '#4aa8ff',
  shadow: 'rgba(0, 0, 0, 0.45)',
};

export function roundedRectPath(ctx, x, y, width, height, radius = 12) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawPanel(ctx, {
  x,
  y,
  width,
  height,
  radius = 14,
  fill = UI_COLORS.panel,
  stroke = UI_COLORS.panelStroke,
  lineWidth = 1,
  shadowBlur = 0,
  shadowColor = UI_COLORS.shadow,
  shadowOffsetY = 6,
  highlight = false,
} = {}) {
  ctx.save();
  if (shadowBlur > 0) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = shadowOffsetY;
  }
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  if (highlight) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y + 1);
    ctx.lineTo(x + width - radius, y + 1);
    ctx.strokeStyle = UI_COLORS.panelHighlight;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawKeycap(ctx, x, y, width, height, label, {
  color = UI_COLORS.text,
  fill = 'rgba(18, 35, 45, 0.92)',
  stroke = 'rgba(157, 212, 208, 0.24)',
  fontSize = 10,
} = {}) {
  drawPanel(ctx, { x, y, width, height, radius: 5, fill, stroke, lineWidth: 1 });
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${fontSize}px "Cascadia Code", Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2 + 0.5);
  ctx.restore();
}

export function drawHeart(ctx, cx, cy, size, color, filled = true) {
  const top = cy - size * 0.36;
  const bottom = cy + size * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, bottom);
  ctx.bezierCurveTo(cx - size * 0.85, cy - size * 0.08, cx - size * 0.55, cy - size * 0.78, cx, top);
  ctx.bezierCurveTo(cx + size * 0.55, cy - size * 0.78, cx + size * 0.85, cy - size * 0.08, cx, bottom);
  ctx.closePath();
  if (filled) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.55;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = 'rgba(143, 167, 166, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEnergyGem(ctx, cx, cy, size, color, filled = true) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.7, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.7, cy);
  ctx.closePath();
  if (filled) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.7;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.75);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.1);
    ctx.lineTo(cx, cy + size * 0.15);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(143, 167, 166, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPotion(ctx, cx, cy, size, color, label) {
  const width = size * 0.82;
  const height = size * 1.05;
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.fillRect(-size * 0.18, -height * 0.62, size * 0.36, height * 0.3);
  ctx.fillStyle = '#d8c7a4';
  ctx.fillRect(-size * 0.22, -height * 0.72, size * 0.44, height * 0.16);

  ctx.beginPath();
  ctx.moveTo(-width * 0.28, -height * 0.38);
  ctx.lineTo(-width * 0.5, height * 0.1);
  ctx.quadraticCurveTo(-width * 0.5, height * 0.55, 0, height * 0.55);
  ctx.quadraticCurveTo(width * 0.5, height * 0.55, width * 0.5, height * 0.1);
  ctx.lineTo(width * 0.28, -height * 0.38);
  ctx.closePath();
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.75;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-width * 0.26, -height * 0.18);
  ctx.quadraticCurveTo(-width * 0.4, height * 0.12, -width * 0.22, height * 0.34);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(size * 0.58)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, height * 0.14);
  ctx.restore();
}

export function drawDiamondBadge(ctx, cx, cy, size, label, color = UI_COLORS.gold) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(9, 18, 25, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = color;
  ctx.font = `800 ${Math.round(size * 0.45)}px "Cascadia Code", Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0.5);
  ctx.restore();
}

export function drawDivider(ctx, x, y, height) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + height);
  gradient.addColorStop(0, 'rgba(157, 212, 208, 0)');
  gradient.addColorStop(0.5, 'rgba(157, 212, 208, 0.28)');
  gradient.addColorStop(1, 'rgba(157, 212, 208, 0)');
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.stroke();
  ctx.restore();
}

export function shadeColor(hex, amount) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = Number.parseInt(match[1], 16);
  const clamp = (channel) => Math.max(0, Math.min(255, Math.round(channel)));
  const red = clamp(((value >> 16) & 0xff) + amount);
  const green = clamp(((value >> 8) & 0xff) + amount);
  const blue = clamp((value & 0xff) + amount);
  return `rgb(${red}, ${green}, ${blue})`;
}

export function truncateText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

export function drawVignette(ctx, width, height) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.2,
    width / 2,
    height / 2,
    height * 0.82,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
