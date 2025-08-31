import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('State Management and Event Handlers', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        // Mock $.getJSON to control sample sentences
        ($.getJSON as any) = vi.fn(() =>
            Promise.resolve({
                sentences: ['Sample one', 'Sample two'],
            })
        );
        localStorage.clear();
        app = new EchoTalkApp();
        await app.init();
    });

    // Tests the useSample method to ensure it correctly loads a new
    // sample sentence, updates the UI, and resets the practice index.
    it('should correctly load a sample sentence and reset state', () => {
        // Manually set a different sentence first
        ($('#sentenceInput') as any).val('An old sentence');
        (app as any).currentIndex = 5;

        // Trigger the useSample method
        (app as any).useSample();

        const newSentence = ($('#sentenceInput').val() as string);
        expect(['Sample one', 'Sample two']).toContain(newSentence);
        expect((app as any).currentIndex).toBe(0);
        expect(localStorage.getItem('shadow_sentence')).toBe(newSentence);
    });

    // Tests the handleSampleWordClick handler, which allows the user to
    // set the starting point for their practice session.
    it('should update currentIndex when a word in the sample sentence is clicked', () => {
        // The initial sentence is rendered in init(). We create a mock element to click.
        const wordElement = $('<span></span>').attr('data-index', 3)[0];

        // Call the handler directly with the mock element
        (app as any).handleSampleWordClick(wordElement);

        // Verify that the current index was updated
        expect((app as any).currentIndex).toBe(3);
        // Verify that the new index was saved to localStorage
        expect(localStorage.getItem('shadow_index')).toBe('3');
    });

    // Tests the toggle for enabling/disabling voice recording.
    // It verifies that the internal state and localStorage are updated accordingly.
    it('should toggle the isRecordingEnabled flag and update localStorage', () => {
        // Create a mock checkbox element and set its 'checked' state
        const checkbox = $('<input type="checkbox" />');

        // Simulate checking the box
        checkbox.prop('checked', true);
        (app as any).handleRecordToggle(checkbox[0]);
        expect((app as any).isRecordingEnabled).toBe(true);
        expect(localStorage.getItem('shadow_record_audio')).toBe('true');

        // Simulate unchecking the box
        checkbox.prop('checked', false);
        (app as any).handleRecordToggle(checkbox[0]);
        expect((app as any).isRecordingEnabled).toBe(false);
        expect(localStorage.getItem('shadow_record_audio')).toBe('false');
    });

    // Tests that the resetApp function clears all relevant data from localStorage.
    it('should clear localStorage on resetApp', () => {
        // Set some dummy data in localStorage
        localStorage.setItem('shadow_sentence', 'A test sentence');
        localStorage.setItem('shadow_index', '5');

        // Call the reset function
        (app as any).resetApp();

        // Check that the data has been cleared
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
        expect(localStorage.getItem('shadow_index')).toBeNull();
        // Also verify that the page reload was called
        expect((location as any).reload).toHaveBeenCalled();
    });

    // Tests that startPractice correctly initializes the application state from UI inputs.
    it('should initialize practice state from UI values on start', () => {
        // 1. Set up the UI with custom values
        const customSentence = 'This is a custom sentence for testing.';
        ($('#sentenceInput') as any).val(customSentence);
        ($('#repsSelect') as any).val('5');
        $('#mode-check').prop('checked', true);

        // 2. Trigger the start practice button
        $('#startBtn').trigger('click');

        // 3. Verify that the internal state of the app reflects the UI values
        expect((app as any).sentence).toBe('This is a custom sentence for testing.');
        expect((app as any).reps).toBe(5);
        expect((app as any).practiceMode).toBe('check');
        expect((app as any).words.length).toBe(7);
    });

    // Ensures that clicking an element without a data-index attribute
    // does not change the current index.
    it('should not change currentIndex if a clicked word has no data-index', () => {
        // Set an initial index
        (app as any).currentIndex = 5;

        // Create a mock element without the 'data-index' attribute
        const wordElement = $('<span>A word</span>')[0];

        // Call the handler with the invalid element
        (app as any).handleSampleWordClick(wordElement);

        // Verify that the index has not changed from its initial value
        expect((app as any).currentIndex).toBe(5);
    });
});