import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        // جلوگیری از XHR واقعی
        ($.getJSON as any) = vi.fn(() => Promise.resolve({
            sentences: ['Practice sentence one', 'Practice sentence two'],
        }));

        app = new EchoTalkApp();
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click');

        // چک کنیم view تغییر کرده باشه
        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);

        // TTS باید صدا زده شده باشه
        expect(window.speechSynthesis.speak).toHaveBeenCalledOnce();
    });
});
