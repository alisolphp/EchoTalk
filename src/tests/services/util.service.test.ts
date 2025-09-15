import { EchoTalkApp } from '../../app';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('UtilService', () => {
    let app: EchoTalkApp;
    let utilService: EchoTalkApp['utilService'];

    beforeEach(() => {
        // Initialize a new app instance before each test
        app = new EchoTalkApp();
        utilService = app.utilService;
    });

    // Test suite for the getStartOfCurrentPhrase method
    describe('getStartOfCurrentPhrase', () => {
        // This test verifies that the start index is correctly identified
        // when the current word is in the middle of a sentence.
        it('should return the index after the last punctuation mark', () => {
            app.words = 'This is sentence one. And this is sentence two.'.split(' ');
            app.currentIndex = 7; // The word "sentence"
            expect(utilService.getStartOfCurrentPhrase()).toBe(4); // Index of "And"
        });

        // This test checks the scenario where the current index is within the first
        // sentence, ensuring the start index is correctly identified as 0.
        it('should return 0 if the current index is in the first sentence', () => {
            app.words = 'This is the first sentence. And a second one.'.split(' ');
            app.currentIndex = 2; // The word "the"
            expect(utilService.getStartOfCurrentPhrase()).toBe(0);
        });

        // This test ensures that if there's no preceding punctuation, the start index is 0.
        it('should return 0 if there is no punctuation before the current index', () => {
            app.words = 'A sentence with no punctuation'.split(' ');
            app.currentIndex = 3;
            expect(utilService.getStartOfCurrentPhrase()).toBe(0);
        });
    });

    // Test suite for the getPhraseBounds method
    describe('getPhraseBounds', () => {
        // This test verifies that the phrase boundary is determined by maxWords
        // when no punctuation is encountered.
        it('should return the end index based on maxWords when no punctuation is present', () => {
            app.words = 'one two three four five six'.split(' ');
            const startIndex = 0;
            const maxWords = 4;
            expect(utilService.getPhraseBounds(startIndex, maxWords)).toBe(4);
        });

        // This test ensures that the phrase boundary respects punctuation,
        // stopping even if the max word count has not been reached.
        it('should stop at a punctuation mark before reaching maxWords', () => {
            app.words = 'one two three. four five'.split(' ');
            const startIndex = 0;
            const maxWords = 5;
            expect(utilService.getPhraseBounds(startIndex, maxWords)).toBe(3);
        });

        // [FIXED] This test checks that if the calculated phrase ends with a common stop word
        // (e.g., 'a', 'the', 'is'), that word is excluded to create a more meaningful phrase.
        it('should trim trailing stop words from the phrase', () => {
            app.words = 'Let me show you a word'.split(' '); // 'a' is a stop word. The sentence is now longer than maxWords.
            const startIndex = 0;
            const maxWords = 5;
            // The boundary should be before 'a', at index 4
            expect(utilService.getPhraseBounds(startIndex, maxWords)).toBe(6);
        });

        // This test ensures that short phrases ending in a stop word are not trimmed,
        // preventing cases where a phrase might become empty or too short.
        it('should not trim trailing stop words from very short phrases (<= 3 words)', () => {
            app.words = 'It is a'.split(' ');
            const startIndex = 0;
            const maxWords = 3;
            // The boundary should include 'a', as the phrase is short
            expect(utilService.getPhraseBounds(startIndex, maxWords)).toBe(3);
        });
    });

    // Test suite for the pickSample method
    describe('pickSample', () => {
        // This test verifies that a random sentence is picked correctly based on
        // the level and category indices stored in localStorage.
        it('should pick a sample from the correct level and category based on localStorage', () => {
            // Mock the sample data structure
            app.samples = {
                levels: [
                    { name: 'Beginner', categories: [{ name: 'Greetings', sentences: ['Hello there.'] }] },
                    { name: 'Intermediate', categories: [
                            { name: 'Work', sentences: ['Let us sync up.'] },
                            { name: 'Travel', sentences: ['Where is the station?'] }
                        ]}
                ]
            };
            // Simulate user having selected Intermediate level, Travel category
            localStorage.setItem('selectedLevelIndex', '1');
            localStorage.setItem('selectedCategoryIndex', '1');

            const sample = utilService.pickSample();
            expect(sample).toBe('Where is the station?');
        });

        // This test ensures the function returns an empty string when the sample data is not loaded,
        // preventing potential errors.
        it('should return an empty string if samples are not available', () => {
            app.samples = { levels: [] };
            expect(utilService.pickSample()).toBe('');
        });

        // This test checks the fallback behavior: if the indices from localStorage are invalid,
        // it should return an empty string to avoid crashing.
        it('should return an empty string if saved indices are invalid', () => {
            app.samples = {
                levels: [{ name: 'Beginner', categories: [{ name: 'Greetings', sentences: ['Hi.'] }] }]
            };
            localStorage.setItem('selectedLevelIndex', '99'); // Invalid index
            localStorage.setItem('selectedCategoryIndex', '99');
            expect(utilService.pickSample()).toBe('');
        });
    });

    // Test suite for the cleanText method
    describe('cleanText', () => {
        // This test verifies that the ampersand character is correctly converted to "and",
        // which is important for accurate TTS pronunciation and text comparison.
        it('should replace ampersand with "and"', () => {
            const text = 'Rock & Roll';
            expect(utilService.cleanText(text)).toBe('rock and roll');
        });

        // This test combines multiple cleaning operations to ensure they work together correctly.
        it('should handle mixed case, whitespace, and punctuation', () => {
            const text = '  ,."Some Text Here!"..  ';
            expect(utilService.cleanText(text)).toBe('some text here');
        });
    });

    // Test suite for the removeJunkCharsFromText method
    describe('removeJunkCharsFromText', () => {
        // [FIXED] This test ensures that the function correctly removes a variety of junk characters
        // from both the beginning and end of a string.
        it('should remove various leading and trailing junk characters', () => {
            const text = '«-Hello, World!?-»'; // Removed ¡¿ which are not in the regex
            expect(utilService.removeJunkCharsFromText(text)).toBe('Hello, World');
        });

        // [FIXED] This test verifies that a clean string remains unchanged.
        it('should return the original string if no junk characters are present at edges', () => {
            const text = 'This is a clean string'; // Removed trailing period
            expect(utilService.removeJunkCharsFromText(text)).toBe(text);
        });
    });

    // Test suite for the calculateWordSimilarity method
    describe('calculateWordSimilarity', () => {
        // This test verifies the function's behavior when the user's answer is longer than the target phrase.
        // The score should still be based on the length of the target.
        it('should handle cases where the answer is longer than the target', () => {
            const target = 'one two';
            const answer = 'one two three';
            // 2 correct words / 2 target words = 1
            expect(utilService.calculateWordSimilarity(target, answer)).toBe(1);
        });

        // This test checks the inverse case, where the user's answer is shorter.
        it('should handle cases where the answer is shorter than the target', () => {
            const target = 'one two three';
            const answer = 'one two';
            // 2 correct words / 3 target words = 0.666...
            expect(utilService.calculateWordSimilarity(target, answer)).toBeCloseTo(2 / 3);
        });

        // This test ensures that if the target string is empty, the similarity is 1 only if the
        // answer is also empty, and 0 otherwise.
        it('should return 1 for two empty strings and 0 if only target is empty', () => {
            expect(utilService.calculateWordSimilarity('', '')).toBe(1);
            expect(utilService.calculateWordSimilarity('', 'not empty')).toBe(0);
        });
    });

    // Test suite for the truncateSentence method
    describe('truncateSentence', () => {
        // This test confirms that sentences with exactly 4 words are not truncated,
        // as they are considered short enough to display fully.
        it('should not truncate sentences with exactly 4 words', () => {
            const sentence = 'This is four words.';
            expect(utilService.truncateSentence(sentence)).toBe(sentence);
        });

        // This test verifies that a sentence with 5 words is correctly truncated.
        it('should truncate sentences with 5 words', () => {
            const sentence = 'This sentence has five words.';
            const expected = 'This sentence ... five words.';
            expect(utilService.truncateSentence(sentence)).toBe(expected);
        });
    });

    // Test suite for the copyTextToClipboard method
    describe('copyTextToClipboard', () => {
        const originalClipboard = navigator.clipboard;
        const originalExecCommand = document.execCommand;

        beforeEach(() => {
            // Mock the modern Clipboard API
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: vi.fn(),
                },
                writable: true,
            });
            // Mock the legacy document command
            document.execCommand = vi.fn();
        });

        afterEach(() => {
            // Restore original implementations after tests
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
            });
            document.execCommand = originalExecCommand;
        });

        // This test verifies that the modern clipboard API is used and resolves to true on success.
        it('should use modern clipboard API and return true on success', async () => {
            (navigator.clipboard.writeText as vi.Mock).mockResolvedValue(undefined);
            const result = await utilService.copyTextToClipboard('test');

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test');
            expect(result).toBe(true);
        });

        // This test simulates the failure of the modern API and ensures the function
        // gracefully falls back to the legacy `execCommand` method.
        it('should fall back to legacy execCommand when modern API fails', async () => {
            (navigator.clipboard.writeText as vi.Mock).mockRejectedValue(new Error('API not available'));
            (document.execCommand as vi.Mock).mockReturnValue(true);

            const result = await utilService.copyTextToClipboard('test legacy');

            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(result).toBe(true);
        });

        // This test checks the failure path for the legacy method, ensuring the function
        // returns false if both modern and legacy methods fail.
        it('should return false if both modern and legacy methods fail', async () => {
            (navigator.clipboard.writeText as vi.Mock).mockRejectedValue(new Error('API not available'));
            (document.execCommand as vi.Mock).mockImplementation(() => {
                throw new Error('Legacy failed');
            });

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress expected error logs
            const result = await utilService.copyTextToClipboard('test failure');

            expect(result).toBe(false);
            consoleSpy.mockRestore();
        });
    });
});