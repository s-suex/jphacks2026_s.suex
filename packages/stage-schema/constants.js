export const SCHEMA_VERSION = 1;

export const TILE_SIZE = 40;
export const GRID_COLUMNS = 24;
export const GRID_ROWS = 16;
export const PLAYABLE_MIN_X = 1;
export const PLAYABLE_MIN_Y = 1;
export const PLAYABLE_MAX_X = GRID_COLUMNS - 2;
export const PLAYABLE_MAX_Y = GRID_ROWS - 2;

export const FACINGS = Object.freeze(['up', 'down', 'left', 'right']);
export const ITEM_TYPES = Object.freeze(['skillPotion', 'lifePotion']);
export const BLOCK_KINDS = Object.freeze(['normal', 'colored']);

export const STAGE_FIELDS = Object.freeze([
  'schemaVersion',
  'id',
  'number',
  'name',
  'start',
  'obstacles',
  'items',
  'blocks',
  'colorSwitches',
  'colorWalls',
  'lasers',
  'magma',
  'goal',
  'goalBlock',
  'shortcutGate',
  'hint',
]);

export const START_FIELDS = Object.freeze(['x', 'y', 'facing']);
export const OBSTACLE_FIELDS = Object.freeze(['x', 'y', 'width', 'height']);
export const ITEM_FIELDS = Object.freeze(['type', 'x', 'y']);
export const BLOCK_FIELDS = Object.freeze(['id', 'name', 'kind', 'x', 'y', 'color']);
export const COLOR_SWITCH_FIELDS = Object.freeze(['x', 'y', 'color']);
export const COLOR_WALL_FIELDS = Object.freeze(['x', 'y', 'width', 'height', 'color']);
export const LASER_FIELDS = Object.freeze(['x', 'y', 'direction', 'length']);
export const TILE_FIELDS = Object.freeze(['x', 'y']);

export const MIN_LASER_LENGTH = 1;
export const MAX_LASER_LENGTH = 21;

export const STAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
export const BLOCK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const MAX_STAGE_FILE_BYTES = 64 * 1024;
export const MAX_HINT_LENGTH = 70;
export const MAX_STAGE_NAME_LENGTH = 40;
export const MAX_BLOCK_NAME_LENGTH = 8;
export const RECOMMENDED_BLOCK_NAME_LENGTH = 4;

export function isPlayableTile(x, y) {
  return Number.isInteger(x)
    && Number.isInteger(y)
    && x >= PLAYABLE_MIN_X
    && x <= PLAYABLE_MAX_X
    && y >= PLAYABLE_MIN_Y
    && y <= PLAYABLE_MAX_Y;
}

export function tileKey(x, y) {
  return `${x},${y}`;
}

export function isStageId(value) {
  return typeof value === 'string' && STAGE_ID_PATTERN.test(value);
}

export function isBlockId(value) {
  return typeof value === 'string' && BLOCK_ID_PATTERN.test(value);
}

export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
}

export function normalizeColor(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}
