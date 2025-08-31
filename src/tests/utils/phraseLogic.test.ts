import { EchoTalkApp } from '../../assets/js/app';

describe('Phrase Logic Utilities', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        app = new EchoTalkApp();
        // Manually set the words array for testing these utility functions
        (app as any).words = 'This is a simple sentence. And this is another one! Is it?'.split(' ');
        // Expected words: ["This", "is", "a", "simple", "sentence.", "And", "this", "is", "another", "one!", "Is", "it?"]
    });

    // --- Tests for getPhraseBounds ---

    // Verifies that the function correctly identifies a phrase at the start of the sentence.
    it('getPhraseBounds should return the end index for a phrase at the beginning', () => {
        const startIndex = 0; // Starting from "This"
        const maxWords = 3;
        const endIndex = (app as any).getPhraseBounds(startIndex, maxWords);
        // Expected phrase: "This is a" -> endIndex should be 3
        expect(endIndex).toBe(3);
    });

    // Verifies that the function stops at a punctuation mark even if maxWords is not reached.
    it('getPhraseBounds should stop at punctuation before reaching max words', () => {
        const startIndex = 2; // Starting from "a"
        const maxWords = 5;
        const endIndex = (app as any).getPhraseBounds(startIndex, maxWords);
        // Expected phrase: "a simple sentence." -> stops at index 5 because of the period
        expect(endIndex).toBe(5);
    });


    // --- Tests for getStartOfCurrentPhrase ---

    // Verifies that the start index is 0 when we are in the first phrase.
    it('getStartOfCurrentPhrase should return 0 for a phrase at the beginning', () => {
        (app as any).currentIndex = 3; // Current word is "simple"
        const startIndex = (app as any).getStartOfCurrentPhrase();
        // The phrase starts at the beginning of the sentence
        expect(startIndex).toBe(0);
    });

    // Verifies that the function correctly identifies the start of a new phrase
    // that begins after a punctuation mark.
    it('getStartOfCurrentPhrase should return the index after the last punctuation', () => {
        (app as any).currentIndex = 8; // Current word is "another"
        const startIndex = (app as any).getStartOfCurrentPhrase();
        // The last punctuation was at "sentence." (index 4). New phrase starts at index 5 ("And").
        expect(startIndex).toBe(5);
    });
});