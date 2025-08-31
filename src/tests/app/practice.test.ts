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

    // Tests the 'checkAnswer' logic with a correct user input. It verifies that
    // state like 'correctCount' is updated and the correct sound is played.
    it('should handle a correct answer in check mode', async () => {
        await app.init();
        vi.spyOn(app as any, 'playSound'); // Spy on playSound to track calls
        ($('#sentenceInput') as any).val('This is a test');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Simulate user typing the correct answer
        ($('#userInput') as any).val('This is a'); // The first phrase
        await (app as any).checkAnswer();

        expect((app as any).correctCount).toBe(1);
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/correct.mp3');
    });

    // Tests the 'checkAnswer' logic with an incorrect user input. It verifies
    // that the correct sound for a wrong answer is played.
    it('should handle an incorrect answer in check mode', async () => {
        await app.init();
        vi.spyOn(app as any, 'playSound'); // Spy on playSound
        ($('#sentenceInput') as any).val('This is a test');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Simulate user typing a wrong answer
        ($('#userInput') as any).val('Wrong words');
        await (app as any).checkAnswer();

        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/wrong.mp3');
        expect($('#feedback').html()).toContain('Try again!');
    });

});
