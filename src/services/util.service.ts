import $ from 'jquery';
import { EchoTalkApp } from '../app';

/**
 * A service that provides a collection of general-purpose utility functions
 * used throughout the application.
 */
export class UtilService {
    private app: EchoTalkApp;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /**
     * Clears the timer used in 'auto-skip' mode and resets the progress animation on the button.
     */
    public clearAutoSkipTimer(): void {
        if (this.app.autoSkipTimer) {
            clearTimeout(this.app.autoSkipTimer);
            this.app.autoSkipTimer = null;
        }
        if (this.app.autoRestartTimer) {
            clearTimeout(this.app.autoRestartTimer);
            this.app.autoRestartTimer = null;
        }

        const $checkBtn = $('#checkBtn');
        if ($checkBtn.hasClass('auto-skip-progress')) {
            $checkBtn.removeClass('loading');
            $checkBtn.css('animation-duration', '');
        }

        const $restartBtn = $('#restartPracticeBtn');
        if ($restartBtn.length) {
            $restartBtn.removeClass('loading');
            $restartBtn.css('animation-duration', '');
        }
    }


    /**
     * Finds the starting index of the current phrase by looking backwards from the
     * current word index for the last punctuation mark.
     * @returns The starting index of the phrase.
     */
    public getStartOfCurrentPhrase(): number {
        let lastPuncIndex = -1;
        for (let i = this.app.currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(this.app.words[i].slice(-1))) {
                lastPuncIndex = i;
                break;
            }
        }
        return lastPuncIndex >= 0 ? lastPuncIndex + 1 : 0;
    }

    /**
     * Calculates the end index for a practice phrase, starting from a given index.
     * The phrase ends after `maxWords` or at the next punctuation mark.
     * @param startIndex The index from which to start calculating the phrase.
     * @param maxWords The maximum number of words the phrase can contain.
     * @returns The calculated end index for the phrase.
     */
    public getPhraseBounds(startIndex: number, maxWords: number): number {
        let endIndex = startIndex;
        let count = 0;
        while (endIndex < this.app.words.length && count < maxWords) {
            endIndex++;
            count++;
            if (/[.!?]/.test(this.app.words[endIndex - 1].slice(-1))) {
                break;
            }
        }

        const phraseLength = endIndex - startIndex;
        if (endIndex < this.app.words.length && phraseLength > 3) {
            const lastWordInPhrase = this.app.words[endIndex - 1].toLowerCase().replace(/\\[.,!?;:\"\\]+$/, '');
            if (this.app.STOP_WORDS.includes(lastWordInPhrase)) {
                endIndex--;
            }
        }
        return endIndex;
    }

    /**
     * Picks a random sample sentence from the loaded data based on the
     * user's selected level and category preferences.
     * @returns A random sentence string.
     */
    public pickSample(): string {
        const savedLevelIndex = parseInt(localStorage.getItem('selectedLevelIndex') || '0');
        const savedCategoryIndex = parseInt(localStorage.getItem('selectedCategoryIndex') || '0');

        const levels = this.app.samples.levels;
        if (levels.length === 0) return '';

        const level = levels[savedLevelIndex];
        if (!level) return '';

        const categories = level.categories;
        if (categories.length === 0) return '';

        const category = categories[savedCategoryIndex];
        if (!category) return '';

        const sentences = category.sentences;
        if (sentences.length === 0) return '';
        return sentences[Math.floor(Math.random() * sentences.length)];
    }

    /**
     * Cleans a string for comparison by converting it to lowercase, trimming whitespace,
     * and removing punctuation.
     * @param text The string to clean.
     * @returns The cleaned string.
     */
    public cleanText(text: string): string {
        return this.removeJunkCharsFromText(text.toLowerCase().trim().replace("&", "and"));
    }

    /**
     * Removes leading and trailing punctuation and whitespace from a string.
     * @param text The string to process.
     * @returns The processed string.
     */
    public removeJunkCharsFromText(text: string): string {
        return text.replace(/^[\s.,;:/\\()[\]{}"'«»!?-]+|[\s.,;:/\\()[\]{}"'«»!?-]+$/g, '');
    }

    /**
     * Calculates a simple similarity score between two strings by comparing them word by word.
     * @param targetStr The correct string.
     * @param answerStr The user's input string.
     * @returns A similarity score between 0 and 1.
     */
    public calculateWordSimilarity(targetStr: string, answerStr: string): number {
        const targetWords = targetStr.split(/\s+/).filter(Boolean);
        const answerWords = answerStr.split(/\s+/).filter(Boolean);
        if (targetWords.length === 0) return answerWords.length === 0 ? 1 : 0;
        let correctWords = 0;
        const minLength = Math.min(targetWords.length, answerWords.length);
        for (let i = 0; i < minLength; i++) {
            if (targetWords[i] === answerWords[i]) correctWords++;
        }
        return correctWords / targetWords.length;
    }

    /**
     * Truncates a long sentence for display purposes.
     * @param sentence The sentence to truncate.
     * @returns The truncated sentence.
     */
    public truncateSentence(sentence: string): string {
        const words = sentence.split(' ');
        if (words.length > 4) {
            return `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`;
        }
        return sentence;
    }

    /**
     * Copies a given text string to the user's clipboard.
     * It uses the modern `navigator.clipboard` API with a fallback to the legacy
     * `document.execCommand('copy')` for older browsers.
     * @param textToCopy The text to be copied.
     * @returns A promise that resolves to `true` on success and `false` on failure.
     */
    public async copyTextToClipboard(textToCopy: string): Promise<boolean> {
        try {
            await navigator.clipboard.writeText(textToCopy);
            return true;
        } catch (err) {
            console.warn('Modern clipboard API failed. Falling back to legacy method.', err);
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            textArea.style.top = "-9999px";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (legacyErr) {
                console.error('Fallback copy method failed:', legacyErr);
                document.body.removeChild(textArea);
                return false;
            }
        }
    }
}