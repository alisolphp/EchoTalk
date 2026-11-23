/**
 * Parsing, validation, sanitizing and fetching for the DontApply Q and A import.
 * See docs/dontapply-import.md for the format and the fetch contract.
 * Everything here is pure or takes its dependencies as arguments so it can be unit-tested.
 */

/** The only host EchoTalk will fetch imports from. The token never selects the host. */
export const IMPORT_ENDPOINT = 'https://dontapply.club/api/echotalk/import';

export const IMPORT_LIMITS = {
    maxBytes: 256 * 1024,
    maxItems: 200,
    maxTitleChars: 120,
    maxQuestionChars: 500,
    maxAnswerChars: 2000,
    timeoutMs: 15000,
} as const;

/** One-time token shape: URL-safe characters only, 32 to 128 long. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export interface QaItem {
    question: string;
    answer: string;
}

export interface QaCollection {
    /** Content key computed by EchoTalk (SHA-256 hex of the canonical content). */
    key: string;
    title: string;
    lang: string;
    items: QaItem[];
}

export type ImportErrorCode =
    | 'bad_token' | 'network' | 'timeout' | 'expired' | 'rate_limited' | 'http_error'
    | 'wrong_content_type' | 'too_large' | 'bad_json' | 'bad_schema';

export class ImportError extends Error {
    constructor(public code: ImportErrorCode, message?: string) {
        super(message ?? code);
        this.name = 'ImportError';
    }
}

/** Safe messages for the user; they never contain the token, the URL or the server's text. */
export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, string> = {
    bad_token: 'This import link is not valid. Use "Study in EchoTalk" in DontApply again.',
    network: 'Could not reach DontApply. Check your connection and try again with a new link.',
    timeout: 'DontApply took too long to answer. Try again with a new link.',
    expired: 'This link has expired or was already used. Use "Study in EchoTalk" in DontApply again.',
    rate_limited: 'Too many attempts. Wait a minute and use a new link.',
    http_error: 'DontApply could not provide the notes. Try again with a new link.',
    wrong_content_type: 'DontApply sent an unexpected answer. Try again with a new link.',
    too_large: 'These notes are too large to import.',
    bad_json: 'The notes could not be read. Try again with a new link.',
    bad_schema: 'The notes are not in a format EchoTalk understands.',
};

/** Extracts a well-formed token from a location hash such as "#import=<token>", else null. */
export function extractTokenFromHash(hash: string): string | null {
    const m = /^#import=([^&]*)$/.exec(hash);
    if (!m) return null;
    return TOKEN_PATTERN.test(m[1]) ? m[1] : null;
}

/** True when the hash looks like an import link, valid or not (used to clear it from the URL). */
export function isImportHash(hash: string): boolean {
    return hash.startsWith('#import=');
}

/**
 * Turns untrusted text into safe plain text:
 * NFC-normalizes, drops control and invisible-direction characters, removes angle brackets
 * (so no HTML tag can form), replaces straight double quotes with typographic ones
 * (so the text cannot break out of a double-quoted HTML attribute), collapses spaces.
 */
