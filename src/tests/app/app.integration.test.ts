// Projects\EchoTalk\src\tests\app\app-more.test.ts
import { EchoTalkApp } from '../../app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('EchoTalkApp - Additional Tests', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        localStorage.clear();
        app = new EchoTalkApp();

        // Mock DB & fetchSamples to avoid real calls
        vi.spyOn(app.dataService, 'initDB').mockResolvedValue({} as any);
        vi.spyOn(app.dataService, 'fetchSamples').mockResolvedValue({
            levels: [
                { name: "Beginner", categories: [{ name: "Basic", sentences: ["Hello test"] }] }
            ]
        });

        await app.init();

        // Fake db object to avoid transaction errors
        (app as any).db = {
            transaction: vi.fn(() => ({
                objectStore: vi.fn(() => ({
                    getAll: vi.fn(() => ({ onsuccess: null, onerror: null }))
                }))
            }))
        };
    });

    // --- saveState & loadState integration ---
    it('should save and reload state consistently', () => {
        app.sentence = 'Integration test';
        app.reps = 5;
        app.currentIndex = 2;
        app.correctCount = 1;
        app.attempts = 4;
        app.speechRate = 1.4;
        app.lang = 'ru-RU';
        app.practiceMode = 'check';

        app.saveState();
        (app as any).loadState();

        expect(app.sentence).toBe('Integration test');
        expect(app.reps).toBe(5);
        expect(app.currentIndex).toBe(2);
        expect(app.correctCount).toBe(1);
        expect(app.attempts).toBe(4);
        expect(app.speechRate).toBe(1.4);
        expect(app.lang).toBe('ru-RU');
        expect(app.practiceMode).toBe('check');
    });

    // --- handleLanguageChange ---
    it('should change language and fetch new samples', async () => {
        const spy = vi.spyOn(app.dataService, 'fetchSamples');

        $('#languageSelect').val('de-DE');
        await app.handleLanguageChange();

        expect(app.lang).toBe('de-DE');
        expect(spy).toHaveBeenCalled();
    });

    // --- updateLanguageGeneral ---
    it('should update langGeneral to known value', () => {
        app.lang = 'it-IT';
        app.updateLanguageGeneral();
        expect(app.langGeneral).toBe('Italian (IT)');
    });

    // --- handleRecordToggle ---
    it('should update recording toggle correctly', () => {
        const checkbox = $('<input type="checkbox" />');
        checkbox.prop('checked', true);

        (app as any).handleRecordToggle(checkbox[0]);
        expect(app.isRecordingEnabled).toBe(true);

        checkbox.prop('checked', false);
        (app as any).handleRecordToggle(checkbox[0]);
        expect(app.isRecordingEnabled).toBe(false);
    });

    // --- handleVisibilityChange ---
    it('should stop recording when tab becomes hidden (not practicing)', async () => {
        const stopSpy = vi.spyOn(app.audioService, 'stopRecording').mockResolvedValue();
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });

        (app as any).handleVisibilityChange();

        expect(stopSpy).toHaveBeenCalled();
    });

    // --- modal events ---
    it('should update hash when a modal is shown', () => {
        const modal = $('<div class="modal" id="testModal"></div>').appendTo(document.body)[0];

        const event = new Event('show.bs.modal');
        Object.defineProperty(event, 'target', { value: modal });
        document.dispatchEvent(event);

        // normalize value (sometimes jsdom gives "modal" instead of "#modal")
        expect(window.location.hash.includes('modal')).toBe(true);
    });

    // --- myStreakModal special case ---
    it('should call streak handlers when myStreakModal is shown', () => {
        const streakModal = $('<div class="modal" id="myStreakModal"></div>').appendTo(document.body)[0];
        const spyData = vi.spyOn(app.dataService, 'populateStreakModal').mockImplementation(() => {});
        const spyUi = vi.spyOn(app.uiService, 'showStaticConfetti').mockImplementation(() => {});

        const event = new Event('show.bs.modal');
        Object.defineProperty(event, 'target', { value: streakModal });
        document.dispatchEvent(event);

        expect(spyData).toHaveBeenCalled();
        expect(spyUi).toHaveBeenCalled();
    });

    // --- hidden.bs.modal handler ---
    it('should clear hash when modal is hidden', () => {
        const spy = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
        window.location.hash = '#modal';

        const event = new Event('hidden.bs.modal');
        document.dispatchEvent(event);

        expect(spy).toHaveBeenCalled();
    });

    // --- practiceRelated-stat click ---
    it('should hide streak modal and call displayPractices', () => {
        const spyDisplay = vi.spyOn(app.dataService, 'displayPractices').mockImplementation(() => {});
        $('<div id="myStreakModal" class="modal"></div>').appendTo(document.body);

        (global as any).bootstrap = {
            Modal: {
                getInstance: () => ({ hide: vi.fn() })
            }
        };

        $('#myStreakModal').append('<div class="practiceRelated-stat"></div>');
        $('#myStreakModal .practiceRelated-stat').trigger('click');

        expect(spyDisplay).toHaveBeenCalled();
    });

});
