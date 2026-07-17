import { Game } from './Game';

// Simple init — create game immediately, let buttons handle start
function init() {
  const container = document.getElementById('game-container');
  if (!container || (container as any)._game) return;
  
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  (container as any)._game = new Game(canvas);
}

// Try immediately, then fallback to DOMContentLoaded/load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
window.addEventListener('load', init);
