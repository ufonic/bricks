import { h } from '../dom';
import { showOverlay, type Overlay } from './overlay';

export const TIPS: Record<string, { title: string; body: string }> = {
  basics: {
    title: 'How to play',
    body: 'Drag the pieces onto the board. Fill a whole row or column to clear it. Pieces can’t be rotated. When none of your pieces fit, the game ends.',
  },
  lines: { title: 'Clear lines', body: 'Clear the number of rows and columns shown at the top. Clearing several at once counts each one.' },
  clearBlocks: { title: 'Clear the blocks', body: 'The yellow bricks were here first. Clear the rows and columns they sit in until none are left.' },
  gems: { title: 'Collect gems', body: 'Some starting bricks hide a gem. Clear the gem’s row or column to collect it.' },
  moves: { title: 'Limited moves', body: 'You have a set number of placements. Meet the goal before they run out. Moves left over earn extra stars.' },
  stone: { title: 'Stone', body: 'Gray stone needs two clears. The first clear cracks it, the second breaks it.' },
  lock: { title: 'Locks', body: 'Locked cells take up space and never clear, but rows with a lock can still be completed around it.' },
  boss: { title: 'Boss level', body: 'Every 25th level has two goals. Meet both to win.' },
};

/** Shows each unseen tip in turn, then calls done. Marks them seen via `markSeen`. */
export function showTips(parent: HTMLElement, keys: string[], markSeen: (key: string) => void, done: () => void): Overlay | null {
  const queue = keys.filter((k) => TIPS[k]);
  if (queue.length === 0) {
    done();
    return null;
  }
  const key = queue[0];
  const tip = TIPS[key];
  const ov: Overlay = showOverlay(
    parent,
    h(
      'div',
      { class: 'stack tip' },
      h('div', { class: 'eyebrow' }, 'New'),
      h('h2', {}, tip.title),
      h('p', {}, tip.body),
      h('button', {
        class: 'btn primary',
        onClick: () => {
          markSeen(key);
          ov.close();
          setTimeout(() => showTips(parent, queue.slice(1), markSeen, done), 120);
        },
      }, 'Got it'),
    ),
  );
  return ov;
}
