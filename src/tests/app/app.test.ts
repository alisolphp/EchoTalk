import { EchoTalkApp } from '../../app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('EchoTalkApp - Extra Tests', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        vi.spyOn($, 'getJSON').mockResolvedValue({
            levels: [
                { name: "Beginner", categories: [{ name: "Basic", sentences: ["Hello world"] }] }
            ]
        });

        localStorage.clear();
        app = new EchoTalkApp();

        // Mock IndexedDB
        const mockDbObject = {
            objectStoreNames: ['recordings'],
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    clear: vi.fn().mockReturnValue({ onsuccess: null }),
                }),
            })),
        };
        vi.spyOn(app.dataService, 'initDB').mockResolvedValue(mockDbObject as any);

        await app.init();
    });

    // --- loadState ---
    it('should correctly load values from localStorage into state', () => {
        localStorage.setItem(app.STORAGE_KEYS.sentence, 'Test sentence');
        localStorage.setItem(app.STORAGE_KEYS.reps, '3');
        localStorage.setItem(app.STORAGE_KEYS.practiceMode, 'check');
        localStorage.setItem(app.STORAGE_KEYS.lang, 'fr-FR');

        (app as any).loadState();

        expect(app.sentence).toBe('Test sentence');
        expect(app.reps).toBe(3);
        expect(app.practiceMode).toBe('check');
        expect(app.lang).toBe('fr-FR');
    });

    // --- saveState ---
    it('should persist state variables into localStorage', () => {
        app.sentence = 'Save this';
        app.currentIndex = 2;
        app.correctCount = 1;
        app.attempts = 5;
        app.lang = 'de-DE';
        app.practiceMode = 'skip';

        app.saveState();

        expect(localStorage.getItem(app.STORAGE_KEYS.sentence)).toBe('Save this');
        expect(localStorage.getItem(app.STORAGE_KEYS.index)).toBe('2');
        expect(localStorage.getItem(app.STORAGE_KEYS.correctCount)).toBe('1');
        expect(localStorage.getItem(app.STORAGE_KEYS.attempts)).toBe('5');
        expect(localStorage.getItem(app.STORAGE_KEYS.lang)).toBe('de-DE');
        expect(localStorage.getItem(app.STORAGE_KEYS.practiceMode)).toBe('skip');
    });

    // --- handleRecordToggle ---
    it('should enable recording when toggle is checked', () => {
        const checkbox = $('<input type="checkbox" />');
        checkbox.prop('checked', true);

        (app as any).handleRecordToggle(checkbox[0]);

        expect(app.isRecordingEnabled).toBe(true);
        expect(localStorage.getItem(app.STORAGE_KEYS.recordAudio)).toBe('true');
    });

    it('should disable recording when toggle is unchecked', () => {
        const checkbox = $('<input type="checkbox" />');
        checkbox.prop('checked', false);

        (app as any).handleRecordToggle(checkbox[0]);

        expect(app.isRecordingEnabled).toBe(false);
        expect(localStorage.getItem(app.STORAGE_KEYS.recordAudio)).toBe('false');
    });

    // --- updateLanguageGeneral ---
    it('should update langGeneral when language changes', () => {
        app.lang = 'es-ES';
        app.updateLanguageGeneral();
        expect(app.langGeneral).toBe('Spanish (ES)');
    });

    it('should fallback to English if language is unknown', () => {
        app.lang = 'xx-YY';
        app.updateLanguageGeneral();
        expect(app.langGeneral).toBe('English');
    });

    // --- resetWithoutReload ---
    it('should reset state without reload', async () => {
        app.sentence = 'Old sentence';
        app.currentIndex = 5;
        app.correctCount = 2;

        await app.resetWithoutReload();

        expect(app.sentence).toBe('Hello world');
        expect(app.currentIndex).toBe(0);
        expect(app.correctCount).toBe(0);
        expect($('#configArea').hasClass('d-none')).toBe(false);
        expect($('#practiceArea').hasClass('d-none')).toBe(true);
    });

    // --- handlePracticeThis ---
    it('should start practice from history button', async () => {
        const btn = $('<button>')
            .attr('data-sentence', 'Hello world')
            .attr('data-lang', 'en-US')[0];

        await app.handlePracticeThis(btn);

        expect(app.sentence).toBe('Hello world');
        expect(app.words.length).toBeGreaterThan(0);
    });

    it('should log error if sentence or lang missing in handlePracticeThis', async () => {
        const consoleSpy = vi.spyOn(console, 'error');
        const btn = $('<button>')[0];

        await app.handlePracticeThis(btn);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('missing'));
    });

    // --- handleHashChange ---
    it('should reset practice if hash is not #practice', () => {
        $('#practiceArea').removeClass('d-none');
        window.location.hash = '';

        (app as any).handleHashChange();

        expect(app.currentIndex).toBe(0);
    });

    // --- handleVisibilityChange ---
    it('should reset practice on tab hide if practicing', () => {
        app.area = 'Practice';
        app.practiceMode = 'check';
        app.isRecordingEnabled = true;

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
        });

        (app as any).handleVisibilityChange();

        expect(app.area).toBe('PrePractice');
    });

    // --- registerServiceWorker ---
    it('should try to register service worker', () => {
        const spy = vi.spyOn(navigator.serviceWorker, 'register')
            .mockResolvedValue({} as any);

        (app as any).registerServiceWorker();

        expect(spy).toHaveBeenCalledWith('./sw.js');
    });

    // --- entrypoint ---
    it('should auto-init app when not in test mode', async () => {
        const oldEnv = import.meta.env.MODE;
        (import.meta as any).env.MODE = 'production';

        vi.resetModules();
        await import('../../app');

        expect((window as any).app).toBeInstanceOf(EchoTalkApp);

        (import.meta as any).env.MODE = oldEnv;
    });

});
