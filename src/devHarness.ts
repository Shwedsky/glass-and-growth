import { DISCOVERY_NODES } from './game/content';
import { grantGrowth, loadState, resetState, saveState } from './game/model';

export function installDevHarness(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== '1') return;

  console.info('[Glass & Growth DEV] F8 reset | F9 +1B Growth | F10 complete current tree');

  window.addEventListener('keydown', (event) => {
    if (event.key === 'F8') {
      event.preventDefault();
      resetState();
      window.location.reload();
      return;
    }

    if (event.key === 'F9') {
      event.preventDefault();
      const state = loadState();
      grantGrowth(state, 1_000_000_000);
      saveState(state);
      window.location.reload();
      return;
    }

    if (event.key === 'F10') {
      event.preventDefault();
      const state = loadState();
      state.unlocked = DISCOVERY_NODES.map((node) => node.id);
      state.completed = true;
      saveState(state);
      window.location.reload();
    }
  });
}
