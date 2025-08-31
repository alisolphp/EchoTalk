import { EchoTalkApp } from '../../assets/js/app';

describe('calculateWordSimilarity', () => {
    const app = new EchoTalkApp();

    it('should return 1 for identical strings', () => {
        expect(app.calculateWordSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('should return 0.5 for half-matching strings', () => {
        const similarity = app.calculateWordSimilarity(
            'one two three four',
            'one two five six'
        );
        expect(similarity).toBe(0.5);
    });

    it('should return 0 for completely different strings', () => {
        const similarity = app.calculateWordSimilarity('apple orange', 'banana kiwi');
        expect(similarity).toBe(0);
    });
});
