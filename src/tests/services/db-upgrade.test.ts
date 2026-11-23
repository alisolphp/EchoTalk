import { describe, it, expect, vi, beforeEach } from 'vitest';
import $ from 'jquery';
import { EchoTalkApp } from '../../app';

describe('IndexedDB open handling', () => {
    let app: EchoTalkApp;
    let request: any;

    beforeEach(() => {
        app = new EchoTalkApp();
        request = {};
        (window.indexedDB as any).open = vi.fn(() => request);
    });

    it('shows a notice while another tab blocks the upgrade, hides it when the open succeeds', async () => {
        const p = app.dataService.initDB();
        request.onblocked();
        expect($('#dbBlockedNotice').hasClass('d-none')).toBe(false);
        expect($('#dbBlockedNotice').text()).toContain('close every other EchoTalk tab');
        const db: any = { close: vi.fn() };
        request.onsuccess({ target: { result: db } });
        expect(await p).toBe(db);
        expect($('#dbBlockedNotice').hasClass('d-none')).toBe(true);
    });

    it('closes its own connection when another tab upgrades the database, and says to reload', async () => {
        const p = app.dataService.initDB();
        const db: any = { close: vi.fn() };
        request.onsuccess({ target: { result: db } });
        await p;
        db.onversionchange();
        expect(db.close).toHaveBeenCalled();
        expect($('#dbBlockedNotice').hasClass('d-none')).toBe(false);
        expect($('#dbBlockedNotice').text()).toContain('reload');
    });

    it('still rejects when the open fails', async () => {
        const p = app.dataService.initDB();
        request.onerror({ target: { error: new Error('x') } });
        await expect(p).rejects.toBe('Database error');
    });
});
