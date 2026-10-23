/**
 * ホーム画面の選択状態だけを扱います。
 * Google 認証は Supabase 導入時に src/auth/ へ実装します。
 */
export function setupHome({ onStart }) {
  const guestButton = document.querySelector('#guest-play-button');
  const startButton = document.querySelector('#start-game-button');
  const status = document.querySelector('#selection-status');
  if (!guestButton || !startButton || !status) throw new Error('ホーム画面の要素が見つかりません。');

  guestButton.addEventListener('click', () => {
    guestButton.classList.add('is-selected');
    guestButton.setAttribute('aria-pressed', 'true');
    startButton.disabled = false;
    status.textContent = 'ゲストでプレイします。ゲームを開始できます。';
  });

  startButton.addEventListener('click', () => {
    if (!startButton.disabled) onStart();
  });
}
