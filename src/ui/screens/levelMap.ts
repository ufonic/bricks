import { isBoss, isBreather } from '../../core/levelgen';
import type { App, Screen } from '../app';
import { h, icon, ICONS, starsEl } from '../dom';
import { toast } from '../overlays/overlay';

const PAGE = 100;

export function levelMapScreen(app: App): Screen {
  const s = app.save;
  const next = s.highestLevelUnlocked;
  const playable = (n: number) => n <= next || s.settings.unlockAll;
  let shown = Math.max(PAGE, Math.ceil((next + 40) / PAGE) * PAGE);

  const grid = h('div', { class: 'level-grid' });
  const more = h('button', { class: 'btn ghost', onClick: () => { addLevels(shown + 1, shown + PAGE); shown += PAGE; } }, `Show more levels`);

  function levelTile(n: number): HTMLElement {
    const rec = s.levels[n];
    const cls = ['level-tile'];
    if (n === next) cls.push('next');
    if (!playable(n)) cls.push('locked');
    if (rec?.stars) cls.push('done');
    if (isBoss(n)) cls.push('boss');
    else if (isBreather(n)) cls.push('breather');
    return h(
      'button',
      {
        class: cls.join(' '),
        'data-level': n,
        onClick: () => open(n),
      },
      h('span', { class: 'num' }, String(n)),
      playable(n) ? starsEl(rec?.stars ?? 0, 'stars tiny') : icon(ICONS.lock, 'icon lock'),
    );
  }

  function addLevels(from: number, to: number) {
    const frag = document.createDocumentFragment();
    for (let n = from; n <= to; n++) frag.append(levelTile(n));
    grid.append(frag);
  }

  function open(n: number) {
    if (!playable(n)) {
      toast(el, `Beat level ${next} first`);
      return;
    }
    app.go({ name: 'game', mode: 'level', level: n });
  }

  const jump = h('input', { type: 'number', inputmode: 'numeric', min: '1', placeholder: 'Level #', class: 'jump-input' });
  const doJump = () => {
    const n = Math.floor(Number(jump.value));
    if (!Number.isFinite(n) || n < 1) return;
    if (n > shown) {
      addLevels(shown + 1, Math.ceil(n / PAGE) * PAGE);
      shown = Math.ceil(n / PAGE) * PAGE;
    }
    const tile = grid.querySelector(`[data-level="${n}"]`);
    tile?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    jump.blur();
  };
  jump.addEventListener('keydown', (e) => e.key === 'Enter' && doJump());

  addLevels(1, shown);
  const list = h('div', { class: 'scroll' }, grid, more);
  const el = h(
    'div',
    { class: 'levels' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'btn icon-btn', 'aria-label': 'Back', onClick: () => app.back() }, icon(ICONS.back)),
      h('div', { class: 'title' }, 'Levels'),
      h('div', { class: 'jump' }, jump, h('button', { class: 'btn small', onClick: doJump }, 'Go')),
    ),
    list,
  );
  requestAnimationFrame(() => grid.querySelector(`[data-level="${next}"]`)?.scrollIntoView({ block: 'center' }));
  return { el };
}
