// EAIOS Contacts — DOM wiring for the 600x600 viewer.
// No innerHTML interpolation of data; textContent and DOM APIs only.
// No timers, no network, no external fonts.

import { createViewerState } from './state.mjs';

// Owner-requested first-name-only pilot labels. No full names, employer,
// photos, account URLs, canonical identities or biometric templates are public.
// Local SVGs are illustrative placeholders, not participant photographs.
const PILOT_CONTACTS = [
  { personId: 'pilot-01', displayName: 'Halle', role: 'Photo not loaded', organization: '',
    note: 'Photo pending. Recognition is not connected.', icon: 'icons/alex.svg' },
  { personId: 'pilot-02', displayName: 'Oya', role: 'Photo not loaded', organization: '',
    note: 'Photo pending. Recognition is not connected.', icon: 'icons/sam.svg' },
  { personId: 'pilot-03', displayName: 'Katie', role: 'Photo not loaded', organization: '',
    note: 'Photo pending. Recognition is not connected.', icon: 'icons/jordan.svg' },
];
const state = createViewerState();
const $ = id => document.getElementById(id);
const screens = {
  directory: $('screen-directory'), detail: $('screen-detail'),
  empty: $('screen-empty'), cleared: $('screen-cleared'),
};
const listEl = $('contact-list');
const detailIcon = $('detail-icon');
const detailFields = ['detail-name', 'detail-role', 'detail-org', 'detail-note'].map($);
const btnPrev = $('btn-prev'), btnSelect = $('btn-select'), btnNext = $('btn-next');
const btnBack = $('btn-back'), btnClear = $('btn-clear'), btnOpen = $('btn-open');
const buttons = [btnPrev, btnSelect, btnNext, btnBack, btnClear, btnOpen];
let listItems = [], directoryIndex = 0, directoryGeneration = 0;

function markDirectoryFocus(index) {
  directoryIndex = index;
  listItems.forEach((item, i) => {
    item.tabIndex = i === index ? 0 : -1;
    item.setAttribute('aria-selected', String(i === index));
    item.classList.toggle('focused', i === index);
  });
}

function buildList(contacts) {
  listEl.replaceChildren();
  listItems = [];
  const generation = ++directoryGeneration;
  directoryIndex = Math.max(0, Math.min(directoryIndex, contacts.length - 1));
  for (const [index, contact] of contacts.entries()) {
    const item = document.createElement('li');
    item.className = 'contact-item';
    item.setAttribute('role', 'option');
    item.dataset.index = String(index);
    item.tabIndex = index === directoryIndex ? 0 : -1;
    item.setAttribute('aria-selected', String(index === directoryIndex));
    const content = document.createElement('div');
    content.className = 'content';
    const image = document.createElement('img');
    image.src = contact.icon;
    image.alt = 'Illustrative icon, not a photograph';
    image.width = 48;
    image.height = 48;
    const text = document.createElement('div');
    text.className = 'text';
    const name = document.createElement('p'), meta = document.createElement('p');
    name.className = 'name'; name.textContent = contact.displayName;
    meta.className = 'meta'; meta.textContent = [contact.role, contact.organization].filter(Boolean).join(' · ');
    text.append(name, meta); content.append(image, text); item.append(content);
    item.addEventListener('focus', () => markDirectoryFocus(index));
    item.addEventListener('click', () => {
      // A detached old row cannot reselect a card after Clear or a new render.
      if (generation !== directoryGeneration || state.snapshot().screen !== 'directory') return;
      directoryIndex = index;
      state.select(index);
      render();
    });
    listEl.append(item); listItems.push(item);
  }
  markDirectoryFocus(directoryIndex);
}

function clearDetailContent() {
  for (const field of detailFields) field.textContent = '';
  detailIcon.removeAttribute('src');
  detailIcon.alt = '';
}

function render({ focus = true } = {}) {
  const previousControl = document.activeElement;
  const snap = state.snapshot();
  const onDirectory = snap.screen === 'directory';
  const onDetail = snap.screen === 'detail' && snap.card !== null;
  for (const [name, screen] of Object.entries(screens)) screen.hidden = name !== snap.screen;

  if (onDirectory) buildList(snap.contacts);
  else {
    ++directoryGeneration;
    listEl.replaceChildren(); listItems = [];
  }
  if (onDetail) {
    directoryIndex = snap.selectedIndex;
    detailIcon.src = snap.card.icon;
    detailIcon.alt = 'Illustrative icon, not a photograph';
    const values = [snap.card.displayName, snap.card.role, snap.card.organization, snap.card.note];
    detailFields.forEach((field, index) => { field.textContent = values[index]; });
  } else clearDetailContent();

  btnPrev.disabled = !onDetail;
  btnNext.disabled = !onDetail;
  btnSelect.disabled = !onDirectory || snap.contacts.length === 0;
  btnBack.disabled = !onDetail;
  btnClear.disabled = !(onDetail || onDirectory);
  btnOpen.disabled = !(snap.screen === 'cleared' || snap.screen === 'empty');

  // Focus must be applied after controls have been enabled and screens revealed.
  if (!focus || document.hidden) return;
  let target;
  if (onDirectory) target = listItems[directoryIndex] ?? btnOpen;
  else if (onDetail) target = buttons.includes(previousControl) && !previousControl.disabled ? previousControl : btnNext;
  else target = btnOpen;
  target?.focus({ preventScroll: true });
}

function perform(action) { action(); render(); }
btnPrev.addEventListener('click', () => perform(() => state.prev()));
btnNext.addEventListener('click', () => perform(() => state.next()));
btnSelect.addEventListener('click', () => perform(() => state.select(directoryIndex)));
btnBack.addEventListener('click', () => perform(() => state.back()));
btnClear.addEventListener('click', () => perform(() => state.clear()));
btnOpen.addEventListener('click', () => perform(() => state.openDirectory()));

function focusTargets() {
  const snap = state.snapshot();
  const visibleButtons = buttons.filter(button => !button.disabled && button.getClientRects().length > 0);
  return snap.screen === 'directory' ? [...listItems, ...visibleButtons] : visibleButtons;
}

document.addEventListener('keydown', event => {
  if (document.hidden || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (event.repeat) return;
    const screen = state.snapshot().screen;
    if (screen === 'detail') state.back();
    else if (screen === 'directory') state.clear();
    render(); return;
  }
  if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const targets = focusTargets();
    if (targets.length === 0) return;
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const current = targets.indexOf(document.activeElement);
    const next = current < 0 ? (forward ? 0 : targets.length - 1)
      : (current + (forward ? 1 : targets.length - 1)) % targets.length;
    targets[next].focus({ preventScroll: true }); return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (event.repeat) return;
    const target = document.activeElement;
    if (focusTargets().includes(target)) target.click();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { state.onHidden(); render({ focus: false }); }
  else render();
});
window.addEventListener('pagehide', () => { state.onHidden(); render({ focus: false }); });
window.addEventListener('pageshow', () => render());
state.loadDirectory(PILOT_CONTACTS);
render();
