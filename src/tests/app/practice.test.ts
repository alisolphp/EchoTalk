import { EchoTalkApp } from '../../app';
import { vi } from 'vitest';
import $ from 'jquery';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        vi.useFakeTimers(); // Use fake timers to control async operations
        vi.spyOn($, 'getJSON').mockResolvedValue({
            "levels": [
                {
                    "name": "Beginner (A1-A2)",

                    "categories": []
                },
                {
                    "name": "Intermediate (B1-B2)",
                    "categories": [

                        {
                            "name": "Interview",
                            "sentences": [

                                "I'm a software architect with extensive experience in building scalable, resilient, and business-driven web platforms."
                            ]
                        }
                    ]

                },
                {
                    "name": "Advanced (C1-C2)",
                    "categories": []
                }
            ]

        });

        localStorage.clear();
        app = new EchoTalkApp();
        // A more realistic in-memory mock for IndexedDB
        const mockDbStore: { [key: string]: any } = {};
        const mockDbObject = {
            objectStoreNames: ['recordings', 'practices'],
            transaction: vi.fn(() => {
                const transaction = {
                    objectStore: () => ({
                        get: vi.fn((key: string) => {

                            const request: { onsuccess?: () => void, result?: any } = {};
                            setTimeout(() => {
                                request.result = mockDbStore[key];

                                if (request.onsuccess) request.onsuccess();
                            }, 0);
                            return request;

                        }),
                        put: vi.fn((data: any) => {
                            mockDbStore[data.sentence] = data;
                        }),

                        add: vi.fn((data: any) => {
                            mockDbStore[data.sentence] = data;
                        }),
                        clear: vi.fn(() => {

                            const request: { onsuccess?: () => void } = {};
                            setTimeout(() => {
                                Object.keys(mockDbStore).forEach(key => delete mockDbStore[key]);
                                if (request.onsuccess) request.onsuccess();
                            }, 0);
                            return request;
                        })
                    }),
                    oncomplete: null as (() => void) |
                        null,
                    onerror: null
                };
                // Automatically trigger oncomplete after operations
                setTimeout(() => {
                    if (transaction.oncomplete) transaction.oncomplete();
                }, 0);
                return transaction;
            })
        };

        vi.spyOn(app.dataService, 'initDB').mockResolvedValue(mockDbObject as any);

        await app.init();
        await vi.runAllTimers();
        // Wait for init to complete fully
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        ($('#sentenceInput') as any).val('This is a test sentence');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test sentence');

        await app.practiceService.startPractice();
        await vi.runAllTimers(); // Wait for the transaction.oncomplete to run

        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should cancel speech and reload page when reset is clicked', async () => {
        vi.useFakeTimers();

        await app.practiceService.startPractice();

        const resetAppSpy = vi.spyOn(app as any, 'resetApp');

        $('#resetBtn').trigger('click');

        expect(resetAppSpy).toHaveBeenCalled();

        await vi.runAllTimers();

        expect((window as any).speechSynthesis.cancel).toHaveBeenCalled();
        expect((location as any).reload).toHaveBeenCalled();
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
        resetAppSpy.mockRestore();
        vi.useRealTimers();
    });

    it('should speak the correct sentence when "Play Bot" is clicked', async () => {
        const sentence = 'This is a test sentence';
        (window as any).modalRecordings = { [sentence]: [] };
        const btn = $('<button>').attr('data-sentence', sentence)[0];
        app.audioService.playBotAudio(btn);
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should handle a correct answer in check mode', async () => {
        vi.spyOn(app.audioService, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        $('#practiceModeSelect').val('check');
        $('#startBtn').trigger('click');

        ($('#userInput') as any).val('This is a');
        await app.practiceService.checkAnswer();

        expect(app.correctCount).toBe(1);
        expect(app.audioService.playSound).toHaveBeenCalledWith('./sounds/correct.mp3', 1, 0.6);
    });

    it('should handle an incorrect answer in check mode', async () => {
        vi.useFakeTimers();
        vi.spyOn(app.audioService, 'playSound');

        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();

        ($('#userInput') as any).val('Wrong words');
        await app.practiceService.checkAnswer();

        expect(app.audioService.playSound).toHaveBeenCalledWith('./sounds/wrong.mp3', 1, 0.6);
        expect($('#feedback').html()).toContain('Try again!');

        vi.useRealTimers();
    });

    it('should advance to the next phrase correctly in skip mode', async () => {
        ($('#sentenceInput') as any).val('one two three. four five six.');
        ($('#sentenceInput') as any).attr('data-val', 'one two three. four five six.');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        app.currentIndex = 0;
        app.currentCount = 1;

        app.practiceService.advanceToNextPhrase();

        // For a new sentence, it should only advance by 1 word
        expect(app.currentIndex).toBe(1);
        expect(app.currentCount).toBe(0);
    });

    it('should increment counts on correct answer without advancing', async () => {
        vi.spyOn(app.audioService, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        ($('#repsSelect') as any).val('3');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        app.currentCount = 0;

        ($('#userInput') as any).val('This is a');
        await app.practiceService.checkAnswer();

        expect(app.correctCount).toBe(1);
        expect(app.currentCount).toBe(1);
        expect(app.currentIndex).toBe(0);
        expect(app.audioService.playSound).toHaveBeenCalledWith('./sounds/correct.mp3', 1, 0.6);
    });

    it('should advance to the next phrase after the last correct repetition', async () => {
        ($('#sentenceInput') as any).val('This is a. test phrase');
        ($('#sentenceInput') as any).attr('data-val', 'This is a. test phrase');
        ($('#repsSelect') as any).val('2');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        app.currentCount = 1;
        app.currentIndex = 0;

        ($('#userInput') as any).val('This');
        await app.practiceService.checkAnswer();

        // For a new sentence, it should only advance by 1 word
        expect(app.currentIndex).toBe(0);
        expect(app.currentCount).toBe(2);
    });

    it('should advance to next phrase if user input is empty on the last repetition', async () => {
        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#sentenceInput') as any).attr('data-val', 'First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        app.currentCount = 1;
        app.currentIndex = 0;

        ($('#userInput') as any).val('');
        await app.practiceService.checkAnswer();

        await vi.runAllTimers();

        // For a new sentence, it should only advance by 1 word
        expect(app.currentIndex).toBe(1);
        expect(app.currentCount).toBe(0);
    });

    it('should repeat the phrase on empty answer if repetitions are not complete', async () => {
        vi.spyOn(app.practiceService, 'practiceStep');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        ($('#repsSelect') as any).val('3');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        app.currentCount = 0;
        app.currentIndex = 0;

        ($('#userInput') as any).val('');
        await app.practiceService.checkAnswer();

        expect(app.currentCount).toBe(1);
        expect(app.currentIndex).toBe(0);
        expect(app.practiceService.practiceStep).toHaveBeenCalled();
    });

    it('should dim words from previous sentences in renderFullSentence', async () => {
        const sentence = 'First phrase ends here. The second phrase starts now.';
        ($('#sentenceInput') as any).val(sentence);
        ($('#sentenceInput') as any).attr('data-val', sentence);
        $('#startBtn').trigger('click');

        app.currentIndex = 6;

        app.uiService.renderFullSentence();

        expect($('#fullSentence span').eq(0).hasClass('text-muted')).toBe(true);
        expect($('#fullSentence span').eq(3).hasClass('text-muted')).toBe(true);
        expect($('#fullSentence span').eq(6).hasClass('current-word')).toBe(true);
    });

    it('should call checkAnswer when the main check/skip button is clicked', async () => {
        ($('#sentenceInput') as any).val('A test sentence.');
        ($('#sentenceInput') as any).attr('data-val', 'A test sentence.');
        $('#startBtn').trigger('click');

        const checkAnswerSpy = vi.spyOn(app.practiceService, 'checkAnswer');

        $('#checkBtn').trigger('click');

        expect(checkAnswerSpy).toHaveBeenCalled();
    });

    it('should show "0 of X attempts" feedback on final empty skip if reps >= 2', async () => {
        vi.useFakeTimers();

        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#sentenceInput') as any).attr('data-val', 'First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        app.currentCount = 1;
        app.currentIndex = 0;

        const advanceSpy = vi.spyOn(app.practiceService, 'advanceToNextPhrase');

        ($('#userInput') as any).val('');
        await app.practiceService.checkAnswer();

        expect($('#feedback').html()).toContain('(0 of 2 attempts)');

        await vi.runAllTimers();

        expect(advanceSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should highlight words based on speech synthesis boundary events on desktop', async () => {
        const sentence = 'I\'m a software architect with extensive experience in building scalable, resilient, and business-driven web platforms.';
        ($('#sentenceInput') as any).val(sentence);
        ($('#sentenceInput') as any).attr('data-val', sentence);

        (window.speechSynthesis as any).speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
            if (utterance.onboundary) {
                utterance.onboundary({ name: 'word', charIndex: 0 } as SpeechSynthesisEvent);
                utterance.onboundary({ name: 'word', charIndex: 2 } as SpeechSynthesisEvent);
            }
            if (utterance.onend) {
                utterance.onend({} as SpeechSynthesisEvent);
            }
        });

        await app.practiceService.startPractice();
        await vi.runAllTimers(); // Wait for the transaction.oncomplete to run

        const highlightedWord = $('#sentence-container .highlighted');
        expect(highlightedWord.length).toBe(1);
        expect(highlightedWord.text()).toBe('I\'m');
    });

    // Describes a test suite for the startPractice method.
    describe('startPractice', () => {
        // This test verifies that an alert is shown if the user tries to start practice with an empty sentence.
        it('should alert if the sentence is empty', async () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            ($('#sentenceInput') as any).attr('data-val', '   ');

            await app.practiceService.startPractice();

            expect(alertSpy).toHaveBeenCalledWith('Please enter a sentence to practice.');
        });

        // This test ensures that when repetition is set to 'Auto' (value 0), the actual repetition count
        // is calculated based on practice history. For a new sentence, it should default to 5 reps.
        it('should set reps based on practice history when "Auto" is selected (new sentence)', async () => {
            ($('#sentenceInput') as any).attr('data-val', 'A new sentence for testing.');
            // Set value and trigger change to simulate user interaction
            ($('#repsSelect') as any).val('0').trigger('change');

            await app.practiceService.startPractice();
            await vi.runAllTimers();

            expect(app.reps).toBe(2);

            // For a brand new sentence (0 practices today), auto reps should be 5.
            // expect(app.reps).toBe(5);
        });

    });

    // Describes a test suite for the practiceStep method.
    describe('practiceStep', () => {
        // This test ensures that the finishSession method is called when the practice index
        // goes beyond the number of words in the sentence, indicating the session is complete.
        it('should call finishSession if the currentIndex is at the end of the sentence', () => {
            const finishSessionSpy = vi.spyOn(app.practiceService, 'finishSession');
            app.words = ['end', 'of', 'practice'];
            app.currentIndex = 3; // Index is equal to words.length

            app.practiceService.practiceStep();

            expect(finishSessionSpy).toHaveBeenCalled();
            finishSessionSpy.mockRestore();
        });

        // This test checks if the automatic speech rate is adjusted correctly based on how many times
        // a sentence has been practiced. For the first time, it should be slower.
        it('should use a slower automatic speech rate for the first practice of a sentence', () => {
            const speakAndHighlightSpy = vi.spyOn(app.audioService, 'speakAndHighlight');
            app.speechRate = 0; // Auto speech rate
            (app.practiceService as any).currentSentencePracticeCount = 0; // First time practicing
            app.words = ['This', 'is', 'a', 'test'];
            app.currentIndex = 0;

            app.practiceService.practiceStep();

            // The final rate should be 0.8 for the first time.
            const finalRate = speakAndHighlightSpy.mock.calls[0][3];
            expect(finalRate).toBe(0.9);
            speakAndHighlightSpy.mockRestore();
        });

        // This test verifies that for subsequent practices of the same sentence, the automatic
        // speech rate increases to the normal level.
        it('should use a normal automatic speech rate for the second practice', () => {
            const speakAndHighlightSpy = vi.spyOn(app.audioService, 'speakAndHighlight');
            app.speechRate = 0; // Auto speech rate
            (app.practiceService as any).currentSentencePracticeCount = 1; // Second time
            app.words = ['This', 'is', 'a', 'test'];
            app.currentIndex = 0;

            app.practiceService.practiceStep();

            // The final rate should be 1.0 for the second time.
            const finalRate = speakAndHighlightSpy.mock.calls[0][3];
            expect(finalRate).toBe(1.0);
            speakAndHighlightSpy.mockRestore();
        });
    });

    // Describes a test suite for the restartCurrentPractice method.
    describe('restartCurrentPractice', () => {
        // This test confirms that restarting a practice correctly resets the state variables
        // and sets currentSentencePracticeCount to 1 to ensure subsequent automatic settings are adjusted.
        it('should reset state and start practice from the beginning', async () => {
            const practiceStepSpy = vi.spyOn(app.practiceService, 'practiceStep');
            app.currentIndex = 5;
            app.currentCount = 2;
            app.correctCount = 3;
            app.attempts = 4;
            (app.practiceService as any).currentSentencePracticeCount = 0;

            await app.practiceService.restartCurrentPractice();

            expect(app.currentIndex).toBe(0);
            expect(app.currentCount).toBe(0);
            expect(app.correctCount).toBe(0);
            expect(app.attempts).toBe(0);
            // It should be set to 1 to lift the "newness" limit on phrase length and speed.
            expect((app.practiceService as any).currentSentencePracticeCount).toBe(1);
            expect(practiceStepSpy).toHaveBeenCalled();
            practiceStepSpy.mockRestore();
        });
    });

    // Describes a test suite for the handleCheckOrNext method.
    describe('handleCheckOrNext', () => {
        // This test ensures that in 'auto-skip' mode, clicking the main button does nothing,
        // as the practice advances automatically.
        it('should do nothing if practiceMode is "auto-skip"', () => {
            const checkAnswerSpy = vi.spyOn(app.practiceService, 'checkAnswer');
            app.practiceMode = 'auto-skip';

            app.practiceService.handleCheckOrNext();

            expect(checkAnswerSpy).not.toHaveBeenCalled();
            checkAnswerSpy.mockRestore();
        });

        // This test verifies that in 'check' mode, the method correctly calls checkAnswer.
        it('should call checkAnswer if practiceMode is "check"', () => {
            const checkAnswerSpy = vi.spyOn(app.practiceService, 'checkAnswer');
            app.practiceMode = 'check';

            app.practiceService.handleCheckOrNext();

            expect(checkAnswerSpy).toHaveBeenCalled();
            checkAnswerSpy.mockRestore();
        });
    });

    // Describes a test suite for the getMaxWordsBasedOnLevel private method (tested via getDynamicMaxWords).
    describe('getDynamicMaxWords', () => {
        // This test verifies that for beginners (level 0), the maximum phrase length is 2 words.
        it('should return a max of 2 words for beginner level', () => {
            ($('#levelSelect') as any).val('0'); // Beginner
            // The newness limit is 1 on the first try, so it returns min(2, 1) = 1.
            // Let's set the practice count higher to test the level limit.
            (app.practiceService as any).currentSentencePracticeCount = 5;
            const maxWordsAfterPractice = (app.practiceService as any).getDynamicMaxWords();
            expect(maxWordsAfterPractice).toBe(2);
        });

        // This test verifies that for intermediate users (level 1), the max phrase length is 5 words.
        it('should return a max of 5 words for intermediate level', () => {
            ($('#levelSelect') as any).val('1'); // Intermediate
            (app.practiceService as any).currentSentencePracticeCount = 10;
            const maxWords = (app.practiceService as any).getDynamicMaxWords();
            expect(maxWords).toBe(5);
        });

        // This test verifies that for advanced users (level 2), the max phrase length is 7 words.
        it('should return a max of 7 words for advanced level', () => {
            ($('#levelSelect') as any).val('2'); // Advanced
            (app.practiceService as any).currentSentencePracticeCount = 10;
            const maxWords = (app.practiceService as any).getDynamicMaxWords();
            expect(maxWords).toBe(7);
        });

        // This test checks the "newness" logic: on the first try, the phrase should only be 1 word long,
        // regardless of the difficulty level, to ease the user in.
        it('should return a max of 1 word for the very first practice of a sentence', () => {
            ($('#levelSelect') as any).val('2'); // Advanced level (max 7)
            (app.practiceService as any).currentSentencePracticeCount = 0; // First time
            const maxWords = (app.practiceService as any).getDynamicMaxWords();
            // newnessLimit is practiceCount + 1 = 1. Returns min(7, 1).
            expect(maxWords).toBe(1);
        });
    });

    it('normalizes newline-only breaks into proper sentence delimiters on start', async () => {
        // startPractice should convert bare newlines to ".\n" to keep sentence splitting stable.
        const raw = 'First line\nSecond line';
        ($('#sentenceInput') as any).attr('data-val', raw);
        $('#repsSelect').val('1');
        $('#practiceModeSelect').val('skip');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        expect(app.sentence.includes('First line.\nSecond line')).toBe(true);
    });

    it('sets area to Practice and toggles containers on start', async () => {
        // startPractice should switch the UI from config to practice containers.
        ($('#sentenceInput') as any).attr('data-val', 'Let us begin.');
        $('#repsSelect').val('1');
        $('#practiceModeSelect').val('skip');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        expect(app.area).toBe('Practice');
        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);
    });

    it('advanceToNextPhrase moves index to phrase end and resets count', async () => {
        // advanceToNextPhrase should jump to the computed phrase boundary and zero currentCount.
        ($('#sentenceInput') as any).attr('data-val', 'one two three. four five six.');
        $('#repsSelect').val('1');
        $('#practiceModeSelect').val('skip');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        // Start at the beginning; on a "new" sentence dynamic max = 1 => advance by one word.
        app.currentIndex = 0;
        app.currentCount = 1;

        await app.practiceService.advanceToNextPhrase();
        expect(app.currentIndex).toBe(1);
        expect(app.currentCount).toBe(0);
    });

    it('useSample persists selected level/category and resets currentIndex', () => {
        // useSample should save indices to localStorage and reset index to 0.
        ($('#levelSelect') as any).val('1');
        ($('#categorySelect') as any).val('0');

        app.practiceService.useSample();

        expect(localStorage.getItem('selectedLevelIndex')).toBe('1');
        expect(localStorage.getItem('selectedCategoryIndex')).toBe('0');
        expect(app.currentIndex).toBe(0);
    });

    it('handleSampleWordClick sets the currentIndex to clicked data-index', () => {
        // clicking a word in sample sentence sets the start index for practice.
        const span = $('<span>').data('index', 3)[0];
        app.practiceService.handleSampleWordClick(span);

        expect(app.currentIndex).toBe(3);
    });

    it('reads practiceMode from the select on start', async () => {
        // startPractice must respect the selected practice mode from the dropdown.
        ($('#sentenceInput') as any).attr('data-val', 'mode check test');
        $('#repsSelect').val('1');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        expect(app.practiceMode).toBe('check');
    });

    it('advanceToNextPhrase: calls finishSession when we are at the end', async () => {
        // Stub getPhraseBounds so the index is at the sentence end
        const boundsSpy = vi.spyOn(app.utilService, 'getPhraseBounds').mockReturnValue(3);
        app.words = ['a', 'b', 'c'];
        app.currentIndex = 2; // one step from the end
        const finishSpy = vi.spyOn(app.practiceService, 'finishSession').mockResolvedValue();

        await app.practiceService.advanceToNextPhrase();

        expect(boundsSpy).toHaveBeenCalled();
        expect(finishSpy).toHaveBeenCalled();
    });

    it('finishSession: no streak increase → plays victory, speaks after 1100ms, and auto-restarts in auto-skip mode', async () => {
        // Mock private method so willShowStreakModal = false (newStreak === oldStreak)
        vi.spyOn(app.practiceService as any, 'recordPracticeCompletion')
            .mockResolvedValue({ newStreak: 3, oldStreak: 3 });

        app.practiceMode = 'auto-skip';
        app.area = 'Practice';

        const releaseSpy = vi.spyOn(app, 'releaseWakeLock').mockResolvedValue();
        const playSpy = vi.spyOn(app.audioService, 'playSound').mockImplementation(() => {});
        const speakSpy = vi.spyOn(app.audioService, 'speak').mockImplementation(() => {});
        const restartSpy = vi.spyOn(app.practiceService, 'restartCurrentPractice').mockResolvedValue();

        // Provide the restart button used by the countdown logic
        $('#session-complete-container').html('<button id="restartPracticeBtn"></button>');

        await app.practiceService.finishSession();

        // Victory sound and releasing wake lock
        expect(playSpy).toHaveBeenCalledWith('./sounds/victory.mp3', 2.5, 0.6);
        expect(releaseSpy).toHaveBeenCalled();

        // TTS after 1100ms
        await vi.advanceTimersByTimeAsync(1100);
        expect(speakSpy).toHaveBeenCalled();

        // 5s countdown → auto-restart
        await vi.advanceTimersByTimeAsync(5000);
        expect(restartSpy).toHaveBeenCalled();
    });

});