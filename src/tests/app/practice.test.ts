import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

/**
 * Helper function to introduce a delay in asynchronous tests.
 * @param ms - The delay in milliseconds.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        vi.useRealTimers();
        vi.spyOn($, 'getJSON').mockResolvedValue({
            "levels": [
                {
                    "name": "Beginner (A1-A2)",
                    "categories": [
                        {
                            "name": "Daily Conversations",
                            "sentences": [
                                "Hello, how are you?"
                            ]
                        },
                        {
                            "name": "Travel",
                            "sentences": [
                                "Where is the train station?"
                            ]
                        }
                    ]
                },
                {
                    "name": "Intermediate (B1-B2)",
                    "categories": [
                        {
                            "name": "Interview",
                            "sentences": [
                                "I'm a software architect with extensive experience in building scalable, resilient, and business-driven web platforms."
                            ]
                        },
                        {
                            "name": "Business & Workplace",
                            "sentences": [
                                "We need to schedule a meeting for next week."
                            ]
                        }
                    ]
                },
                {
                    "name": "Advanced (C1-C2)",
                    "categories": [
                        {
                            "name": "Formal & Academic",
                            "sentences": [
                                "The geopolitical landscape has undergone a significant transformation in recent decades."
                            ]
                        },
                        {
                            "name": "Complex Topics & Debate",
                            "sentences": [
                                "The advent of quantum computing poses an existential threat to modern cryptographic standards."
                            ]
                        },
                        {
                            "name": "Persuasion & Negotiation",
                            "sentences": [
                                "While I understand your position, I'd urge you to consider the strategic advantages from a long-term perspective."
                            ]
                        },
                        {
                            "name": "Figurative & Nuanced Language",
                            "sentences": [
                                "The CEO's speech was a masterclass in ambiguity, leaving everyone to read between the lines."
                            ]
                        }
                    ]
                }
            ]
        });
        localStorage.clear();
        app = new EchoTalkApp();

        // Mock the IndexedDB transaction and object store to prevent
        // actual database calls during tests. This ensures a consistent
        // and isolated test environment.
        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: vi.fn(),
                    add: vi.fn(),
                    clear: vi.fn().mockImplementation(function() {
                        const request: { onsuccess?: () => void } = {};
                        // Simulate async success to allow .onsuccess handler to be called
                        setTimeout(() => {
                            if (request.onsuccess) {
                                request.onsuccess();
                            }
                        }, 0);
                        return request;
                    })
                })
            }))
        };
        vi.spyOn(app as any, 'initDB').mockResolvedValue(mockDbObject);

        await app.init();
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        ($('#sentenceInput') as any).val('This is a test sentence');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test sentence');
        await (app as any).startPractice();

        // Verify that the configuration area is hidden and the practice area is shown.
        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);
        // Ensure that speech synthesis was initiated to speak the first sentence.
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    // Projects\EchoTalk\src\tests\app\practice.test.ts

    it('should cancel speech and reload page when reset is clicked', async () => {
        vi.useFakeTimers();

        // Start practice to get into a state where reset is relevant.
        $('#startBtn').trigger('click');
        // Simulate clicking the reset button.
        $('#resetBtn').trigger('click');

        // Manually advance timers to execute the setTimeout in the mock
        await vi.runAllTimers();

        // Verify that ongoing speech is cancelled and the page is reloaded.
        expect((window as any).speechSynthesis.cancel).toHaveBeenCalled();
        expect((location as any).reload).toHaveBeenCalled();
        // Ensure that relevant practice state is cleared from localStorage.
        expect(localStorage.getItem('shadow_sentence')).toBeNull();

        // It's a good practice to restore real timers
        vi.useRealTimers();
    });

    it('should finish session and show final message when finishSession is invoked', async () => {
        // Directly call the private method to finish a session, bypassing UI interaction for testing purposes.
        (app as any).finishSession();

        // Verify that a final message (e.g., a heading) is displayed in the practice area.
        expect($('#practiceArea').find('h2').length).toBeGreaterThan(0);
        // Ensure that session-specific items are cleared from localStorage.
        expect(localStorage.getItem('shadow_index')).toBeNull();
        expect(localStorage.getItem('shadow_count')).toBeNull();
    });

    it('should speak the correct sentence when "Play Bot" is clicked', async () => {
        const sentence = 'This is a test sentence';
        // Mock the global `modalRecordings` object which stores audio data.
        (window as any).modalRecordings = { [sentence]: [] };
        // Create a mock button element with the sentence to be spoken.
        const btn = $('<button>').attr('data-sentence', sentence)[0];
        // Call the method that handles playing bot audio.
        (app as any).playBotAudio(btn);
        // Verify that the `speechSynthesis.speak` method was called.
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should handle a correct answer in check mode', async () => {
        // Spy on `playSound` to verify which sound is played.
        vi.spyOn(app as any, 'playSound');
        // Set the sentence to practice.
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        // Select 'check' practice mode.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Simulate user typing the correct first part of the sentence.
        ($('#userInput') as any).val('This is a');
        // Trigger the answer check.
        await (app as any).checkAnswer();

        // Verify that the correct answer count increments and the 'correct' sound is played.
        expect((app as any).correctCount).toBe(1);
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/correct.mp3', 1, 0.6);
    });

    it('should handle an incorrect answer in check mode', async () => {
        vi.useFakeTimers();
        vi.spyOn(app as any, 'playSound');

        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        $('#mode-check').prop('checked', true);

        await (app as any).startPractice();

        ($('#userInput') as any).val('Wrong words');
        await (app as any).checkAnswer();

        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/wrong.mp3', 1, 0.6);
        expect($('#feedback').html()).toContain('Try again!');

        vi.useRealTimers();
    });

    it('should advance to the next phrase correctly in skip mode', async () => {
        // Set a sentence with multiple phrases.
        ($('#sentenceInput') as any).val('one two three. four five six.');
        ($('#sentenceInput') as any).attr('onw two three. four five six.');
        $('#startBtn').trigger('click');

        // Manually set initial state to simulate being in the middle of a session.
        // Current phrase starts at index 0.
        (app as any).currentIndex = 0;
        // Already had one repetition.
        (app as any).currentCount = 1;

        // Call the method to advance to the next phrase.
        (app as any).advanceToNextPhrase();

        // Verify that the `currentIndex` has moved to the start of the next phrase ("four").
        expect((app as any).currentIndex).toBe(3);
        // Verify that the repetition count for the new phrase is reset.
        expect((app as any).currentCount).toBe(0);
    });

    it('should increment counts on correct answer without advancing', async () => {
        vi.spyOn(app as any, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        // Require 3 repetitions.
        ($('#repsSelect') as any).val('3');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Simulate first attempt for the current phrase.
        (app as any).currentCount = 0;

        // Simulate a correct user input for the current phrase.
        ($('#userInput') as any).val('This is a');
        await (app as any).checkAnswer();

        // Verify that correct count and current repetition count increment, but the phrase index does not advance.
        expect((app as any).correctCount).toBe(1);
        expect((app as any).currentCount).toBe(1);
        expect((app as any).currentIndex).toBe(0);
        expect((app as any).playSound).toHaveBeenCalledWith('./sounds/correct.mp3', 1, 0.6);
    });

    it('should advance to the next phrase after the last correct repetition', async () => {
        ($('#sentenceInput') as any).val('This is a test phrase');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test phrase');
        // Require 2 repetitions.
        ($('#repsSelect') as any).val('2');
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
        vi.useFakeTimers();

        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#sentenceInput') as any).attr('data-val', 'First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2');
        $('#mode-check').prop('checked', true);

        await (app as any).startPractice();

        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        await vi.runAllTimers();

        expect((app as any).currentIndex).toBe(2);
        expect((app as any).currentCount).toBe(0);

        vi.useRealTimers();
    });

    it('should repeat the phrase on empty answer if repetitions are not complete', async () => {
        // Spy on `practiceStep` to confirm it's called again.
        vi.spyOn(app as any, 'practiceStep');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        // Require 3 repetitions.
        ($('#repsSelect') as any).val('3');
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
        // Ensure 'check' mode is selected.
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        // Manually set internal stats for accuracy calculation.
        (app as any).attempts = 10;
        // Simulate 70% accuracy.
        (app as any).correctCount = 7;

        // Call the method to finish the session.
        (app as any).finishSession();

        const finalHtml = $('#practiceArea').html();
        // Verify that the final message includes the calculated accuracy percentage.
        expect(finalHtml).toContain('Your accuracy: 70%');
    });

    it('should dim words from previous sentences in renderFullSentence', async () => {
        const sentence = 'First phrase ends here. The second phrase starts now.';
        ($('#sentenceInput') as any).val(sentence);
        ($('#sentenceInput') as any).attr('data-val', sentence);
        $('#startBtn').trigger('click');

        // Set `currentIndex` to a word in the second phrase ("starts", which is at index 6).
        (app as any).currentIndex = 6;

        // Call the method to render the full sentence.
        (app as any).renderFullSentence();

        // Verify that words from the first phrase have the 'text-muted' class (dimmed).
        expect($('#fullSentence span').eq(0).hasClass('text-muted')).toBe(true); // "First"
        expect($('#fullSentence span').eq(3).hasClass('text-muted')).toBe(true); // "here."

        // Verify that the current word ("starts") has the 'current-word' class.
        expect($('#fullSentence span').eq(6).hasClass('current-word')).toBe(true);
    });

    it('should call checkAnswer when the main check/skip button is clicked', async () => {
        ($('#sentenceInput') as any).val('A test sentence.');
        ($('#sentenceInput') as any).attr('data-val', 'A test sentence.');
        // Transition to the practice view.
        $('#startBtn').trigger('click');

        // Spy on the `checkAnswer` method to confirm it's invoked.
        const checkAnswerSpy = vi.spyOn(app as any, 'checkAnswer');

        // Simulate a user clicking the main action button.
        $('#checkBtn').trigger('click');

        // Verify that `checkAnswer` was called.
        expect(checkAnswerSpy).toHaveBeenCalled();
    });

    it('should show "0 of X attempts" feedback on final empty skip if reps >= 2', async () => {
        vi.useFakeTimers();

        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#sentenceInput') as any).attr('data-val', 'First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2');
        $('#mode-check').prop('checked', true);

        await (app as any).startPractice();

        (app as any).currentCount = 1;
        (app as any).currentIndex = 0;

        const advanceSpy = vi.spyOn(app as any, 'advanceToNextPhrase');

        ($('#userInput') as any).val('');
        await (app as any).checkAnswer();

        expect($('#feedback').html()).toContain('(0 of 2 attempts)');

        await vi.runAllTimers();

        expect(advanceSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should highlight words based on speech synthesis boundary events on desktop', async () => {
        const sentence = 'I\'m a software architect with extensive experience in building scalable, resilient, and business-driven web platforms.';
        ($('#sentenceInput') as any).val(sentence);
        ($('#sentenceInput') as any).attr('data-val', sentence);

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

        // This action initiates `speakAndHighlight`.
        await (app as any).startPractice();

        // Since boundary events are triggered synchronously in the mock, we can check immediately.
        const highlightedWord = $('#sentence-container .highlighted');
        expect(highlightedWord.length).toBe(1);
        expect(highlightedWord.text()).toBe('I\'m');
    });
});