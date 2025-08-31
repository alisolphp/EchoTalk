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
});
