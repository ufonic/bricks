import { currentStreak, dateKey } from '../../core/save';
import { BRICK_COLORS } from '../../config/theme';
import type { ColorId } from '../../core/types';
import type { App, Screen } from '../app';
import { fmt, h, icon, ICONS } from '../dom';

function logo(): HTMLElement {
  const colors: ColorId[] = ['red', 'yellow', 'blue', 'green', 'orange', 'purple'];
  return h(
    'div',
    { class: 'logo' },
    h('div', { class: 'logo-bricks' }, ...colors.map((c) => h('span', { class: 'mini-brick', style: `--c:${BRICK_COLORS[c].base};--l:${BRICK_COLORS[c].light};--d:${BRICK_COLORS[c].dark}` }))),
    h('h1', {}, 'Bricks'),
  );
}

export function homeScreen(app: App): Screen {
  const s = app.save;
  const resumeLevel = s.inProgress.level?.levelNumber;
  const nextLevel = resumeLevel ?? s.highestLevelUnlocked;
  const today = dateKey(new Date());
  const dailyDone = s.daily.results[today] !== undefined;
  const streak = currentStreak(s, today);

  const tile = (label: string, sub: string, svg: string, onClick: () => void) =>
    h('button', { class: 'btn tile', onClick }, icon(svg), h('span', { class: 'tile-label' }, label), h('span', { class: 'tile-sub' }, sub));

  const el = h(
    'div',
    { class: 'home' },
    app.update.ready
      ? h('button', { class: 'update-banner', onClick: () => app.update.apply() }, 'Update ready. Tap to restart.')
      : null,
    logo(),
    h(
      'button',
      { class: 'btn primary continue', onClick: () => app.go({ name: 'game', mode: 'level', level: nextLevel }) },
      icon(ICONS.play),
      h('span', { class: 'continue-text' }, h('b', {}, resumeLevel ? 'Resume' : 'Continue'), h('span', {}, `Level ${nextLevel}`)),
    ),
    h(
      'div',
      { class: 'tiles' },
      tile('Levels', `${Object.values(s.levels).filter((l) => l.stars > 0).length} beaten`, ICONS.grid, () => app.go({ name: 'levels' })),
      tile('Endless', s.inProgress.endless ? 'Resume' : `Best ${fmt(s.endlessHighScore)}`, ICONS.infinity, () => app.go({ name: 'game', mode: 'endless' })),
      tile('Daily', dailyDone ? `Done · ${streak} day streak` : streak > 0 ? `${streak} day streak` : 'New puzzle', ICONS.calendar, () =>
        app.go({ name: 'game', mode: 'daily' }),
      ),
      tile('Stats', `${fmt(s.stats.linesCleared)} lines`, ICONS.chart, () => app.go({ name: 'stats' })),
    ),
    h('button', { class: 'btn ghost settings-link', onClick: () => app.go({ name: 'settings' }) }, icon(ICONS.gear), 'Settings'),
    h('div', { class: 'version' }, `v${__APP_VERSION__} · ${__BUILD_ID__}`),
  );
  return { el };
}
