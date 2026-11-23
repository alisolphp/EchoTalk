import { describe, it, expect, vi, beforeEach } from 'vitest';
import $ from 'jquery';
import { EchoTalkApp } from '../../app';

/** In-memory recordings store with autoIncrement-like keys, shaped like the IndexedDB calls the app uses. */
function fakeDb(initial: Array<{ sentence: string; lang?: string; ts?: number }>) {
    const rows = new Map<number, any>();
    initial.forEach((r, i) => rows.set(i + 1, {
        sentence: r.sentence, audio: new Blob(['x']), timestamp: new Date(r.ts ?? 1000 * (i + 1)), lang: r.lang ?? 'en-US',
    }));
    const done = (result: any) => {
        const req: any = {};
        setTimeout(() => { req.result = result; req.onsuccess && req.onsuccess(); }, 0);
        return req;
    };
    const store = {
        getAll: vi.fn(() => done([...rows.values()])),
        getAllKeys: vi.fn(() => done([...rows.keys()])),
        delete: vi.fn((k: number) => { rows.delete(k); return done(undefined); }),
        clear: vi.fn(() => { rows.clear(); return done(undefined); }),
    };
    const db = { transaction: vi.fn(() => ({ objectStore: () => store })) };
    return { db, store, rows };
}

describe('Deleting recordings', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        app = new EchoTalkApp();
        (app as any).bindEvents();
    });

    it('deleteRecording removes only the recording with that key', async () => {
        const { db, store, rows } = fakeDb([{ sentence: 'A b c' }, { sentence: 'A b c' }, { sentence: 'D e f' }]);
        app.db = db as any;
        await app.dataService.deleteRecording(2);
        expect(store.delete).toHaveBeenCalledWith(2);
        expect([...rows.keys()]).toEqual([1, 3]);
    });

    it('deleteAllRecordings clears only the recordings store', async () => {
        const { db, store, rows } = fakeDb([{ sentence: 'A' }, { sentence: 'B' }]);
        app.db = db as any;
        await app.dataService.deleteAllRecordings();
        expect(db.transaction).toHaveBeenCalledWith(['recordings'], 'readwrite');
        expect(store.clear).toHaveBeenCalled();
        expect(rows.size).toBe(0);
    });

    it('displayRecordings attaches the database key to each recording and renders a Delete button', async () => {
        const { db } = fakeDb([{ sentence: 'Hello world today friend', ts: 1000 }, { sentence: 'Hello world today friend', ts: 2000 }]);
        app.db = db as any;
        await app.dataService.displayRecordings();
        const recs = window.modalRecordings['Hello world today friend'];
        expect(recs.map(r => r.id).sort()).toEqual([1, 2]);
        expect($('#recordingsList .delete-recording').length).toBe(2);
        expect($('#deleteAllRecordingsBtn').hasClass('d-none')).toBe(false);
    });

    it('hides "Delete all" when there are no recordings', async () => {
        const { db } = fakeDb([]);
        app.db = db as any;
        await app.dataService.displayRecordings();
        expect($('#deleteAllRecordingsBtn').hasClass('d-none')).toBe(true);
    });

    it('clicking Delete asks first, deletes the right recording and refreshes the list', async () => {
        const { db, rows } = fakeDb([{ sentence: 'Hello world today friend', ts: 1000 }, { sentence: 'Hello world today friend', ts: 2000 }]);
        app.db = db as any;
        await app.dataService.displayRecordings();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        $('#recordingsList .delete-recording').first().trigger('click');
        await new Promise(r => setTimeout(r, 20));
        expect(confirmSpy).toHaveBeenCalled();
        expect(rows.size).toBe(2);

        confirmSpy.mockReturnValue(true);
        // Newest first: index 0 is the recording with ts 2000 (key 2).
        $('#recordingsList .delete-recording').first().trigger('click');
        await new Promise(r => setTimeout(r, 100));
        expect([...rows.keys()]).toEqual([1]);
        expect($('#recordingsList .delete-recording').length).toBe(1);
    });

    it('Delete all asks first and then empties the list but keeps practices', async () => {
        const { db, rows } = fakeDb([{ sentence: 'One two three four' }]);
        app.db = db as any;
        await app.dataService.displayRecordings();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        $('#deleteAllRecordingsBtn').trigger('click');
        await new Promise(r => setTimeout(r, 20));
        expect(rows.size).toBe(1);
        confirmSpy.mockReturnValue(true);
        $('#deleteAllRecordingsBtn').trigger('click');
        await new Promise(r => setTimeout(r, 100));
        expect(rows.size).toBe(0);
        expect($('#recordingsList').text()).toContain('No recordings found yet');
        expect(db.transaction).not.toHaveBeenCalledWith(['practices'], 'readwrite');
    });

    it('the Delete button is not rendered when keys are unavailable', async () => {
        const { db, store } = fakeDb([{ sentence: 'Hello world today friend' }]);
        (store as any).getAllKeys = undefined;
        app.db = db as any;
        await app.dataService.displayRecordings();
        expect($('#recordingsList .delete-recording').length).toBe(0);
    });
});
