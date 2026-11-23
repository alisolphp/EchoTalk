/**
 * The user's own sentences, kept in localStorage (offline-first, same as the other app settings).
 * Pure functions over a Storage-like object so they can be unit-tested.
 */

export const MY_SENTENCES_KEY = 'shadow_my_sentences';

export const MY_SENTENCES_LIMITS = {
    maxItems: 500,
    maxChars: 1000,
} as const;

export interface MySentence {
    id: string;
    text: string;
    lang: string;
    createdAt: number;
}

export type SaveError = 'empty' | 'too_long' | 'duplicate' | 'limit' | 'storage' | 'not_found';

export type SaveResult =
    | { ok: true; item: MySentence }
    | { ok: false; error: SaveError };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const SAVE_ERROR_MESSAGES: Record<SaveError, string> = {
    empty: 'Type a sentence first.',
    too_long: `Sentences can be up to ${MY_SENTENCES_LIMITS.maxChars} characters.`,
    duplicate: 'This sentence is already in your list.',
    limit: `You can keep up to ${MY_SENTENCES_LIMITS.maxItems} sentences. Delete one to add another.`,
    storage: 'Could not save on this device (storage is full or blocked).',
    not_found: 'That sentence no longer exists.',
};

/**
 * Trims, normalizes line breaks and spaces, and removes control characters.
 * Angle brackets are removed and straight double quotes become typographic quotes, because sentences
 * are later used in HTML text and in double-quoted attributes (recordings and practices lists).
 * This is defense in depth, not escaping: escaping at those sinks is done in the DontApply import change.
 */
export function cleanSentence(input: string): string {
    return input
        .normalize('NFC')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
        .replace(/[<>]/g, '')
        .replace(/"/g, (_m, offset: number, whole: string) =>
            offset === 0 || /[\s(\[{]/.test(whole[offset - 1]) ? '\u201C' : '\u201D')
        .replace(/[ \t]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function isValidItem(x: unknown): x is MySentence {
    const o = x as MySentence;
    return typeof o === 'object' && o !== null
        && typeof o.id === 'string' && typeof o.text === 'string' && o.text.trim() !== ''
        && typeof o.lang === 'string' && typeof o.createdAt === 'number';
}

/**
 * Reads the list; corrupted or foreign data yields an empty list instead of an error.
 * Invalid entries are dropped here, so the next save rewrites the list without them.
 */
export function loadSentences(storage: StorageLike = localStorage): MySentence[] {
    try {
        const raw = storage.getItem(MY_SENTENCES_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data.filter(isValidItem) : [];
    } catch {
        return [];
    }
}

function persist(list: MySentence[], storage: StorageLike): boolean {
    try {
        storage.setItem(MY_SENTENCES_KEY, JSON.stringify(list));
        return true;
    } catch {
        return false;
    }
}

function newId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function validate(text: string, list: MySentence[], ignoreId?: string): SaveError | null {
    if (text === '') return 'empty';
    if (text.length > MY_SENTENCES_LIMITS.maxChars) return 'too_long';
    const lower = text.toLowerCase();
    if (list.some(s => s.id !== ignoreId && s.text.toLowerCase() === lower)) return 'duplicate';
    return null;
}

export function addSentence(input: string, lang: string, storage: StorageLike = localStorage): SaveResult {
    const list = loadSentences(storage);
    const text = cleanSentence(input);
    const error = validate(text, list);
    if (error) return { ok: false, error };
    if (list.length >= MY_SENTENCES_LIMITS.maxItems) return { ok: false, error: 'limit' };
    const item: MySentence = { id: newId(), text, lang, createdAt: Date.now() };
    if (!persist([item, ...list], storage)) return { ok: false, error: 'storage' };
    return { ok: true, item };
}

export function updateSentence(id: string, input: string, storage: StorageLike = localStorage): SaveResult {
    const list = loadSentences(storage);
    const index = list.findIndex(s => s.id === id);
    if (index < 0) return { ok: false, error: 'not_found' };
    const text = cleanSentence(input);
    const error = validate(text, list, id);
    if (error) return { ok: false, error };
    const item = { ...list[index], text };
    const next = list.slice();
    next[index] = item;
    if (!persist(next, storage)) return { ok: false, error: 'storage' };
    return { ok: true, item };
}

export function removeSentence(id: string, storage: StorageLike = localStorage): boolean {
    const list = loadSentences(storage);
    const next = list.filter(s => s.id !== id);
    if (next.length === list.length) return false;
    return persist(next, storage);
}
