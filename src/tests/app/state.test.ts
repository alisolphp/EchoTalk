import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('State Management and Event Handlers', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        vi.useFakeTimers();
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

        const mockDbStore: { [key: string]: any } = {};
        const mockDbObject = {
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
                        add: vi.fn((data: any) => {
                            mockDbStore[data.sentence] = data;
                        }),
                        clear: vi.fn().mockImplementation(function () {
                            const request: { onsuccess?: () => void } = {};
                            setTimeout(() => {
                                if (request.onsuccess) {
                                    request.onsuccess();
                                }
                            }, 0);
                            return request;
                        })
                    }),
                    oncomplete: null as (() => void) | null
                };
                setTimeout(() => {
                    if (transaction.oncomplete) transaction.oncomplete();
                }, 0);
                return transaction;
            })
        };
        vi.spyOn(app.dataService, 'initDB').mockResolvedValue(mockDbObject as any);

        await app.init();
        await vi.runAllTimers();
    });

    it('should correctly load a sample sentence and reset state', async () => {
        ($('#sentenceInput') as any).val('An old sentence');
        ($('#sentenceInput') as any).attr('data-val', 'An old sentence');
        app.currentIndex = 5;

        app.practiceService.useSample();
        const newSentence = app.sentence;

        const expectedSentences = [
            "I'm a software architect with extensive experience in building scalable, resilient, and business-driven web platforms."
        ];
        expect(expectedSentences).toContain(newSentence);

        expect(app.currentIndex).toBe(0);
        expect(localStorage.getItem('shadow_sentence')).toBe(newSentence);
    });

    it('should update currentIndex when a word in the sample sentence is clicked', () => {
        const wordElement = $('<span></span>').attr('data-index', 3)[0];

        app.practiceService.handleSampleWordClick(wordElement);

        expect(app.currentIndex).toBe(3);
        expect(localStorage.getItem('shadow_index')).toBe('3');
    });

    it('should toggle the isRecordingEnabled flag and update localStorage', () => {
        const checkbox = $('<input type="checkbox" />');

        checkbox.prop('checked', true);
        (app as any).handleRecordToggle(checkbox[0]);
        expect(app.isRecordingEnabled).toBe(true);
        expect(localStorage.getItem('shadow_record_audio')).toBe('true');

        checkbox.prop('checked', false);
        (app as any).handleRecordToggle(checkbox[0]);
        expect(app.isRecordingEnabled).toBe(false);
        expect(localStorage.getItem('shadow_record_audio')).toBe('false');
    });

    it('should clear localStorage on resetApp', async () => {
        vi.useFakeTimers();
        localStorage.setItem('shadow_sentence', 'A test sentence');
        const resetPromise = (app as any).resetApp();
        await vi.runAllTimers();
        await resetPromise;
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
        expect((location as any).reload).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should initialize practice state from UI values on start', async () => {
        const customSentence = 'I\'m a software architect with extensive experience in building scalable, resilient, and business-driven web platforms.';
        ($('#sentenceInput') as any).val(customSentence);
        ($('#sentenceInput') as any).attr('data-val', customSentence);
        ($('#repsSelect') as any).val('5');
        $('#practiceModeSelect').val('check');

        await app.practiceService.startPractice();
        await vi.runAllTimers();

        expect(app.sentence).toBe(customSentence);
        expect(app.reps).toBe(5);
        expect(app.practiceMode).toBe('check');
    });

    it('should not change currentIndex if a clicked word has no data-index', () => {
        app.currentIndex = 5;

        const wordElement = $('<span>A word</span>')[0];

        app.practiceService.handleSampleWordClick(wordElement);

        expect(app.currentIndex).toBe(5);
    });
});