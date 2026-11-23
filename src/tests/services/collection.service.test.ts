import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import $ from 'jquery';
import { EchoTalkApp } from '../../app';
import { addOrFind, CollectionStore, StoredCollection } from '../../services/collection.service';

const TOKEN = 'B'.repeat(43);
const payload = {
    schemaVersion: 1, type: 'qa-collection', title: 'Backend interview', lang: 'en-US',
    items: [
        { question: 'Q one?', answer: 'Answer one.' },
        { question: 'Q two?', answer: 'Answer two.' },
        { question: 'Q three?', answer: 'Answer three.' },
    ],
};
const okRes = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

/** The test setup replaces window.location with a plain object, so the hash is set directly. */
const setHash = (h: string) => { (window.location as any).hash = h; };

function memoryStore(): CollectionStore & { data: Map<string, StoredCollection> } {
    const data = new Map<string, StoredCollection>();
    return {
        data,
        get: async k => data.get(k),
        put: async c => { data.set(c.key, c); },
        getAll: async () => [...data.values()],
        remove: async k => { data.delete(k); },
    };
}

describe('addOrFind', () => {
    it('adds a new collection once and finds it by key afterwards', async () => {
        const store = memoryStore();
        const incoming = { key: 'k1', title: 'T', lang: 'en-US', items: [{ question: 'Q', answer: 'A' }] };
        const first = await addOrFind(store, incoming);
        expect(first.added).toBe(true);
        expect(first.collection.progress).toBe(0);
        const second = await addOrFind(store, incoming);
        expect(second.added).toBe(false);
        expect(store.data.size).toBe(1);
    });
});