export function sanitizeText(input: unknown): string {
    if (typeof input !== 'string') return '';
    let s = input.normalize('NFC');
    s = s.replace(/\r\n?/g, '\n');
    // C0/C1 controls except newline, zero-width and bidi override/isolate characters.
    s = s.replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g, '');
    s = s.replace(/[<>]/g, '');
    s = s.replace(/"/g, (_m, offset: number, whole: string) =>
        offset === 0 || /[\s(\[{]/.test(whole[offset - 1]) ? '“' : '”');
    s = s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n');
    return s.trim();
}

/** Language is only a hint; accept a BCP-47-like tag, default to en-US. */
function normalizeLang(lang: unknown): string {
    return typeof lang === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(lang) ? lang : 'en-US';
}

export interface ParsedCollection {
    title: string;
    lang: string;
    items: QaItem[];
}

/**
 * Validates the v1 schema and returns sanitized content. Unknown fields are ignored
 * (never copied), so a server cannot smuggle extra data into storage.
 * @throws ImportError('bad_schema')
 */
export function parseImportPayload(data: unknown): ParsedCollection {
    const fail = (): never => { throw new ImportError('bad_schema'); };
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return fail();
    const d = data as Record<string, unknown>;
    if (d.schemaVersion !== 1 || d.type !== 'qa-collection') return fail();
    if (typeof d.title !== 'string' || !Array.isArray(d.items)) return fail();
    const items = d.items as unknown[];
    if (items.length < 1 || items.length > IMPORT_LIMITS.maxItems) return fail();

    const title = sanitizeText(d.title);
    if (title === '' || title.length > IMPORT_LIMITS.maxTitleChars) return fail();

    const out: QaItem[] = [];
    for (const raw of items) {
        if (typeof raw !== 'object' || raw === null) return fail();
        const r = raw as Record<string, unknown>;
        if (typeof r.question !== 'string' || typeof r.answer !== 'string') return fail();
        const question = sanitizeText(r.question);
        const answer = sanitizeText(r.answer);
        if (question === '' || answer === '') return fail();
        if (question.length > IMPORT_LIMITS.maxQuestionChars || answer.length > IMPORT_LIMITS.maxAnswerChars) return fail();
        out.push({ question, answer });
    }
    return { title, lang: normalizeLang(d.lang), items: out };
}

/** Canonical content key: SHA-256 hex of title + items (language excluded so a re-tag does not duplicate). */
export async function computeCollectionKey(c: ParsedCollection): Promise<string> {
    const canonical = JSON.stringify([c.title, c.items.map(i => [i.question, i.answer])]);
    const bytes = new TextEncoder().encode(canonical);
    if (globalThis.crypto?.subtle) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for non-secure contexts: weaker, but only used to detect duplicates locally.
    let h1 = 0, h2 = 0;
    for (let i = 0; i < canonical.length; i++) {
        const c1 = canonical.charCodeAt(i);
        h1 = (Math.imul(31, h1) + c1) | 0;
        h2 = (Math.imul(131, h2) ^ c1) | 0;
    }
    return `f-${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}-${canonical.length}`;
}

/** Reads a response body as text, aborting once it exceeds `maxBytes`. */
export async function readTextLimited(res: Response, maxBytes: number): Promise<string> {
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new ImportError('too_large');
    if (!res.body) {
        const text = await res.text();
        if (new TextEncoder().encode(text).length > maxBytes) throw new ImportError('too_large');
        return text;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new ImportError('too_large');
        }
        chunks.push(value);
    }
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.byteLength; }
    return new TextDecoder('utf-8').decode(all);
}

/**
 * Fetches and validates a collection with a one-time token.
 * The token is sent only in the POST body (never in a URL), with no cookies and no referrer.
 * @throws ImportError
 */
export async function fetchCollection(
    token: string,
    fetchImpl: typeof fetch = fetch,
    endpoint: string = IMPORT_ENDPOINT,
): Promise<QaCollection> {
    if (!TOKEN_PATTERN.test(token)) throw new ImportError('bad_token');
    if (!endpoint.startsWith('https://')) throw new ImportError('http_error');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMPORT_LIMITS.timeoutMs);
    let res: Response;
    try {
        res = await fetchImpl(endpoint, {
            method: 'POST',
            // text/plain keeps this a CORS "simple request": no preflight, one request, one token use.
            headers: { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json' },
            body: token,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
        });
    } catch {
        throw new ImportError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
        clearTimeout(timer);
    }

    if (res.status === 404 || res.status === 410) throw new ImportError('expired');
    if (res.status === 429) throw new ImportError('rate_limited');
    if (!res.ok) throw new ImportError('http_error');
    if (!(res.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
        throw new ImportError('wrong_content_type');
    }

    const text = await readTextLimited(res, IMPORT_LIMITS.maxBytes);
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new ImportError('bad_json');
    }
    const parsed = parseImportPayload(data);
    return { ...parsed, key: await computeCollectionKey(parsed) };
}
