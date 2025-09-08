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