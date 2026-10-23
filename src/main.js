import GameLoop from './core/GameLoop.js';
import MainGameScene from './scenes/MainGameScene.js';
import { setupHome } from './ui/home-ui.js';

let gameLoop;
let scene;

function startGame() {
  const canvas = document.querySelector('#game-canvas');
  const homeScreen = document.querySelector('#home-screen');
  const gameScreen = document.querySelector('#game-screen');
  if (!canvas || !homeScreen || !gameScreen) throw new Error('ゲーム画面の初期化に必要な要素が見つかりません。');

  homeScreen.hidden = true;
  gameScreen.hidden = false;
  scene = new MainGameScene(canvas);
  gameLoop = new GameLoop({
    update: (deltaTime) => scene.update(deltaTime),
    render: () => scene.render(),
  });

  canvas.focus({ preventScroll: true });
  scene.render();
  gameLoop.start();
}

setupHome({ onStart: startGame });

// タブが非表示の間は更新を止め、復帰時の大きな移動を防ぎます。
document.addEventListener('visibilitychange', () => {
  if (!gameLoop) return;
  if (document.hidden) gameLoop.stop();
  else gameLoop.start();
});

window.addEventListener('pagehide', () => {
  gameLoop?.stop();
  scene?.dispose();
}, { once: true });
