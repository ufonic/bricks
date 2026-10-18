import { defaultSave } from '../../core/save';
import { exportSave, importSave } from '../../platform/storage';
import type { App, Screen } from '../app';
import { h, icon, ICONS } from '../dom';
import { confirmOverlay, showOverlay, toast, type Overlay } from '../overlays/overlay';
import { toggle } from '../overlays/pause';

function select<T extends string | number>(label: string, options: [T, string][], get: () => T, set: (v: T) => void): HTMLElement {
  const sel = h('select', {}, ...options.map(([v, text]) => h('option', { value: String(v), selected: get() === v }, text)));
  sel.addEventListener('change', () => {
    const found = options.find(([v]) => String(v) === sel.value);
    if (found) set(found[0]);
  });
  return h('label', { class: 'select-row' }, h('span', {}, label), sel);
}

async function copyText(text: string, fallbackEl: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    fallbackEl.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

export function settingsScreen(app: App): Screen {
  const st = () => app.save.settings;
  const save = () => app.persist();

  const exportFlow = () => {
    const text = exportSave(app.save);
    const ta = h('textarea', { class: 'save-text', readOnly: true, rows: 6 }, text);
    let ov: Overlay;
    ov = showOverlay(
      el,
      h(
        'div',
        { class: 'stack' },
        h('h2', {}, 'Export save'),
        h('p', { class: 'muted' }, 'Copy this text and keep it somewhere safe (Notes, a message to yourself). Import it on another phone to move your progress.'),
        ta,
        h('div', { class: 'row' },
          h('button', { class: 'btn', onClick: () => ov.close() }, 'Close'),
          h('button', { class: 'btn primary', onClick: async () => toast(el, (await copyText(text, ta)) ? 'Copied' : 'Select the text and copy it') }, 'Copy'),
        ),
      ),
    );
  };

  const importFlow = () => {
    const ta = h('textarea', { class: 'save-text', rows: 6, placeholder: 'Paste your exported save here' });
    let ov: Overlay;
    ov = showOverlay(
      el,
      h(
        'div',
        { class: 'stack' },
        h('h2', {}, 'Import save'),
        h('p', { class: 'muted' }, 'This replaces the progress on this phone.'),
        ta,
        h('div', { class: 'row' },
          h('button', { class: 'btn', onClick: () => ov.close() }, 'Cancel'),
          h('button', {
            class: 'btn primary',
            onClick: () => {
              const imported = importSave(ta.value);
              if (!imported) {
                toast(el, 'That doesn’t look like a save');
                return;
              }
              app.replaceSave(imported);
              ov.close();
              app.go({ name: 'settings' }, { replace: true });
              toast(document.body, 'Progress imported');
            },
          }, 'Import'),
        ),
      ),
    );
  };

  const el = h(
    'div',
    { class: 'settings' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'btn icon-btn', 'aria-label': 'Back', onClick: () => app.back() }, icon(ICONS.back)),
      h('div', { class: 'title' }, 'Settings'),
      h('div', { class: 'spacer' }),
    ),
    h(
      'div',
      { class: 'scroll' },
      h(
        'section',
        { class: 'settings-list' },
        toggle('Sound', () => st().sound, (v) => { st().sound = v; save(); }),
        toggle('Haptics', () => st().haptics, (v) => { st().haptics = v; save(); }),
        select<number>('Piece lift', [[0.5, 'Low'], [1, 'Medium-low'], [1.5, 'Medium'], [2, 'High'], [2.5, 'Very high']], () => st().liftOffset, (v) => { st().liftOffset = v; save(); }),
        toggle('Friendly deals', () => st().friendlyDeals, (v) => { st().friendlyDeals = v; save(); }),
        select<number>('Undos per game', [[0, 'None'], [1, '1'], [3, '3'], [-1, 'Unlimited']], () => st().undoCount, (v) => { st().undoCount = v; save(); }),
        toggle('Unlock all levels', () => st().unlockAll, (v) => { st().unlockAll = v; save(); }),
      ),
      h('p', { class: 'hint' }, 'Haptics work on phones that support vibration. iPhone Safari does not, so this setting has no effect there.'),
      h(
        'section',
        { class: 'stack' },
        h('h3', {}, 'Your progress'),
        h('p', { class: 'hint' }, 'iOS can clear data for home-screen apps that go unused for weeks. Export now and then as a backup.'),
        h('button', { class: 'btn', onClick: exportFlow }, 'Export save'),
        h('button', { class: 'btn', onClick: importFlow }, 'Import save'),
        h('button', {
          class: 'btn danger',
          onClick: () =>
            confirmOverlay(el, 'Reset progress?', 'This erases every level, star, score and streak on this phone. It can’t be undone.', 'Reset', () => {
              const fresh = defaultSave();
              fresh.settings = app.save.settings;
              app.replaceSave(fresh);
              toast(el, 'Progress reset');
            }),
        }, 'Reset progress'),
      ),
      h('div', { class: 'version' }, `v${__APP_VERSION__} · ${__BUILD_ID__}`),
    ),
  );
  return { el };
}
