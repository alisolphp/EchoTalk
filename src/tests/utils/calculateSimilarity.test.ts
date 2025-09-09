import { EchoTalkApp } from '../../app';

describe('calculateWordSimilarity', () => {
    const app = new EchoTalkApp();

    it('should return 1 for identical strings', () => {
        expect(app.utilService.calculateWordSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('should return 0.5 for half-matching strings', () => {
        const similarity = app.utilService.calculateWordSimilarity(
            'one two three four',
            'one two five six'
        );
        expect(similarity).toBe(0.5);
    });

    it('should return 0 for completely different strings', () => {
        const similarity = app.utilService.calculateWordSimilarity('apple orange', 'banana kiwi');
        expect(similarity).toBe(0);
    });

    it('should return correct similarity for partial matches', () => {
        const sim = app.utilService.calculateWordSimilarity('one two three', 'one two five');
        expect(sim).toBeCloseTo(2 / 3);
    });

    it('should return 0 when no words match', () => {
        const sim = app.utilService.calculateWordSimilarity('apple banana', 'carrot tomato');
        expect(sim).toBe(0);
    });
});