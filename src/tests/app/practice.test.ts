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


    // Tests the advanceToNextPhrase method in 'skip' mode.
    // It ensures that when a user skips, the current index is correctly moved
    // to the start of the next phrase and the repetition count is reset.
    it('should advance to the next phrase correctly in skip mode', async () => {
        await app.init();
        ($('#sentenceInput') as any).val('one two three. four five six.');
        $('#startBtn').trigger('click'); // This initializes words array among others

        // Manually set initial state for the test
        (app as any).currentIndex = 0;
        (app as any).currentCount = 1;

        // Call the method that handles advancing
        (app as any).advanceToNextPhrase();

        // The index should now be at the start of the next phrase ('four')
        expect((app as any).currentIndex).toBe(3);
        // The repetition count for the new phrase should be reset to 0
        expect((app as any).currentCount).toBe(0);
    });


// Tests the checkAnswer logic when the user provides a correct answer,
// but has not completed all repetitions for the current phrase yet.
    it('should increment counts on correct answer without advancing', async () => {
        await app.init();
        vi.spyOn(app as any, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#repsSelect') as any).val('3'); // 3 repetitions
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // current phrase is "This is a"
        (app as any).currentCount = 0; // First attempt

        // Simulate correct user input
        ($('#userInput') as any).val('This is a');
        await (app as any).checkAnswer();

        // Correct count should go up
        expect((app as any).correctCount).toBe(1);
        // Current repetition count should increment
        expect((app as any).currentCount).toBe(1);
        // The main index should NOT advance yet
        expect((app as any).currentIndex).toBe(0);
        // Should play the correct sound
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/correct.mp3');
    });


// Tests the checkAnswer logic for the final correct repetition of a phrase.
// It ensures that after the last required repetition, the app advances
// to the next phrase.
    it('should advance to the next phrase after the last correct repetition', async () => {
        await app.init();
        ($('#sentenceInput') as any).val('This is a test phrase');
        ($('#repsSelect') as any).val('2'); // 2 repetitions
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Set state to be on the last repetition
        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        // Simulate the final correct answer
        ($('#userInput') as any).val('This is a');
        await (app as any).checkAnswer();

        // After the last rep, the index should advance to the next phrase (index 3)
        expect((app as any).currentIndex).toBe(3);
        // The repetition count should reset for the new phrase
        expect((app as any).currentCount).toBe(0);
    });

// Tests how the application handles an empty user input in 'check' mode.
// When the user submits nothing, it should be treated as a skip. If it's the
// last repetition, it should advance to the next phrase.
    it('should advance to next phrase if user input is empty on the last repetition', async () => {
        await app.init();
        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Set state to be the last repetition for the first phrase
        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        // Simulate empty input, which acts as a "skip"
        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        // The index should advance to the start of the second phrase (index 2)
        expect((app as any).currentIndex).toBe(2);
        // Repetition count should reset
        expect((app as any).currentCount).toBe(0);
    });

    // Tests that submitting an empty answer (skipping) before all repetitions are done
    // simply repeats the current phrase instead of advancing.
    it('should repeat the phrase on empty answer if repetitions are not complete', async () => {
        await app.init();
        vi.spyOn(app as any, 'practiceStep');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#repsSelect') as any).val('3'); // 3 repetitions
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Set state to be on the first repetition attempt
        (app as any).currentCount = 0;
        (app as any).currentIndex = 0;

        // Simulate empty input (skip)
        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        // The repetition count should increment
        expect((app as any).currentCount).toBe(1);
        // The main index should NOT advance
        expect((app as any).currentIndex).toBe(0);
        // The practice step should be called again to repeat the phrase
        expect((app as any).practiceStep).toHaveBeenCalled();
    });

    // Verifies that the finishSession message includes the accuracy percentage when in 'check' mode.
    it('should display accuracy in the final message for check mode', async () => {
        await app.init();
        // Set mode to 'check'
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Manually set stats for accuracy calculation
        (app as any).attempts = 10;
        (app as any).correctCount = 7; // 70% accuracy

        // Call finishSession
        (app as any).finishSession();

        const finalHtml = $('#practiceArea').html();
        expect(finalHtml).toContain('Your accuracy: 70%');
    });

    // Tests that renderFullSentence correctly dims the words of previous phrases.
    it('should dim words from previous sentences in renderFullSentence', async () => {
        await app.init();
        const sentence = 'First phrase ends here. The second phrase starts now.';
        ($('#sentenceInput') as any).val(sentence);
        $('#startBtn').trigger('click');

        // Set current index to a word in the second phrase ("starts")
        (app as any).currentIndex = 6;

        // Render the full sentence view
        (app as any).renderFullSentence();

        const fullSentenceHtml = $('#fullSentence').html();

        // Words from the first phrase should be dimmed
        expect($('#fullSentence span').eq(0).hasClass('text-muted')).toBe(true); // "First"
        expect($('#fullSentence span').eq(3).hasClass('text-muted')).toBe(true); // "here."

        // The current word should have the 'current-word' class
        expect($('#fullSentence span').eq(6).hasClass('current-word')).toBe(true); // "starts"
    });

});
