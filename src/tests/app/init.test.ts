import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('Initialization', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        // Mock $.getJSON to avoid real network requests; override per test if needed
        ($.getJSON as any) = vi.fn(() =>
            Promise.resolve({
                sentences: ['Test sentence one', 'Test sentence two'],
            })
        );
        localStorage.clear();
        app = new EchoTalkApp();
    });

    it('should initialize correctly and fetch sample sentences', async () => {
        await app.init();

        const value = $('#sentenceInput').val();
        expect(['Test sentence one', 'Test sentence two']).toContain(value);

        // Check that repetition options are dynamically populated
        expect($('#repsSelect option').length).toBeGreaterThan(0);
    });

    it('should load state from localStorage if available', async () => {
        // Preload localStorage with mock values to simulate saved user state
        localStorage.setItem('shadow_sentence', 'Stored sentence');
        localStorage.setItem('shadow_reps', '5');
        localStorage.setItem('shadow_record_audio', 'true');

        // Re-instantiate app to trigger state loading logic
        app = new EchoTalkApp();
        await app.init();

        expect($('#sentenceInput').val()).toBe('Stored sentence');
        expect($('#repsSelect').val()).toBe('5');
        expect($('#recordToggle').prop('checked')).toBe(true);
    });

    it('should save state to localStorage when starting practice', async () => {
        await app.init();

        // Simulate user input before starting practice
        ($('#sentenceInput') as any).val('New test sentence');
        ($('#repsSelect') as any).val('3');

        // Trigger practice start; this should invoke saveState internally
        $('#startBtn').trigger('click');

        expect(localStorage.getItem('shadow_sentence')).toBe('New test sentence');
        expect(localStorage.getItem('shadow_reps')).toBe('3');
    });

    it('should handle failure in fetching sample sentences gracefully', async () => {
        // Simulate network failure by mocking $.getJSON to reject
        ($.getJSON as any).mockImplementationOnce(() => Promise.reject('Network error'));

        app = new EchoTalkApp();
        await expect(app.init()).resolves.not.toThrow();

        // On failure, app should show an alert in the config area
        expect($('#configArea .alert').length).toBeGreaterThan(0);
    });
});
