import type { App } from '../app';
import { h } from '../dom';
import { showOverlay, type Overlay } from './overlay';

export interface PauseActions {
  resume(): void;
  restart(): void;
  quit(): void;
}

function toggle(label: string, get: () => boolean, set: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', checked: get() });
  input.addEventListener('change', () => set(input.checked));
  return h('label', { class: 'toggle' }, h('span', {}, label), input, h('span', { class: 'switch' }));
}

export function showPause(parent: HTMLElement, app: App, a: PauseActions): Overlay {
  let ov: Overlay;
  const content = h(
    'div',
    { class: 'stack' },
    h('h2', {}, 'Paused'),
    h('button', { class: 'btn primary big', onClick: () => ov.close() }, 'Resume'),
    h('button', { class: 'btn', onClick: () => { ov.close(); a.restart(); } }, 'Restart'),
    h(
      'div',
      { class: 'settings-list' },
      toggle('Sound', () => app.save.settings.sound, (v) => { app.save.settings.sound = v; app.persist(); }),
      toggle('Haptics', () => app.save.settings.haptics, (v) => { app.save.settings.haptics = v; app.persist(); }),
    ),
    h('button', { class: 'btn ghost', onClick: () => { ov.close(); a.quit(); } }, 'Quit to Home'),
  );
  ov = showOverlay(parent, content, { onClose: a.resume });
  return ov;
}

export { toggle };
