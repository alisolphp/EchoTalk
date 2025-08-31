import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

// helpers
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        vi.useRealTimers();

        // Mock $.getJSON to avoid real network requests during tests
        ($.getJSON as any) = vi.fn(() =>
            Promise.resolve({
                sentences: ['Practice sentence one', 'Practice sentence two'],
            })
        );
        localStorage.clear();
        app = new EchoTalkApp();
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click');

        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should cancel speech and reload page when reset is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click');
        $('#resetBtn').trigger('click');

        expect((window as any).speechSynthesis.cancel).toHaveBeenCalled();
        expect((location as any).reload).toHaveBeenCalled();
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
    });

    it('should finish session and show final message when finishSession is invoked', async () => {
        await app.init();

        // Direct method call to bypass UI flow and test final state
        (app as any).finishSession();

        expect($('#practiceArea').find('h2').length).toBeGreaterThan(0);
        expect(localStorage.getItem('shadow_index')).toBeNull();
        expect(localStorage.getItem('shadow_count')).toBeNull();
    });

    // Confirms that clicking "Play Bot" triggers TTS for the correct sentence
    it('should speak the correct sentence when "Play Bot" is clicked', async () => {
        await app.init();
        const sentence = 'This is a test sentence';
        window.modalRecordings = { [sentence]: [] };
        const btn = $('<button>').attr('data-sentence', sentence)[0];
        (app as any).playBotAudio(btn);
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

});
