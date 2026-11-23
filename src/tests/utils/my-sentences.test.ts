import { describe, it, expect, beforeEach } from 'vitest';
import {
    cleanSentence, loadSentences, addSentence, updateSentence, removeSentence,
    MY_SENTENCES_KEY, MY_SENTENCES_LIMITS,
} from '../../utils/my-sentences';

function memStorage(seed: Record<string, string> = {}) {
    const data = { ...seed };
    return {
        data,
        getItem: (k: string) => (k in data ? data[k] : null),
        setItem: (k: string, v: string) => { data[k] = v; },
    };
}

describe('cleanSentence', () => {
    it('trims, collapses spaces, normalizes line breaks and drops control characters', () => {
        expect(cleanSentence('  Hello   world \r\n\r\n\r\n\r\n again\u0007  ')).toBe('Hello world\n\nagain');
    });
});

describe('quotes', () => {
    it('straight double quotes become typographic so they cannot break out of HTML attributes', () => {
        const out = cleanSentence('He said "hi" to me');
        expect(out).not.toContain('"');
        expect(out).toBe('He said \u201Chi\u201D to me');
    });
});

describe('my sentences storage', () => {
    let st: ReturnType<typeof memStorage>;
    beforeEach(() => { st = memStorage(); });

    it('starts empty and survives corrupted data', () => {
        expect(loadSentences(st)).toEqual([]);
        st.data[MY_SENTENCES_KEY] = '{not json';
        expect(loadSentences(st)).toEqual([]);
        st.data[MY_SENTENCES_KEY] = JSON.stringify({ a: 1 });
        expect(loadSentences(st)).toEqual([]);
        st.data[MY_SENTENCES_KEY] = JSON.stringify([{ id: 1 }, { id: 'a', text: 'ok', lang: 'en-US', createdAt: 1 }]);
        expect(loadSentences(st)).toHaveLength(1);
    });

    it('adds a sentence, newest first, and persists it', () => {
        const a = addSentence('  First one ', 'en-US', st);
        const b = addSentence('Second one', 'de-DE', st);
        expect(a.ok && b.ok).toBe(true);
        const list = loadSentences(st);
        expect(list.map(s => s.text)).toEqual(['Second one', 'First one']);
        expect(list[0].lang).toBe('de-DE');
        expect(new Set(list.map(s => s.id)).size).toBe(2);
    });

    it('rejects empty, too long and duplicate (case-insensitive) sentences', () => {
        expect(addSentence('   ', 'en-US', st)).toEqual({ ok: false, error: 'empty' });
        expect(addSentence('x'.repeat(MY_SENTENCES_LIMITS.maxChars + 1), 'en-US', st)).toEqual({ ok: false, error: 'too_long' });
        addSentence('Hello there', 'en-US', st);
        expect(addSentence('hello   THERE', 'en-US', st)).toEqual({ ok: false, error: 'duplicate' });
        expect(loadSentences(st)).toHaveLength(1);
    });

    it('enforces the item limit', () => {
        const seed = Array.from({ length: MY_SENTENCES_LIMITS.maxItems }, (_, i) => ({ id: `i${i}`, text: `s${i}`, lang: 'en-US', createdAt: i }));
        st.data[MY_SENTENCES_KEY] = JSON.stringify(seed);
        expect(addSentence('one more', 'en-US', st)).toEqual({ ok: false, error: 'limit' });
    });

    it('reports a storage failure instead of throwing', () => {
        const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
        expect(addSentence('Hello', 'en-US', broken)).toEqual({ ok: false, error: 'storage' });
    });

    it('updates text in place, keeps id and language, and allows saving unchanged text', () => {
        const a = addSentence('Original text', 'fr-FR', st);
        if (!a.ok) throw new Error('setup');
        const r = updateSentence(a.item.id, 'Edited text', st);
        expect(r.ok).toBe(true);
        const [only] = loadSentences(st);
        expect(only).toMatchObject({ id: a.item.id, text: 'Edited text', lang: 'fr-FR' });
        expect(updateSentence(a.item.id, 'Edited text', st).ok).toBe(true);
    });

    it('update rejects a duplicate of another item, empty text, and unknown ids', () => {
        const a = addSentence('Alpha', 'en-US', st);
        addSentence('Beta', 'en-US', st);
        if (!a.ok) throw new Error('setup');
        expect(updateSentence(a.item.id, 'beta', st)).toEqual({ ok: false, error: 'duplicate' });
        expect(updateSentence(a.item.id, ' ', st)).toEqual({ ok: false, error: 'empty' });
        expect(updateSentence('nope', 'x', st)).toEqual({ ok: false, error: 'not_found' });
    });

    it('removes by id', () => {
        const a = addSentence('Alpha', 'en-US', st);
        addSentence('Beta', 'en-US', st);
        if (!a.ok) throw new Error('setup');
        expect(removeSentence(a.item.id, st)).toBe(true);
        expect(loadSentences(st).map(s => s.text)).toEqual(['Beta']);
        expect(removeSentence('nope', st)).toBe(false);
    });
});
