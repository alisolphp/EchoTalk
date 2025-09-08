import $ from 'jquery';
import { EchoTalkApp } from '../app';

export class UtilService {
    private app: EchoTalkApp;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    public clearAutoSkipTimer(): void {
        if (this.app.autoSkipTimer) {
            clearTimeout(this.app.autoSkipTimer);
            this.app.autoSkipTimer = null;
        }
        const $checkBtn = $('#checkBtn');
        if ($checkBtn.hasClass('auto-skip-progress')) {
            $checkBtn.removeClass('loading');
            $checkBtn.css('animation-duration', '');
        }
    }

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

    public cleanText(text: string): string {
        return this.removeJunkCharsFromText(text.toLowerCase().trim().replace("&", "and"));
    }

    public removeJunkCharsFromText(text: string): string {
        return text.replace(/^[\s.,;:/\\()[\]{}"'«»!?-]+|[\s.,;:/\\()[\]{}"'«»!?-]+$/g, '');
    }

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

    public truncateSentence(sentence: string): string {
        const words = sentence.split(' ');
        if (words.length > 4) {
            return `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`;
        }
        return sentence;
    }

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