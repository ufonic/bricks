import { currentStreak, dateKey } from '../../core/save';
import type { App, Screen } from '../app';
import { fmt, h, icon, ICONS } from '../dom';

export function statsScreen(app: App): Screen {
  const s = app.save;
  const levels = Object.values(s.levels);
  const rows: [string, string][] = [
    ['Levels beaten', fmt(levels.filter((l) => l.stars > 0).length)],
    ['Total stars', fmt(levels.reduce((a, l) => a + l.stars, 0))],
    ['Endless high score', fmt(s.endlessHighScore)],
    ['Lines cleared', fmt(s.stats.linesCleared)],
    ['Pieces placed', fmt(s.stats.piecesPlaced)],
    ['Games played', fmt(s.stats.gamesPlayed)],
    ['Daily streak', fmt(currentStreak(s, dateKey(new Date())))],
    ['Dailies completed', fmt(Object.keys(s.daily.results).length)],
  ];
  const el = h(
    'div',
    { class: 'stats' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'btn icon-btn', 'aria-label': 'Back', onClick: () => app.back() }, icon(ICONS.back)),
      h('div', { class: 'title' }, 'Stats'),
      h('div', { class: 'spacer' }),
    ),
    h('div', { class: 'scroll' }, h('dl', { class: 'stat-list' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
  );
  return { el };
}
