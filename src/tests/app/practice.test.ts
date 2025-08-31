import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

// Helper function to introduce a delay in async tests.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        vi.useRealTimers(); // Ensure real timers are used for setTimeout/setInterval.

        // Mock $.getJSON to prevent actual network requests when fetching sentences.
        ($.getJSON as any) = vi.fn(() =>
            Promise.resolve({
                sentences: ['Practice sentence one', 'Practice sentence two'],
            })
        );
        localStorage.clear(); // Clear localStorage before each test for a clean slate.
        app = new EchoTalkApp();
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click'); // Simulate clicking the start practice button.

        // Verify that the configuration area is hidden and the practice area is shown.
        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);
        // Ensure that speech synthesis was initiated to speak the first sentence.
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should cancel speech and reload page when reset is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click'); // Start practice to get into a state where reset is relevant.
        $('#resetBtn').trigger('click'); // Simulate clicking the reset button.

        // Verify that ongoing speech is cancelled and the page is reloaded.
        expect((window as any).speechSynthesis.cancel).toHaveBeenCalled();
        expect((location as any).reload).toHaveBeenCalled();
        // Ensure that relevant practice state is cleared from localStorage.
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
    });

    it('should finish session and show final message when finishSession is invoked', async () => {
        await app.init();

        // Directly call the private method to finish a session, bypassing UI interaction for testing purposes.
        (app as any).finishSession();

        // Verify that a final message (e.g., a heading) is displayed in the practice area.
        expect($('#practiceArea').find('h2').length).toBeGreaterThan(0);
        // Ensure that session-specific items are cleared from localStorage.
        expect(localStorage.getItem('shadow_index')).toBeNull();
        expect(localStorage.getItem('shadow_count')).toBeNull();
    });

    it('should speak the correct sentence when "Play Bot" is clicked', async () => {
        await app.init();
        const sentence = 'This is a test sentence';
        // Mock the global `modalRecordings` object which stores audio data.
        window.modalRecordings = { [sentence]: [] };
        // Create a mock button element with the sentence to be spoken.
        const btn = $('<button>').attr('data-sentence', sentence)[0];
        (app as any).playBotAudio(btn); // Call the method that handles playing bot audio.
        // Verify that the `speechSynthesis.speak` method was called.
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should handle a correct answer in check mode', async () => {
        await app.init();
        // Spy on `playSound` to verify which sound is played.
        vi.spyOn(app as any, 'playSound');
        ($('#sentenceInput') as any).val('This is a test'); // Set the sentence to practice.
        $('#mode-check').prop('checked', true); // Select 'check' practice mode.
        $('#startBtn').trigger('click');

        // Simulate user typing the correct first part of the sentence.
        ($('#userInput') as any).val('This is a');
        await (app as any).checkAnswer(); // Trigger the answer check.

        // Verify that the correct answer count increments and the 'correct' sound is played.
        expect((app as any).correctCount).toBe(1);
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/correct.mp3');
    });

    it('should handle an incorrect answer in check mode', async () => {
        await app.init();
        vi.spyOn(app as any, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Simulate user typing an incorrect answer.
        ($('#userInput') as any).val('Wrong words');
        await (app as any).checkAnswer();

        // Verify that the 'wrong' sound is played and appropriate feedback is shown.
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/wrong.mp3');
        expect($('#feedback').html()).toContain('Try again!');
    });

    it('should advance to the next phrase correctly in skip mode', async () => {
        await app.init();
        // Set a sentence with multiple phrases.
        ($('#sentenceInput') as any).val('one two three. four five six.');
        $('#startBtn').trigger('click');

        // Manually set initial state to simulate being in the middle of a session.
        (app as any).currentIndex = 0; // Current phrase starts at index 0.
        (app as any).currentCount = 1; // Already had one repetition.

        (app as any).advanceToNextPhrase(); // Call the method to advance to the next phrase.

        // Verify that the `currentIndex` has moved to the start of the next phrase ("four").
        expect((app as any).currentIndex).toBe(3);
        // Verify that the repetition count for the new phrase is reset.
        expect((app as any).currentCount).toBe(0);
    });

    it('should increment counts on correct answer without advancing', async () => {
        await app.init();
        vi.spyOn(app as any, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#repsSelect') as any).val('3'); // Require 3 repetitions.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        (app as any).currentCount = 0; // Simulate first attempt for the current phrase.

        // Simulate a correct user input for the current phrase.
        ($('#userInput') as any).val('This is a');
        await (app as any).checkAnswer();

        // Verify that correct count and current repetition count increment, but the phrase index does not advance.
        expect((app as any).correctCount).toBe(1);
        expect((app as any).currentCount).toBe(1);
        expect((app as any).currentIndex).toBe(0);
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/correct.mp3');
    });

    it('should advance to the next phrase after the last correct repetition', async () => {
        await app.init();
        ($('#sentenceInput') as any).val('This is a test phrase');
        ($('#repsSelect') as any).val('2'); // Require 2 repetitions.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Set state to be on the last required repetition for the first phrase.
        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        // Simulate the final correct answer for the current phrase.
        ($('#userInput') as any).val('This is a');
        await (app as any).checkAnswer();

        // Verify that the `currentIndex` advances to the start of the next phrase (index 3 for "test").
        expect((app as any).currentIndex).toBe(3);
        // Verify that the repetition count is reset for the new phrase.
        expect((app as any).currentCount).toBe(0);
    });

    it('should advance to next phrase if user input is empty on the last repetition', async () => {
        await app.init();
        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2'); // Require 2 repetitions.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Set state to be on the last repetition for the first phrase.
        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        // Simulate empty input, which acts as a "skip" for the current phrase.
        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        // Verify that the `currentIndex` advances to the start of the second phrase (index 2 for "Second").
        expect((app as any).currentIndex).toBe(2);
        // Verify that the repetition count is reset.
        expect((app as any).currentCount).toBe(0);
    });

    it('should repeat the phrase on empty answer if repetitions are not complete', async () => {
        await app.init();
        vi.spyOn(app as any, 'practiceStep'); // Spy on `practiceStep` to confirm it's called again.
        ($('#sentenceInput') as any).val('This is a test');
        ($('#repsSelect') as any).val('3'); // Require 3 repetitions.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Set state to be on the first repetition attempt.
        (app as any).currentCount = 0;
        (app as any).currentIndex = 0;

        // Simulate empty user input (a skip).
        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        // Verify that the repetition count increments, but the phrase index does not advance.
        expect((app as any).currentCount).toBe(1);
        expect((app as any).currentIndex).toBe(0);
        // Confirm that `practiceStep` was called to repeat the current phrase.
        expect((app as any).practiceStep).toHaveBeenCalled();
    });

    it('should display accuracy in the final message for check mode', async () => {
        await app.init();
        $('#mode-check').prop('checked', true); // Ensure 'check' mode is selected.
        $('#startBtn').trigger('click');

        // Manually set internal stats for accuracy calculation.
        (app as any).attempts = 10;
        (app as any).correctCount = 7; // Simulate 70% accuracy.

        (app as any).finishSession(); // Call the method to finish the session.

        const finalHtml = $('#practiceArea').html();
        // Verify that the final message includes the calculated accuracy percentage.
        expect(finalHtml).toContain('Your accuracy: 70%');
    });

    it('should dim words from previous sentences in renderFullSentence', async () => {
        await app.init();
        const sentence = 'First phrase ends here. The second phrase starts now.';
        ($('#sentenceInput') as any).val(sentence);
        $('#startBtn').trigger('click');

        // Set `currentIndex` to a word in the second phrase ("starts", which is at index 6).
        (app as any).currentIndex = 6;

        (app as any).renderFullSentence(); // Call the method to render the full sentence.

        // Verify that words from the first phrase have the 'text-muted' class (dimmed).
        expect($('#fullSentence span').eq(0).hasClass('text-muted')).toBe(true); // "First"
        expect($('#fullSentence span').eq(3).hasClass('text-muted')).toBe(true); // "here."

        // Verify that the current word ("starts") has the 'current-word' class.
        expect($('#fullSentence span').eq(6).hasClass('current-word')).toBe(true);
    });

    it('should call checkAnswer when the main check/skip button is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click'); // Transition to the practice view.

        // Spy on the `checkAnswer` method to confirm it's invoked.
        const checkAnswerSpy = vi.spyOn(app as any, 'checkAnswer');

        $('#checkBtn').trigger('click'); // Simulate a user clicking the main action button.

        // Verify that `checkAnswer` was called.
        expect(checkAnswerSpy).toHaveBeenCalled();
    });

    it('should show "0 of X attempts" feedback on final empty skip if reps >= 2', async () => {
        await app.init();
        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2'); // Set to require 2 repetitions.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Manually set state to be on the last repetition for the current phrase.
        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        // Spy on `advanceToNextPhrase` to confirm it's called.
        const advanceSpy = vi.spyOn(app as any, 'advanceToNextPhrase');

        // Simulate an empty user input (a skip).
        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        // Verify that the feedback message includes the special "0 of 2 attempts" text.
        expect($('#feedback').html()).toContain('(0 of 2 attempts)');
        // Confirm that the app advances to the next phrase.
        expect(advanceSpy).toHaveBeenCalled();
    });

    it('should highlight words based on speech synthesis boundary events on desktop', async () => {
        await app.init();
        const sentence = 'A simple test';
        ($('#sentenceInput') as any).val(sentence);

        // Override the global `speechSynthesis.speak` mock for this test to simulate `onboundary` events.
        (window.speechSynthesis as any).speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
            if (utterance.onboundary) {
                // Manually trigger `onboundary` events to simulate speech progress.
                utterance.onboundary({ name: 'word', charIndex: 0 } as SpeechSynthesisEvent); // "A"
                utterance.onboundary({ name: 'word', charIndex: 2 } as SpeechSynthesisEvent); // "simple"
            }
            if (utterance.onend) {
                utterance.onend({} as SpeechSynthesisEvent);
            }
        });

        $('#startBtn').trigger('click'); // This action initiates `speakAndHighlight`.

        // Since boundary events are triggered synchronously in the mock, we can check immediately.
        // The last triggered boundary event was for 'simple'.
        const highlightedWord = $('#sentence-container .highlighted');
        expect(highlightedWord.length).toBe(1);
        expect(highlightedWord.text()).toBe('simple');
    });
});