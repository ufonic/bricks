import { sfxTap } from '../platform/audio';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; onClick?: (e: MouseEvent) => void };

/** Tiny element builder: h('div', { class: 'x', onClick }, 'text', child). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'onClick') {
      el.addEventListener('click', (e: Event) => {
        sfxTap();
        (v as (e: MouseEvent) => void)(e as MouseEvent);
      });
    } else if (k === 'html') el.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function icon(svg: string, cls = 'icon'): HTMLSpanElement {
  return h('span', { class: cls, html: svg, 'aria-hidden': 'true' });
}

const s = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  back: s('<path d="M15 5l-7 7 7 7"/>'),
  gear: s('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="7"/>'),
  undo: s('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  lock: s('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 01-10 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-9z"/></svg>',
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  infinity: s('<path d="M7 9a3 3 0 100 6c2.5 0 7.5-6 10-6a3 3 0 110 6c-2.5 0-7.5-6-10-6z"/>'),
  grid: s('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  calendar: s('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  chart: s('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
};

/** Three stars; `n` of them filled. */
export function starsEl(n: number, cls = 'stars'): HTMLElement {
  return h('span', { class: cls }, ...[0, 1, 2].map((i) => icon(ICONS.star, `star${i < n ? ' on' : ''}`)));
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
