import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('State Management and Event Handlers', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        vi.spyOn($, 'getJSON').mockResolvedValue({
            sentences: ['Test sentence one', 'Test sentence two'],
        });
        localStorage.clear();
        app = new EchoTalkApp();

        // Mock the IndexedDB transaction and object store to prevent real database interactions.
        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: vi.fn(),
                    add: vi.fn()
                })
            }))
        };
        vi.spyOn(app as any, 'initDB').mockResolvedValue(mockDbObject);

        await app.init();
    });

    it('should correctly load a sample sentence and reset state', async () => {
        // Manually set a different sentence and index to ensure they are reset.
        ($('#sentenceInput') as any).val('An old sentence');
        (app as any).currentIndex = 5;

        (app as any).useSample(); // Trigger the method to load a new sample sentence.
        const newSentence = ($('#sentenceInput').val() as string);
        // Verify that one of the mocked sample sentences is now in the input.
        expect(['Test sentence one', 'Test sentence two']).toContain(newSentence);
        // Verify that `currentIndex` is reset to 0 and the new sentence is saved to localStorage.
        expect((app as any).currentIndex).toBe(0);
        expect(localStorage.getItem('shadow_sentence')).toBe(newSentence);
    });

    it('should update currentIndex when a word in the sample sentence is clicked', () => {
        // Create a mock element representing a word with a specific `data-index`.
        const wordElement = $('<span></span>').attr('data-index', 3)[0];

        (app as any).handleSampleWordClick(wordElement); // Call the event handler directly.

        // Verify that the `currentIndex` is updated to the clicked word's index.
        expect((app as any).currentIndex).toBe(3);
        // Verify that the new index is also saved in localStorage.
        expect(localStorage.getItem('shadow_index')).toBe('3');
    });

    it('should toggle the isRecordingEnabled flag and update localStorage', () => {
        // Create a mock checkbox element for the record toggle.
        const checkbox = $('<input type="checkbox" />');

        // Simulate checking the box.
        checkbox.prop('checked', true);
        (app as any).handleRecordToggle(checkbox[0]);
        // Verify that the internal state and localStorage reflect the change.
        expect((app as any).isRecordingEnabled).toBe(true);
        expect(localStorage.getItem('shadow_record_audio')).toBe('true');

        // Simulate unchecking the box.
        checkbox.prop('checked', false);
        (app as any).handleRecordToggle(checkbox[0]);
        // Verify the state is toggled back and updated in localStorage.
        expect((app as any).isRecordingEnabled).toBe(false);
        expect(localStorage.getItem('shadow_record_audio')).toBe('false');
    });

    it('should clear localStorage on resetApp', () => {
        // Set some dummy data in localStorage to be cleared.
        localStorage.setItem('shadow_sentence', 'A test sentence');
        localStorage.setItem('shadow_index', '5');

        (app as any).resetApp(); // Call the reset function.

        // Verify that the specific items are cleared from localStorage.
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
        expect(localStorage.getItem('shadow_index')).toBeNull();
        // Also verify that `location.reload` was called to reload the page state.
        expect((location as any).reload).toHaveBeenCalled();
    });

    it('should initialize practice state from UI values on start', () => {
        // Override the mock FOR THIS TEST ONLY to start with a blank slate.
        // This is done to prevent `app.init()` from loading a sample sentence in `beforeEach` and ensure this test passes correctly.
        vi.spyOn($, 'getJSON').mockResolvedValueOnce({
            sentences: [],
        });

        // 1. Set up the UI with custom values.
        const customSentence = 'This is a custom sentence for testing.';
        ($('#sentenceInput') as any).val(customSentence);
        ($('#repsSelect') as any).val('5');
        $('#mode-check').prop('checked', true);

        // 2. Trigger the start practice button click.
        $('#startBtn').trigger('click');

        // 3. Verify that the app's internal state is correctly initialized.
        expect((app as any).sentence).toBe(customSentence);
        expect((app as any).reps).toBe(5);
        expect((app as any).practiceMode).toBe('check');
    });

    it('should not change currentIndex if a clicked word has no data-index', () => {
        (app as any).currentIndex = 5; // Set an initial index.

        // Create a mock element without the required `data-index` attribute.
        const wordElement = $('<span>A word</span>')[0];

        (app as any).handleSampleWordClick(wordElement); // Call the handler with the invalid element.

        // Verify that the `currentIndex` remains unchanged.
        expect((app as any).currentIndex).toBe(5);
    });
});
