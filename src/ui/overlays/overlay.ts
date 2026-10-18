import { h } from '../dom';

export interface Overlay {
  el: HTMLElement;
  close(): void;
  readonly open: boolean;
}

/** A modal card over the current screen. */
export function showOverlay(parent: HTMLElement, content: HTMLElement, opts: { onClose?: () => void; cls?: string } = {}): Overlay {
  const card = h('div', { class: `card ${opts.cls ?? ''}` }, content);
  const el = h('div', { class: 'overlay entering' }, card);
  parent.append(el);
  requestAnimationFrame(() => el.classList.remove('entering'));
  let open = true;
  return {
    el,
    get open() {
      return open;
    },
    close() {
      if (!open) return;
      open = false;
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 160);
      opts.onClose?.();
    },
  };
}

/** Yes/no confirmation without a blocking browser dialog. */
export function confirmOverlay(parent: HTMLElement, title: string, body: string, yes: string, onYes: () => void): Overlay {
  const ov: Overlay = showOverlay(
    parent,
    h(
      'div',
      { class: 'stack' },
      h('h2', {}, title),
      h('p', { class: 'muted' }, body),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => ov.close() }, 'Cancel'),
        h('button', { class: 'btn danger', onClick: () => { ov.close(); onYes(); } }, yes),
      ),
    ),
  );
  return ov;
}

export function toast(parent: HTMLElement, text: string, ms = 1800): void {
  const el = h('div', { class: 'toast' }, text);
  parent.append(el);
  setTimeout(() => el.classList.add('leaving'), ms);
  setTimeout(() => el.remove(), ms + 300);
}
