import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('Initialization', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        // جلوگیری از XHR واقعی
        ($.getJSON as any) = vi.fn(() => Promise.resolve({
            sentences: ['Test sentence one', 'Test sentence two'],
        }));

        app = new EchoTalkApp();
    });

    it('should initialize correctly and fetch sample sentences', async () => {
        await app.init();

        // جملات نمونه باید ست شده باشن
        const value = $('#sentenceInput').val();
        expect(['Test sentence one', 'Test sentence two']).toContain(value);

        // گزینه‌های repetition باید ساخته بشن
        expect($('#repsSelect option').length).toBeGreaterThan(0);
    });

    it('should load state from localStorage if available', async () => {
        localStorage.setItem('shadow_sentence', 'Stored sentence');
        localStorage.setItem('shadow_reps', '5');

        await app.init();

        expect($('#sentenceInput').val()).toBe('Stored sentence');
        expect($('#repsSelect').val()).toBe('5');
    });
});