describe('CollectionService flow', () => {
    let app: EchoTalkApp;
    let store: ReturnType<typeof memoryStore>;
    let startSpy: any;

    beforeEach(() => {
        app = new EchoTalkApp();
        store = memoryStore();
        app.collectionService.setStore(store);
        startSpy = vi.spyOn(app.practiceService, 'startPractice').mockResolvedValue();
        vi.spyOn(app.uiService, 'showPracticeSetup').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => okRes(payload)));
        setHash('');
        vi.spyOn(history, 'replaceState').mockImplementation(() => { setHash(''); });
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('removes the token from the URL before fetching, imports, and starts at question 1', async () => {
        setHash(`#import=${TOKEN}`);
        let hashAtFetch: string | null = null;
        (fetch as any).mockImplementation(async () => {
            hashAtFetch = window.location.hash;
            return okRes(payload);
        });
        await app.collectionService.handleLaunchHash();
        expect(hashAtFetch).toBe('');
        expect(JSON.stringify(window.location)).not.toContain(TOKEN);
        expect(store.data.size).toBe(1);
        expect(startSpy).toHaveBeenCalledTimes(1);
        expect($('#sentenceInput').attr('data-val')).toBe('Answer one.');
        expect($('#collectionQuestion').text()).toBe('Q one?');
        expect($('#collectionBanner').hasClass('d-none')).toBe(false);
        expect($('#collectionProgress').text()).toContain('question 1 of 3');
    });

    it('does not add a duplicate when the same content is imported again, and still starts at 1', async () => {
        await app.collectionService.importWithToken(TOKEN);
        await app.collectionService.importWithToken(TOKEN);
        expect(store.data.size).toBe(1);
        expect($('#importStatusText').text()).toContain('is already in your collections');
        expect($('#sentenceInput').attr('data-val')).toBe('Answer one.');
    });

    it('shows a safe message and starts nothing on an expired link', async () => {
        (fetch as any).mockImplementation(async () => new Response('gone', { status: 410 }));
        await app.collectionService.importWithToken(TOKEN);
        expect($('#importStatusText').text()).toContain('expired or was already used');
        expect($('#importStatusText').text()).not.toContain(TOKEN);
        expect(startSpy).not.toHaveBeenCalled();
        expect(store.data.size).toBe(0);
    });

    it('ignores a malformed token hash and shows an error without any fetch', async () => {
        setHash('#import=short');
        await app.collectionService.handleLaunchHash();
        expect(fetch).not.toHaveBeenCalled();
        expect($('#importStatusText').text()).toContain('not valid');
        expect(window.location.hash).toBe('');
    });

    it('does nothing for ordinary hashes', async () => {
        setHash('#practice');
        await app.collectionService.handleLaunchHash();
        expect(fetch).not.toHaveBeenCalled();
        expect(history.replaceState).not.toHaveBeenCalled();
        expect(window.location.hash).toBe('#practice');
    });

    it('runs first to last in order and then finishes the collection', async () => {
        await app.collectionService.importWithToken(TOKEN);
        const seen = [$('#sentenceInput').attr('data-val')];
        await app.collectionService.next();
        seen.push($('#sentenceInput').attr('data-val'));
        await app.collectionService.next();
        seen.push($('#sentenceInput').attr('data-val'));
        expect(seen).toEqual(['Answer one.', 'Answer two.', 'Answer three.']);
        expect($('#collectionQuestion').text()).toBe('Q three?');
        vi.spyOn(app, 'resetWithoutReload').mockResolvedValue();
        await app.collectionService.next();
        expect(app.collectionService.isActive()).toBe(false);
        expect($('#collectionBanner').hasClass('d-none')).toBe(true);
    });

    it('renders imported text as text, never as HTML', async () => {
        const evil = { ...payload, items: [{ question: '<img src=x onerror=window.pwned=1>Q?', answer: 'A "quoted" <b>x</b>' }] };
        (fetch as any).mockImplementation(async () => okRes(evil));
        await app.collectionService.importWithToken(TOKEN);
        expect($('#collectionQuestion').find('img').length).toBe(0);
        expect($('#collectionQuestion').text()).toBe('img src=x onerror=window.pwned=1Q?');
        expect($('#sentenceInput').attr('data-val')).not.toMatch(/[<>"]/);
    });

    it('decorateCompletion adds a Next button and saves the resume point', async () => {
        await app.collectionService.importWithToken(TOKEN);
        $('#session-complete-container').html(
            '<h2>Done</h2><button id="restartPracticeBtn" class="btn btn-primary"></button><button class="btn btn-secondary">New</button>');
        app.collectionService.decorateCompletion();
        expect($('#collectionNextBtn').text()).toBe('Next question');
        await new Promise(r => setTimeout(r, 5));
        expect([...store.data.values()][0].progress).toBe(1);
        $('#collectionNextBtn').trigger('click');
        await new Promise(r => setTimeout(r, 5));
        expect($('#sentenceInput').attr('data-val')).toBe('Answer two.');
    });

    it('Start from the list keeps collection mode on, even though the setup page resets asynchronously', async () => {
        vi.restoreAllMocks();
        startSpy = vi.spyOn(app.practiceService, 'startPractice').mockResolvedValue();
        const modal = $('#collectionsModal')[0];
        await addOrFind(store, { key: 'k9', title: 'Listed', lang: 'en-US', items: [{ question: 'Listed Q1?', answer: 'Listed A1.' }, { question: 'Q2?', answer: 'A2.' }] });
        await app.collectionService.showList();
        $('#collectionsList .btn-primary').first().trigger('click');
        await new Promise(r => setTimeout(r, 50));
        expect(modal).toBeTruthy();
        expect(app.collectionService.isActive()).toBe(true);
        expect($('#collectionBanner').hasClass('d-none')).toBe(false);
        expect($('#collectionQuestion').text()).toBe('Listed Q1?');
    });

    it('lists collections as text and deletes on confirm', async () => {
        await addOrFind(store, { key: 'k', title: '<b>Evil</b>', lang: 'en-US', items: [{ question: 'Q', answer: 'A' }] });
        await app.collectionService.showList();
        expect($('#collectionsList b').length).toBe(0);
        expect($('#collectionsList').text()).toContain('<b>Evil</b>');
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        $('#collectionsList .btn-outline-danger').trigger('click');
        await new Promise(r => setTimeout(r, 10));
        expect(store.data.size).toBe(0);
    });

    it('auto-skip: the countdown after a question goes to the next question and animates the Next button', async () => {
        vi.useFakeTimers();
        try {
            vi.spyOn(app.practiceService as any, 'recordPracticeCompletion').mockResolvedValue({ newStreak: 1, oldStreak: 1 });
            vi.spyOn(app, 'releaseWakeLock').mockResolvedValue();
            vi.spyOn(app.audioService, 'playSound').mockImplementation(() => {});
            vi.spyOn(app.audioService, 'speak').mockImplementation(() => {});
            const restartSpy = vi.spyOn(app.practiceService, 'restartCurrentPractice').mockResolvedValue();
            await app.collectionService.importWithToken(TOKEN);
            app.practiceMode = 'auto-skip';
            app.area = 'Practice';
            await app.practiceService.finishSession();
            expect($('#collectionNextBtn').hasClass('loading')).toBe(true);
            await vi.advanceTimersByTimeAsync(5000);
            expect(restartSpy).not.toHaveBeenCalled();
            expect($('#collectionQuestion').text()).toBe('Q two?');
        } finally {
            vi.useRealTimers();
        }
    });

    it('the status box can be closed and shown again by a later import', async () => {
        await app.collectionService.importWithToken(TOKEN);
        $('#importStatusClose').trigger('click');
        expect($('#importStatus').hasClass('d-none')).toBe(true);
        (fetch as any).mockImplementation(async () => new Response('gone', { status: 410 }));
        await app.collectionService.importWithToken(TOKEN);
        expect($('#importStatus').length).toBe(1);
        expect($('#importStatus').hasClass('d-none')).toBe(false);
        expect($('#importStatusText').text()).toContain('expired');
    });

    it('switches the app language to a supported collection language', async () => {
        (fetch as any).mockImplementation(async () => okRes({ ...payload, lang: 'de-DE' }));
        await app.collectionService.importWithToken(TOKEN);
        expect(app.lang).toBe('de-DE');
        expect($('.current-language-general-name').first().text()).toBe('German (DE)');
    });
});

describe('IndexedDB upgrade to version 4', () => {
    it('opens version 4 and creates the collections store when it is missing', async () => {
        const created: Array<[string, unknown]> = [];
        const request: any = {};
        const openSpy = vi.fn(() => request);
        (window.indexedDB as any).open = openSpy;
        const app = new EchoTalkApp();
        const p = app.dataService.initDB();
        const existing = new Set(['recordings', 'practices']);
        request.onupgradeneeded({ target: { result: {
            objectStoreNames: { contains: (n: string) => existing.has(n) },
            createObjectStore: (n: string, o: unknown) => { created.push([n, o]); return { createIndex: vi.fn() }; },
        } } });
        request.onsuccess({ target: { result: { ok: true } } });
        await p;
        expect(openSpy).toHaveBeenCalledWith('EchoTalkDB', 4);
        expect(created).toEqual([['collections', { keyPath: 'key' }]]);
    });
});
