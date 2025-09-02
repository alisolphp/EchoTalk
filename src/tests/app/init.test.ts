import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

describe('Initialization', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
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

        // Mock the initDB method to prevent actual IndexedDB access during tests.
        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: vi.fn(),
                    add: vi.fn()
                })
            }))
        };
        vi.spyOn(app as any, 'initDB').mockResolvedValue(mockDbObject);

        await app.init();
    });

    it('should initialize correctly and fetch sample sentences', async () => {
        // The value is no longer in the input, it's held in the app state and rendered in #sampleSentence
        const currentSentence = (app as any).sentence;

        // Verifies that one of the mocked DEFAULT sample sentences is loaded into the app state.
        // The default is now Intermediate > Interview
        const expectedSentences = [
            "I'm a software architect with extensive experience in building scalable, resilient, and business-driven web platforms."
        ];
        expect(expectedSentences).toContain(currentSentence);

        // Check that repetition options are dynamically populated in the UI.
        expect($('#repsSelect option').length).toBeGreaterThan(0);
    });

    it('should load state from localStorage if available', async () => {
        // Preload localStorage with mock values to simulate a previously saved user session.
        localStorage.setItem('shadow_sentence', 'Stored sentence');
        localStorage.setItem('shadow_reps', '5');
        localStorage.setItem('shadow_record_audio', 'true');

        // Re-instantiate the app to trigger its state loading logic from localStorage.
        app = new EchoTalkApp();
        await app.init();

        // Verify that UI elements reflect the loaded state.
        expect((app as any).sentence).toBe('Stored sentence');
        expect($('#repsSelect').val()).toBe('5');
        expect($('#recordToggle').prop('checked')).toBe(true);
    });

    it('should save state to localStorage when starting practice', async () => {
        // Simulate user interaction by setting values in the UI.
        ($('#sentenceInput') as any).val('New test sentence');
        ($('#sentenceInput') as any).attr('data-val', 'New test sentence');
        ($('#repsSelect') as any).val('3');

        // Trigger the 'start' button click, which should internally call the save state logic.
        await (app as any).startPractice();

        // Verify that the new state is persisted in localStorage.
        expect(localStorage.getItem('shadow_sentence')).toBe('New test sentence');
        expect(localStorage.getItem('shadow_reps')).toBe('3');
    });

    it('should handle failure in fetching sample sentences gracefully', async () => {
        // Simulate a network failure by configuring $.getJSON to return a rejected promise.
        ($.getJSON as any).mockImplementationOnce(() => Promise.reject('Network error'));

        app = new EchoTalkApp();
        // Expect the initialization process to complete without throwing an unhandled error.
        await expect(app.init()).resolves.not.toThrow();

        // Verify that an alert message is displayed in the configuration area indicating the failure.
        expect($('#configArea .alert').length).toBeGreaterThan(0);
    });
});