import { EchoTalkApp } from '../../assets/js/app';

describe('Text Cleaning Utilities', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        app = new EchoTalkApp();
    });

    // Tests the cleanText method for basic transformations: lowercase and trimming space.
    it('should convert text to lowercase and trim whitespace', () => {
        const result = (app as any).cleanText('  Hello World  ');
        expect(result).toBe('hello world');
    });

    // Ensures that special characters and punctuation at the start and end of a string are removed.
    it('should remove leading and trailing junk characters', () => {
        const result = (app as any).removeJunkCharsFromText('.,!"Hello World"?-');
        expect(result).toBe('Hello World');
    });

    // Ensures that junk characters within the string are preserved.
    it('should not remove junk characters from the middle of the string', () => {
        const text = 'This is a test! - really';
        const result = (app as any).removeJunkCharsFromText(text);
        expect(result).toBe(text);
    });
});