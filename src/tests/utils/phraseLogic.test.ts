import { EchoTalkApp } from '../../app';

describe('Phrase Logic Utilities', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        app = new EchoTalkApp();
        app.words = 'This is a simple sentence. And this is another one! Is it?'.split(' ');
    });

    it('getPhraseBounds should return the end index for a phrase at the beginning', () => {
        const startIndex = 0;
        const maxWords = 3;
        const endIndex = app.utilService.getPhraseBounds(startIndex, maxWords);
        expect(endIndex).toBe(4);
    });

    it('getPhraseBounds should stop at punctuation before reaching max words', () => {
        const startIndex = 2;
        const maxWords = 5;
        const endIndex = app.utilService.getPhraseBounds(startIndex, maxWords);
        expect(endIndex).toBe(5);
    });

    it('getStartOfCurrentPhrase should return 0 for a phrase at the beginning', () => {
        app.currentIndex = 3;
        const startIndex = app.utilService.getStartOfCurrentPhrase();
        expect(startIndex).toBe(0);
    });

    it('getStartOfCurrentPhrase should return the index after the last punctuation', () => {
        app.currentIndex = 8;
        const startIndex = app.utilService.getStartOfCurrentPhrase();
        expect(startIndex).toBe(5);
    });
});