import { describe, it, expect, vi, beforeEach } from 'vitest';
import $ from 'jquery';
import { EchoTalkApp } from '../../app';
import { escapeHtml } from '../../utils/html';

vi.mock('bootstrap', async (importOriginal) => {
    const original = await importOriginal<typeof import('bootstrap')>();
    const instance = { show: vi.fn(), hide: vi.fn() };
    return { ...original, Modal: { ...(original as any).Modal, getOrCreateInstance: vi.fn(() => instance), getInstance: vi.fn(() => instance) } };
});

const EVIL = '"><img src=x onerror=window.pwned=1> a b c d e';

describe('escapeHtml', () => {
    it('escapes the five HTML-significant characters', () => {
        expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    });
});

describe('sentences are escaped where existing code builds HTML', () => {
    let app: EchoTalkApp;
    beforeEach(() => { app = new EchoTalkApp(); });

    it('the recordings list does not create elements or break attributes', async () => {
        const rows = [{ sentence: EVIL, audio: new Blob(['x']), timestamp: new Date(1000), lang: 'en-US' }];
        const done = (result: any) => {
            const req: any = {};
            setTimeout(() => { req.result = result; req.onsuccess && req.onsuccess(); }, 0);
            return req;
        };
        const store = { getAll: () => done(rows), getAllKeys: () => done([1]) };
        app.db = { transaction: () => ({ objectStore: () => store }) } as any;
        await app.dataService.displayRecordings();
        expect($('#recordingsList img').length).toBe(0);
        expect($('#recordingsList [onerror]').length).toBe(0);
        expect($('#recordingsList .play-user-audio').attr('data-sentence')).toBe(EVIL);
        expect((window as any).pwned).toBeUndefined();
    });

    it('the sentence words on the setup and practice screens are escaped', () => {
        app.words = ['<img', 'src=x', 'onerror=window.pwned=1>', 'ok'];
        app.currentIndex = 0;
        app.uiService.renderFullSentence();
        app.uiService.renderSampleSentence();
        expect($('#fullSentence img').length).toBe(0);
        expect($('#sampleSentence img').length).toBe(0);
        expect($('#fullSentence').text()).toContain('<img');
        expect((window as any).pwned).toBeUndefined();
    });
});
