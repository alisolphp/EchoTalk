import { EchoTalkApp } from '../../app';

describe('Text Cleaning Utilities', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        app = new EchoTalkApp();
    });

    it('should convert text to lowercase and trim whitespace', () => {
        const result = app.utilService.cleanText('  Hello World  ');
        expect(result).toBe('hello world');
    });

    it('should remove leading and trailing junk characters', () => {
        const result = app.utilService.removeJunkCharsFromText('.,!"Hello World"?-');
        expect(result).toBe('Hello World');
    });

    it('should not remove junk characters from the middle of the string', () => {
        const text = 'This is a test! - really';
        const result = app.utilService.removeJunkCharsFromText(text);
        expect(result).toBe(text);
    });
});