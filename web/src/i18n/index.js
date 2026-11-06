// Localization system.
// Each language is a flat key -> string dictionary. Modules (games, bots) can register
// their own keys with registerStrings(), so new languages / games never require touching
// gameplay code: add a dictionary file and list it in LANGS.
import { save } from '../core/store.js';
import { bus } from '../core/events.js';
import en from './en.js';
import ru from './ru.js';
import { es, fr, de, it, tr, zh, ja } from './others.js';

export const LANGS = [
  { id: 'ru', name: 'Русский' }, { id: 'en', name: 'English' }, { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' }, { id: 'de', name: 'Deutsch' }, { id: 'it', name: 'Italiano' },
  { id: 'tr', name: 'Türkçe' }, { id: 'zh', name: '中文' }, { id: 'ja', name: '日本語' },
];

const dicts = { en: { ...en }, ru: { ...ru }, es: { ...es }, fr: { ...fr }, de: { ...de }, it: { ...it }, tr: { ...tr }, zh: { ...zh }, ja: { ...ja } };

/** registerStrings({en:{...}, ru:{...}}) — used by game modules for their own texts. */
export function registerStrings(byLang) {
  for (const [lang, d] of Object.entries(byLang)) {
    dicts[lang] = Object.assign(dicts[lang] || {}, d);
  }
}

export const lang = () => save.settings.lang || 'en';

export function t(key, params) {
  const l = lang();
  let s = dicts[l]?.[key];
  if (s == null) s = dicts.en[key];
  if (s == null) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`));
  return s;
}

/** Returns a localized value from an object like {en:'..', ru:'..'} */
export function tl(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang()] ?? obj.en ?? Object.values(obj)[0];
}

export function setLang(l) {
  save.settings.lang = l;
  document.documentElement.lang = l;
  bus.emit('lang', l);
}
