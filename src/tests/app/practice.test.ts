import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        vi.useRealTimers();
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

        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: vi.fn(),
                    add: vi.fn(),
                    clear: vi.fn().mockImplementation(function() {
                        const request: { onsuccess?: () => void } = {};
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
        vi.spyOn(app.dataService, 'initDB').mockResolvedValue(mockDbObject as any);

        await app.init();
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        ($('#sentenceInput') as any).val('This is a test sentence');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test sentence');
        await app.practiceService.startPractice();

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

    it('should finish session and show final message when finishSession is invoked', async () => {
        app.practiceService.finishSession();

        expect($('#practiceArea').find('h2').length).toBeGreaterThan(0);
        expect(localStorage.getItem('shadow_index')).toBeNull();
        expect(localStorage.getItem('shadow_count')).toBeNull();
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
        $('#startBtn').trigger('click');

        app.currentIndex = 0;
        app.currentCount = 1;

        app.practiceService.advanceToNextPhrase();

        expect(app.currentIndex).toBe(3);
        expect(app.currentCount).toBe(0);
    });

    it('should increment counts on correct answer without advancing', async () => {
        vi.spyOn(app.audioService, 'playSound');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        ($('#repsSelect') as any).val('3');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

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
        $('#startBtn').trigger('click');

        app.currentCount = 1;
        app.currentIndex = 0;

        ($('#userInput') as any).val('This is a');
        await app.practiceService.checkAnswer();

        expect(app.currentIndex).toBe(3);
        expect(app.currentCount).toBe(0);
    });

    it('should advance to next phrase if user input is empty on the last repetition', async () => {
        vi.useFakeTimers();

        ($('#sentenceInput') as any).val('First phrase. Second phrase.');
        ($('#sentenceInput') as any).attr('data-val', 'First phrase. Second phrase.');
        ($('#repsSelect') as any).val('2');
        $('#mode-check').prop('checked', true);

        await app.practiceService.startPractice();

        app.currentCount = 1;
        app.currentIndex = 0;

        ($('#userInput') as any).val('');
        await app.practiceService.checkAnswer();

        await vi.runAllTimers();

        expect(app.currentIndex).toBe(2);
        expect(app.currentCount).toBe(0);

        vi.useRealTimers();
    });

    it('should repeat the phrase on empty answer if repetitions are not complete', async () => {
        vi.spyOn(app.practiceService, 'practiceStep');
        ($('#sentenceInput') as any).val('This is a test');
        ($('#sentenceInput') as any).attr('data-val', 'This is a test');
        ($('#repsSelect') as any).val('3');
        $('#mode-check').prop('checked', true);
        $('#startBtn').trigger('click');

        app.currentCount = 0;
        app.currentIndex = 0;

        ($('#userInput') as any).val('');
        await app.practiceService.checkAnswer();

        expect(app.currentCount).toBe(1);
        expect(app.currentIndex).toBe(0);
        expect(app.practiceService.practiceStep).toHaveBeenCalled();
    });

    it('should display accuracy in the final message for check mode', async () => {
        $('#sentenceInput').val('This is a test sentence.');
        $('#practiceModeSelect').val('check');
        $('#startBtn').trigger('click');

        app.attempts = 10;
        app.correctCount = 7;

        app.practiceService.finishSession();

        const finalHtml = $('#practiceArea').html();
        expect(finalHtml).toContain('Your accuracy: 70%');
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
        const highlightedWord = $('#sentence-container .highlighted');
        expect(highlightedWord.length).toBe(1);
        expect(highlightedWord.text()).toBe('I\'m');
    });
});