import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('Initialization', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        // Mock $.getJSON to prevent actual network requests during tests.
        // This can be overridden in specific tests if different data is needed.
        ($.getJSON as any) = vi.fn(() =>
            Promise.resolve({
                sentences: ['Test sentence one', 'Test sentence two'],
            })
        );
        localStorage.clear(); // Clear localStorage to ensure a clean state for each test.
        app = new EchoTalkApp();
    });

    it('should initialize correctly and fetch sample sentences', async () => {
        await app.init();

        const value = $('#sentenceInput').val();
        // Verifies that one of the mocked sample sentences is loaded into the input.
        expect(['Test sentence one', 'Test sentence two']).toContain(value);

        // Check that repetition options are dynamically populated in the UI.
        expect($('#repsSelect option').length).toBeGreaterThan(0);
    });

    it('should load state from localStorage if available', async () => {
        // Preload localStorage with mock values to simulate a previously saved user session.
        localStorage.setItem('shadow_sentence', 'Stored sentence');
        localStorage.setItem('shadow_reps', '5');
        localStorage.setItem('shadow_record_audio', 'true');

        // Re-instantiate the app to trigger its state loading logic from localStorage.
        app = new EchoTalkApp();
        await app.init();

        // Verify that UI elements reflect the loaded state.
        expect($('#sentenceInput').val()).toBe('Stored sentence');
        expect($('#repsSelect').val()).toBe('5');
        expect($('#recordToggle').prop('checked')).toBe(true);
    });

    it('should save state to localStorage when starting practice', async () => {
        await app.init();

        // Simulate user interaction by setting values in the UI.
        ($('#sentenceInput') as any).val('New test sentence');
        ($('#repsSelect') as any).val('3');

        // Trigger the 'start' button click, which should internally call the save state logic.
        $('#startBtn').trigger('click');

        // Verify that the new state is persisted in localStorage.
        expect(localStorage.getItem('shadow_sentence')).toBe('New test sentence');
        expect(localStorage.getItem('shadow_reps')).toBe('3');
    });

    it('should handle failure in fetching sample sentences gracefully', async () => {
        // Simulate a network failure by configuring $.getJSON to return a rejected promise.
        ($.getJSON as any).mockImplementationOnce(() => Promise.reject('Network error'));

        app = new EchoTalkApp();
        // Expect the initialization process to complete without throwing an unhandled error.
        await expect(app.init()).resolves.not.toThrow();

        // Verify that an alert message is displayed in the configuration area indicating the failure.
        expect($('#configArea .alert').length).toBeGreaterThan(0);
    });

});