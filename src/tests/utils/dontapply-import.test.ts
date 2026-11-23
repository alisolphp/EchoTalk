import { describe, it, expect, vi } from 'vitest';
import {
    sanitizeText, parseImportPayload, computeCollectionKey, extractTokenFromHash, isImportHash,
    fetchCollection, readTextLimited, ImportError, IMPORT_LIMITS, IMPORT_ENDPOINT,
} from '../../utils/dontapply-import';

const TOKEN = 'A'.repeat(43);
const valid = () => ({
    schemaVersion: 1, type: 'qa-collection', title: 'Backend interview', lang: 'en-US',
    items: [{ question: 'Tell me about yourself.', answer: 'I build APIs.' }, { question: 'Why us?', answer: 'Great product.' }],
});
const jsonRes = (body: unknown, init: ResponseInit = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: 200, headers: { 'content-type': 'application/json' }, ...init,
    });
const code = async (p: Promise<unknown>) => { try { await p; } catch (e) { return (e as ImportError).code; } return 'none'; };

describe('sanitizeText', () => {
    it('removes angle brackets so no tag can form', () => {
        expect(sanitizeText('<img src=x onerror=alert(1)>Hi')).toBe('img src=x onerror=alert(1)Hi');
        expect(sanitizeText('<script>alert(1)</script>')).not.toMatch(/[<>]/);
    });
    it('turns straight double quotes into typographic ones (no attribute breakout)', () => {
        const out = sanitizeText('He said "hello" and "bye"');
        expect(out).not.toContain('"');
        expect(out).toBe('He said “hello” and “bye”');
    });
    it('drops control, zero-width and bidi override characters but keeps newlines', () => {
        expect(sanitizeText('a\u0000b​c‮d\u0007e\nf')).toBe('abcde\nf');
    });
    it('drops more invisible characters (soft hyphen, ALM, line/paragraph separators, word joiner)', () => {
        expect(sanitizeText('a­b؜c d e⁠f')).toBe('abcdef');
    });
    it('normalizes whitespace and CRLF, and non-strings become empty', () => {
        expect(sanitizeText('  a   b \r\n\r\n\r\n\r\n c ')).toBe('a b\n\nc');
        expect(sanitizeText(42)).toBe('');
        expect(sanitizeText(null)).toBe('');
    });
});

describe('parseImportPayload', () => {
    it('accepts a valid payload and defaults the language', () => {
        const p = parseImportPayload({ ...valid(), lang: undefined });
        expect(p.items).toHaveLength(2);
        expect(p.lang).toBe('en-US');
        expect(p.title).toBe('Backend interview');
    });
    it('sanitizes text fields', () => {
        const p = parseImportPayload({ ...valid(), title: '<b>T</b>', items: [{ question: 'Q<x>', answer: 'A "x"' }] });
        expect(p.title).toBe('bT/b');
        expect(p.items[0]).toEqual({ question: 'Qx', answer: 'A “x”' });
    });
    it('ignores unknown fields instead of copying them', () => {
        const p = parseImportPayload({ ...valid(), email: 'a@b.c', items: [{ question: 'Q', answer: 'A', userId: 7 }] }) as any;
        expect(p.email).toBeUndefined();
        expect(p.items[0].userId).toBeUndefined();
    });
    it.each([
        ['null', null], ['array', []], ['string', 'x'],
        ['wrong version', { ...valid(), schemaVersion: 2 }],
        ['wrong type', { ...valid(), type: 'other' }],
        ['missing title', { ...valid(), title: undefined }],
        ['empty title after sanitizing', { ...valid(), title: '<>' }],
        ['title too long', { ...valid(), title: 'x'.repeat(IMPORT_LIMITS.maxTitleChars + 1) }],
        ['no items', { ...valid(), items: [] }],
        ['items not array', { ...valid(), items: {} }],
        ['too many items', { ...valid(), items: Array(IMPORT_LIMITS.maxItems + 1).fill({ question: 'Q', answer: 'A' }) }],
        ['item not object', { ...valid(), items: ['x'] }],
        ['question not string', { ...valid(), items: [{ question: 1, answer: 'A' }] }],
        ['empty answer', { ...valid(), items: [{ question: 'Q', answer: ' ' }] }],
        ['question too long', { ...valid(), items: [{ question: 'q'.repeat(IMPORT_LIMITS.maxQuestionChars + 1), answer: 'A' }] }],
        ['answer too long', { ...valid(), items: [{ question: 'Q', answer: 'a'.repeat(IMPORT_LIMITS.maxAnswerChars + 1) }] }],
    ])('rejects %s', (_n, payload) => {
        expect(() => parseImportPayload(payload)).toThrowError(ImportError);
    });
    it('falls back to en-US for a malformed language tag', () => {
        expect(parseImportPayload({ ...valid(), lang: 'xx<script>' }).lang).toBe('en-US');
        expect(parseImportPayload({ ...valid(), lang: 'de-DE' }).lang).toBe('de-DE');
    });
});

