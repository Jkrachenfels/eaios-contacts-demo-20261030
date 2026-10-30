// EAIOS Contacts — pure state/navigation logic.
// No DOM, no timers, no network. Deterministic and importable by Node tests.

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function truncate(value, max) {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function deepCopy(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepCopy);
  const out = {};
  for (const key of Object.keys(value)) {
    Object.defineProperty(out, key, {
      value: deepCopy(value[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/**
 * Validate a single contact record.
 * Returns a normalized card object, or null when the record is unusable.
 * Rules:
 *  - personId: non-empty string
 *  - displayName: non-empty string (max 80 chars)
 *  - role: string (max 100 chars)
 *  - organization: string (max 100 chars)
 *  - note: string (max 240 chars)
 *  - icon: non-empty string (local asset path)
 */
export function validateContact(contact) {
  if (contact === null || contact === undefined || typeof contact !== 'object') return null;
  if (!hasOwn(contact, 'personId') || typeof contact.personId !== 'string' || contact.personId.trim() === '') return null;
  if (!hasOwn(contact, 'displayName') || typeof contact.displayName !== 'string' || contact.displayName.trim() === '') return null;
  if (!hasOwn(contact, 'role') || typeof contact.role !== 'string') return null;
  if (!hasOwn(contact, 'organization') || typeof contact.organization !== 'string') return null;
  if (!hasOwn(contact, 'note') || typeof contact.note !== 'string') return null;
  if (!hasOwn(contact, 'icon') || typeof contact.icon !== 'string' || contact.icon.trim() === '') return null;

  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:svg|png|jpe?g|webp)$/i.test(contact.icon.trim())) return null;

  return {
    personId: contact.personId.trim(),
    displayName: truncate(contact.displayName, 80),
    role: truncate(contact.role, 100),
    organization: truncate(contact.organization, 100),
    note: truncate(contact.note, 240),
    icon: contact.icon.trim(),
  };
}

/**
 * Validate a contacts directory (array).
 * Returns an array of normalized cards. Invalid entries are dropped.
 */
export function validateDirectory(directory) {
  if (!Array.isArray(directory)) return [];
  const seen = new Set();
  const cards = [];
  for (const entry of directory) {
    const card = validateContact(entry);
    if (card === null) continue;
    if (seen.has(card.personId)) continue;
    seen.add(card.personId);
    cards.push(card);
  }
  return cards;
}

/**
 * Create the viewer state machine.
 *
 * Screens:
 *  - 'directory'  : contact picker list
 *  - 'detail'     : selected contact card
 *  - 'empty'      : no contacts available
 *
 * Transitions:
 *  - openDirectory()  -> 'directory' (or 'empty' if no contacts)
 *  - select(index)    -> 'detail'
 *  - next() / prev()  -> 'detail' (wrap around)
 *  - back()           -> 'directory' (or 'empty')
 *  - clear()          -> 'cleared' (card removed until explicit openDirectory)
 *  - onHidden()       -> 'cleared' (transient selection dropped)
 */
export function createViewerState() {
  let contacts = [];
  let screen = 'empty';
  let selectedIndex = -1;

  function refreshScreen() {
    if (contacts.length === 0) {
      screen = 'empty';
      selectedIndex = -1;
    } else if (screen === 'detail' || screen === 'cleared') {
      // stay where we are; caller decides
    }
  }

  return {
    /** Load a directory of contacts. Returns snapshot. */
    loadDirectory(directory) {
      contacts = validateDirectory(directory);
      if (contacts.length === 0) {
        screen = 'empty';
        selectedIndex = -1;
      } else {
        screen = 'directory';
        selectedIndex = -1;
      }
      return this.snapshot();
    },

    /** Open the directory picker. */
    openDirectory() {
      if (contacts.length === 0) {
        screen = 'empty';
        selectedIndex = -1;
      } else {
        screen = 'directory';
        selectedIndex = -1;
      }
      return this.snapshot();
    },

    /** Select a contact by index. Returns snapshot. */
    select(index) {
      if (screen === 'cleared' || screen === 'empty') return this.snapshot();
      if (contacts.length === 0) return this.snapshot();
      if (!Number.isInteger(index) || index < 0 || index >= contacts.length) return this.snapshot();
      screen = 'detail';
      selectedIndex = index;
      return this.snapshot();
    },

    /** Move to next contact (wraps). */
    next() {
      if (screen !== 'detail' || contacts.length === 0) return this.snapshot();
      selectedIndex = (selectedIndex + 1) % contacts.length;
      return this.snapshot();
    },

    /** Move to previous contact (wraps). */
    prev() {
      if (screen !== 'detail' || contacts.length === 0) return this.snapshot();
      selectedIndex = (selectedIndex - 1 + contacts.length) % contacts.length;
      return this.snapshot();
    },

    /** Go back to directory. */
    back() {
      if (screen === 'cleared') return this.snapshot();
      if (contacts.length === 0) {
        screen = 'empty';
        selectedIndex = -1;
      } else {
        screen = 'directory';
        selectedIndex = -1;
      }
      return this.snapshot();
    },

    /** Clear the current card. Stays cleared until openDirectory(). */
    clear() {
      screen = 'cleared';
      selectedIndex = -1;
      return this.snapshot();
    },

    /** Page hidden/backgrounded: drop transient selection. */
    onHidden() {
      screen = 'cleared';
      selectedIndex = -1;
      return this.snapshot();
    },

    /**
     * Return a detached, deep-copied snapshot of current state.
     * Shape:
     *  {
     *    screen: 'directory' | 'detail' | 'empty' | 'cleared',
     *    contacts: Array<card>,
     *    selectedIndex: number,
     *    card: card | null,
     *  }
     */
    snapshot() {
      return {
        screen,
        contacts: deepCopy(contacts),
        selectedIndex,
        card: screen === 'detail' && selectedIndex >= 0 && selectedIndex < contacts.length
          ? deepCopy(contacts[selectedIndex])
          : null,
      };
    },
  };
}
