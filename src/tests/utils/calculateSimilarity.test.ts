import { EchoTalkApp } from '../../assets/js/app';

describe('calculateWordSimilarity', () => {
    const app = new EchoTalkApp();

    // Should return maximum similarity for identical strings
    it('should return 1 for identical strings', () => {
        expect(app.calculateWordSimilarity('hello world', 'hello world')).toBe(1);
    });

    // Should return partial similarity when half the words match
    // Helps validate token-level comparison logic
    it('should return 0.5 for half-matching strings', () => {
        const similarity = app.calculateWordSimilarity(
            'one two three four',
            'one two five six'
        );
        expect(similarity).toBe(0.5);
    });

    // Should return zero similarity when no words match
    // Confirms that unrelated inputs are handled correctly
    it('should return 0 for completely different strings', () => {
        const similarity = app.calculateWordSimilarity('apple orange', 'banana kiwi');
        expect(similarity).toBe(0);
    });

    // Validates similarity calculation for partial word matches
    it('should return correct similarity for partial matches', () => {
        const sim = app.calculateWordSimilarity('one two three', 'one two five');
        expect(sim).toBeCloseTo(2 / 3);
    });

    // Ensures similarity is zero when no words match
    it('should return 0 when no words match', () => {
        const sim = app.calculateWordSimilarity('apple banana', 'carrot tomato');
        expect(sim).toBe(0);
    });

});