describe('computeCollectionKey', () => {
    it('is stable for equal content and changes when content changes', async () => {
        const a = parseImportPayload(valid());
        const b = parseImportPayload(valid());
        const c = parseImportPayload({ ...valid(), items: [{ question: 'Q', answer: 'A' }] });
        expect(await computeCollectionKey(a)).toBe(await computeCollectionKey(b));
        expect(await computeCollectionKey(a)).not.toBe(await computeCollectionKey(c));
        expect(await computeCollectionKey(a)).toMatch(/^[0-9a-f]{64}$/);
    });
    it('ignores the language tag', async () => {
        const a = parseImportPayload(valid());
        const b = parseImportPayload({ ...valid(), lang: 'de-DE' });
        expect(await computeCollectionKey(a)).toBe(await computeCollectionKey(b));
    });
});

describe('token in the URL hash', () => {
    it('extracts only well-formed tokens', () => {
        expect(extractTokenFromHash(`#import=${TOKEN}`)).toBe(TOKEN);
        expect(extractTokenFromHash('#import=short')).toBeNull();
        expect(extractTokenFromHash(`#import=${TOKEN}&x=1`)).toBeNull();
        expect(extractTokenFromHash('#practice')).toBeNull();
        expect(extractTokenFromHash(`#import=${'a/b'.repeat(20)}`)).toBeNull();
    });
    it('isImportHash recognizes import hashes even when invalid', () => {
        expect(isImportHash('#import=zzz')).toBe(true);
        expect(isImportHash('#practice')).toBe(false);
    });
});

describe('fetchCollection', () => {
    it('POSTs the token in the body only, with no cookies and no referrer', async () => {
        const f = vi.fn().mockResolvedValue(jsonRes(valid()));
        const c = await fetchCollection(TOKEN, f as any);
        expect(c.items).toHaveLength(2);
        expect(c.key).toMatch(/^[0-9a-f]{64}$/);
        const [url, init] = f.mock.calls[0];
        expect(url).toBe(IMPORT_ENDPOINT);
        expect(String(url)).not.toContain(TOKEN);
        expect(init.method).toBe('POST');
        expect(init.body).toBe(TOKEN);
        expect(init.credentials).toBe('omit');
        expect(init.referrerPolicy).toBe('no-referrer');
        expect(init.redirect).toBe('error');
        expect(init.headers['Content-Type']).toMatch(/^text\/plain/);
    });
    it('rejects a malformed token without calling the network', async () => {
        const f = vi.fn();
        expect(await code(fetchCollection('bad', f as any))).toBe('bad_token');
        expect(f).not.toHaveBeenCalled();
    });
    it('refuses a non-HTTPS endpoint', async () => {
        const f = vi.fn();
        expect(await code(fetchCollection(TOKEN, f as any, 'http://dontapply.club/x'))).toBe('http_error');
        expect(f).not.toHaveBeenCalled();
    });
    it.each([[404, 'expired'], [410, 'expired'], [429, 'rate_limited'], [500, 'http_error'], [403, 'http_error']])(
        'maps HTTP %i to %s', async (status, expected) => {
            const f = vi.fn().mockResolvedValue(new Response('x', { status }));
            expect(await code(fetchCollection(TOKEN, f as any))).toBe(expected);
        });
    it('maps network failure and timeout', async () => {
        expect(await code(fetchCollection(TOKEN, vi.fn().mockRejectedValue(new TypeError('x')) as any))).toBe('network');
        vi.useFakeTimers();
        const hang = vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => {
            init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')));
        }));
        const p = code(fetchCollection(TOKEN, hang as any));
        await vi.advanceTimersByTimeAsync(IMPORT_LIMITS.timeoutMs + 1);
        expect(await p).toBe('timeout');
        vi.useRealTimers();
    });
    it('times out when the body stalls after the headers arrived', async () => {
        vi.useFakeTimers();
        const f = vi.fn((_u: string, init: RequestInit) => {
            // Like a real fetch, reading the body fails once the request signal aborts.
            const body = new ReadableStream({
                start(ctrl) {
                    init.signal!.addEventListener('abort', () => ctrl.error(new DOMException('aborted', 'AbortError')));
                },
            });
            return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
        });
        const p = code(fetchCollection(TOKEN, f as any));
        await vi.advanceTimersByTimeAsync(IMPORT_LIMITS.timeoutMs + 1);
        expect(await p).toBe('timeout');
        vi.useRealTimers();
    });
    it('rejects a wrong content type', async () => {
        const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'text/html' } }));
        expect(await code(fetchCollection(TOKEN, f as any))).toBe('wrong_content_type');
    });
    it('rejects invalid JSON and a bad schema', async () => {
        expect(await code(fetchCollection(TOKEN, vi.fn().mockResolvedValue(jsonRes('{nope')) as any))).toBe('bad_json');
        expect(await code(fetchCollection(TOKEN, vi.fn().mockResolvedValue(jsonRes({ a: 1 })) as any))).toBe('bad_schema');
    });
    it('rejects an oversized body by Content-Length and by streamed size', async () => {
        const big = 'x'.repeat(IMPORT_LIMITS.maxBytes + 10);
        const declared = new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(IMPORT_LIMITS.maxBytes + 1) } });
        expect(await code(fetchCollection(TOKEN, vi.fn().mockResolvedValue(declared) as any))).toBe('too_large');
        expect(await code(fetchCollection(TOKEN, vi.fn().mockResolvedValue(jsonRes(big)) as any))).toBe('too_large');
    });
});

describe('readTextLimited', () => {
    it('returns text within the limit', async () => {
        expect(await readTextLimited(new Response('héllo'), 100)).toBe('héllo');
    });
});
