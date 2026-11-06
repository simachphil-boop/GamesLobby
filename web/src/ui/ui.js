// UI manager: screens with history (Android back button), modals, toasts, buttons with feedback.
import { h } from '../core/util.js';
import { sfx, haptic, initAudio } from '../core/audio.js';
import { t } from '../i18n/index.js';

const root = () => document.getElementById('ui');
let current = null;
const stack = [];
let modals = [];
let toastBox = null;

/** Button with click sound + haptic. */
export function btn(label, onClick, cls = '', attrs = {}) {
  const b = h('button', { class: 'btn ' + cls, ...attrs }, label);
  b.addEventListener('click', (e) => {
    initAudio();
    sfx(cls.includes('ghost') || cls.includes('back') ? 'back' : 'click');
    haptic();
    onClick && onClick(e);
  });
  return b;
}

/** show(screenFactory, ...args): factory returns {el, onHide?, back?} */
export function show(factory, ...args) {
  const scr = factory(...args);
  if (current) {
    stack.push({ factory, args: current._args, f: current._factory });
    hideCurrent();
  }
  mount(scr, factory, args);
  return scr;
}
/** replace current screen without history. */
export function replace(factory, ...args) {
  const scr = factory(...args);
  if (current) hideCurrent();
  mount(scr, factory, args);
  return scr;
}
/** Clear history and show. */
export function reset(factory, ...args) {
  stack.length = 0;
  return replace(factory, ...args);
}
function mount(scr, factory, args) {
  scr._factory = factory; scr._args = args;
  current = scr;
  root().appendChild(scr.el);
  scr.onShow && scr.onShow();
}
function hideCurrent() {
  const old = current;
  old.onHide && old.onHide();
  old.el.classList.add('out');
  setTimeout(() => old.el.remove(), 300);
  current = null;
}
export function back() {
  if (modals.length) { closeModal(); return true; }
  if (current && current.back) { if (current.back() !== false) return true; }
  const prev = stack.pop();
  if (!prev) return false;
  sfx('back');
  hideCurrent();
  mount(prev.f(...prev.args), prev.f, prev.args);
  return true;
}
export const currentScreen = () => current;
export function refresh() {
  if (!current) return;
  const f = current._factory, a = current._args;
  current.onHide && current.onHide();
  current.el.remove();
  current = null;
  const scr = f(...a);
  scr.el.style.animation = 'none';
  mount(scr, f, a);
}

export function screen(cls, ...children) { return h('div', { class: 'screen ' + (cls || '') }, ...children); }

export function header(title, onBack, ...extra) {
  return h('div', { class: 'header' },
    btn('←', () => (onBack ? onBack() : back()), 'icon ghost back'),
    h('div', { class: 'title' }, title), ...extra);
}

// ---------- modals ----------
export function modal(content, { buttons = [], onClose, cls = '', dismissible = true } = {}) {
  const box = h('div', { class: 'modal panel ' + cls }, h('div', { class: 'mbody' }, content),
    buttons.length ? h('div', { class: 'mfoot' }, buttons) : null);
  const bg = h('div', { class: 'modal-bg' }, box);
  const m = { bg, onClose, dismissible };
  bg.addEventListener('click', (e) => { if (e.target === bg && dismissible) closeModal(m); });
  root().appendChild(bg);
  modals.push(m);
  sfx('open');
  return m;
}
export function closeModal(m) {
  if (!m) m = modals[modals.length - 1];
  if (!m) return;
  if (!m.dismissible && arguments.length === 0) return;
  modals = modals.filter((x) => x !== m);
  m.bg.remove();
  m.onClose && m.onClose();
}
export const hasModal = () => modals.length > 0;

export function confirmBox(text, { yes = t('yes'), no = t('no'), danger = false } = {}) {
  return new Promise((resolve) => {
    let m;
    const done = (v) => { closeModal(m); resolve(v); };
    m = modal(h('div', { class: 'rules' }, text), {
      buttons: [btn(no, () => done(false), 'ghost'), btn(yes, () => done(true), danger ? 'danger' : 'primary')],
      onClose: () => resolve(false),
    });
  });
}

export function alertBox(content, okLabel = t('ok')) {
  return new Promise((resolve) => {
    let m;
    m = modal(typeof content === 'string' ? h('div', { class: 'rules' }, content) : content,
      { buttons: [btn(okLabel, () => { closeModal(m); }, 'primary')], onClose: () => resolve() });
  });
}

/** Choice modal: options [{label, value, cls}] -> Promise<value|null> */
export function choose(title, options, { dismissible = true } = {}) {
  return new Promise((resolve) => {
    let m;
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeModal(m); resolve(v); };
    const body = h('div', { class: 'col' }, title ? h('div', { class: 'title center' }, title) : null,
      ...options.map((o) => btn(o.label, () => finish(o.value), o.cls || '')));
    m = modal(body, { dismissible, onClose: () => { if (!done) { done = true; resolve(null); } } });
  });
}

export function toast(text, cls = '') {
  if (!toastBox) { toastBox = h('div', { class: 'toasts' }); document.body.appendChild(toastBox); }
  const el = h('div', { class: 'toast ' + cls }, text);
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

export function toggle(on, onChange) {
  const el = h('div', { class: 'toggle' + (on ? ' on' : '') });
  el.addEventListener('click', () => { sfx('click'); haptic(); el.classList.toggle('on'); onChange(el.classList.contains('on')); });
  return el;
}

export function options(list, value, onPick, { locked = () => false } = {}) {
  const wrap = h('div', { class: 'opts' });
  const render = () => {
    wrap.innerHTML = '';
    for (const o of list) {
      const lk = locked(o.value);
      const el = h('div', { class: 'opt' + (o.value === value ? ' sel' : '') + (lk ? ' locked' : '') }, (lk ? '🔒 ' : '') + o.label);
      el.addEventListener('click', () => {
        if (lk) { sfx('error'); toast(t('setup.locked')); return; }
        sfx('click'); haptic(); value = o.value; render(); onPick(o.value);
      });
      wrap.appendChild(el);
    }
  };
  render();
  return wrap;
}

/** Fade to black and back around an async action (room transitions). */
export async function fadeThrough(fn) {
  let f = document.querySelector('.fade-black');
  if (!f) { f = h('div', { class: 'fade-black' }); document.body.appendChild(f); }
  f.classList.add('on');
  await new Promise((r) => setTimeout(r, 450));
  await fn();
  await new Promise((r) => setTimeout(r, 120));
  f.classList.remove('on');
}
