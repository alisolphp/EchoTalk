import $ from 'jquery';
import { Modal } from 'bootstrap';
import confetti from 'canvas-confetti';
import { EchoTalkApp } from '../app';

/**
 * Manages all User Interface (UI) related operations, such as showing pages,
 * updating DOM elements, and handling modals.
 */
export class UiService {
    private app: EchoTalkApp;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /** Displays the Home page area. */
    public showHomePage(): void {
        this.showPage('Home');
    }

    /** Displays the Practice Setup page area. */
    public showPracticeSetup(): void {
        this.showPage('PrePractice');
    }

    /** Displays the Practice Setup page area. */
    public showForYouPage(): void {
        this.showPage('ForYou');
    }

    /**
     * A generic method to show a specific page area and update navigation bar styling.
     * @param key The key corresponding to the page to be shown ('Home', 'PrePractice', 'ForYou').
     */
    private showPage(key: 'Home' | 'PrePractice' | 'ForYou'): void {
        $('.area').addClass('d-none');
        $('.nav-bottom .nav-item.active').removeClass('active');

        $(`#area${key}`).removeClass('d-none');
        $(`#nav${key}`).addClass('active');
    }

    /**
     * Sets the value of the main sentence input field and updates its data-val attribute.
     * @param value The text to set as the input's value.
     */
    public setInputValue(value: string) {
        const $el = $('#sentenceInput');
        $el.val(value);
        if (value.trim() !== '') {
            $el.attr('data-val', value.trim());
        }
        $el.trigger('input');
    }

    /**
     * Populates the level selection dropdown with data fetched from the samples JSON.
     */
    public setupSampleOptions(): void {
        const $levelSelect = $('#levelSelect');
        $levelSelect.empty();
        this.app.samples.levels.forEach((level, index) => {
            $levelSelect.append(`<option value="${index}">${level.name}</option>`);
        });

        const defaultLevelIndex = this.app.samples.levels.findIndex(l => l.name === this.app.defaultLevelName);
        const savedLevelIndex = parseInt(localStorage.getItem('selectedLevelIndex') || '-1');

        if (savedLevelIndex !== -1 && this.app.samples.levels[savedLevelIndex]) {
            $levelSelect.val(savedLevelIndex.toString());
        } else if (defaultLevelIndex !== -1) {
            $levelSelect.val(defaultLevelIndex.toString());
        } else {
            $levelSelect.val('0');
        }
        this.populateCategories();
    }

    /**
     * Populates the language selection dropdowns from the languageMap.
     */
    public setupLanguageOptions(): void {
        const $languageSelects = $('#languageSelect, #headerLanguageSelect');
        $languageSelects.empty();
        for (const [code, name] of Object.entries(this.app.languageMap)) {
            $languageSelects.append(`<option value="${code}">${name}</option>`);
        }
        $languageSelects.val(this.app.lang);
    }

    /**
     * Updates all UI elements that display the current language.
     */
    public updateLanguageUI() {
        this.app.updateLanguageGeneral();
        $('.current-language-general-name').text(this.app.langGeneral);
        $('#languageSelect, #headerLanguageSelect').val(this.app.lang);
    }

    /**
     * Displays a modal to warn the user about potential TTS issues.
     */
    public showTTSWarning(): void {
        $('.current-language-general-name').text(this.app.langGeneral);
        const modalElement = document.getElementById('ttsWarningModal');
        if (modalElement) {
            const modal = new Modal(modalElement);
            modal.show();
        }
    }

    /**
     * Populates the category selection dropdown based on the currently selected level.
     */
    public populateCategories(): void {
        const $levelSelect = $('#levelSelect') as JQuery<HTMLSelectElement>;
        const $categorySelect = $('#categorySelect');
        const selectedLevelIndex = parseInt($levelSelect.val() as string);
        localStorage.setItem('selectedLevelIndex', selectedLevelIndex.toString());

        $categorySelect.empty();
        const categories = this.app.samples.levels[selectedLevelIndex].categories;
        categories.forEach((category, index) => {
            $categorySelect.append(`<option value="${index}">${category.name} (${category.sentences.length})</option>`);
        });

        const defaultCategoryIndex = categories.findIndex(c => c.name === this.app.defaultCategoryName);
        const savedCategoryIndex = parseInt(localStorage.getItem('selectedCategoryIndex') || '-1');

        if (savedCategoryIndex !== -1 && categories[savedCategoryIndex]) {
            $categorySelect.val(savedCategoryIndex.toString());
        } else if (defaultCategoryIndex !== -1) {
            $categorySelect.val(defaultCategoryIndex.toString());
        } else {
            $categorySelect.val('0');
        }
    }

    /**
     * Populates the repetitions dropdown with predefined values.
     */
    public setupRepOptions(): void {
        for (let i = 1; i <= 20; i++) {
            if ([1, 2, 3, 5, 10, 20].includes(i)) {
                $('#repsSelect').append(`<option value="${i}">${i}</option>`);
            }
        }
    }

    /**
     * Renders the sample sentence in the configuration area, highlighting the current starting word.
     */
    public renderSampleSentence(): void {
        $('#sampleSentence').empty();
        this.app.words.forEach((w, i) => {
            const cls = i === this.app.currentIndex ? 'current-word' : '';
            $('#sampleSentence').append(`<span data-index="${i}" class="${cls}">${w}</span> `);
        });
    }

    /**
     * Renders the full sentence in the practice area, highlighting the current word
     * and greying out completed parts of the sentence.
     */
    public renderFullSentence(): void {
        $('#fullSentence').empty();
        let lastPunctuationIndex = -1;
        for (let i = this.app.currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(this.app.words[i].slice(-1))) {
                lastPunctuationIndex = i;
                break;
            }
        }
        const startIndex = lastPunctuationIndex >= 0 ? lastPunctuationIndex + 1 : 0;
        this.app.words.forEach((w, i) => {
            let cls = '';
            if (i < startIndex) cls = 'text-muted';
            else if (i === this.app.currentIndex) cls = 'current-word';
            $('#fullSentence').append(`<span class="${cls}">${w}</span> `);
        });
    }

    /**
     * Configures the practice UI based on the selected practice mode ('skip', 'check', 'auto-skip').
     * It shows or hides the user input field and adjusts button text and behavior.
     */
    public setupPracticeUI(): void {
        const userInputGroup = $('#userInput').parent();
        const checkBtn = $('#checkBtn');

        if (this.app.practiceMode === 'check') {
            $('#instructionText').text('Now it’s your turn. Tap the mic icon on your keyboard and speak the word.').show();
            userInputGroup.show();
            $('#userInput').trigger('focus');
            checkBtn.text('Check/Skip').show();
        } else if (this.app.practiceMode === 'auto-skip') {
            $('#instructionText').text('Listen and repeat. The next phrase will play automatically.').show();
            userInputGroup.hide();
            checkBtn.html('<i class="bi bi-hourglass-split"></i> Auto-advancing...').show();
            checkBtn.addClass('auto-skip-progress');
            checkBtn.removeClass('loading');
            checkBtn.css('animation-duration', '');
        } else { // 'skip' mode
            $('#instructionText').text('Listen, repeat to yourself, then click "Next Step".').show();
            userInputGroup.hide();
            checkBtn.html('<i class="bi bi-skip-forward-fill"></i> Next Step').show();
        }
    }

    /**
     * Displays a modal with various actions for a specific word (e.g., play, define, translate).
     * @param element The word span element that was clicked.
     */
    public showWordActionsModal(element: HTMLElement): void {
        const word = $(element).text().trim().replace(/[.,!?;:"'(){}[\]]/g, '');
        if (!word) return;

        $('#wordActionsModalLabel').text(`Word: ${word}`);

        $('#playWordBtn').off('click').on('click', () => {
            this.app.audioService.speak(word, null, 0.7, this.app.lang);
        });

        const encodedWord = encodeURIComponent(word);
        $('#searchPronunciationLink').attr('href', `https://www.google.com/search?q=pronunciation:+${encodedWord}`);
        $('#searchMeaningLink').attr('href', `https://www.google.com/search?q=meaning:+${encodedWord}`);
        $('#searchExamplesLink').attr('href', `https://www.google.com/search?q=${encodedWord}+in+a+sentence`);
        $('#searchSentenceMeaningLink').off('click').on('click', () => this.openTranslate(this.app.currentPhrase));

        $('#translateWithGptBtn').off('click').on('click', (e) => {
            e.preventDefault();
            this.app.aiService.handleTranslateWithGpt(e.currentTarget);
        });
        $('#grammarAnalysisBtn').off('click').on('click', (e) => {
            e.preventDefault();
            this.app.aiService.handleGrammarAnalysis(e.currentTarget);
        });
        $('#vocabExpansionBtn').off('click').on('click', (e) => {
            e.preventDefault();
            this.app.aiService.handleVocabularyExpansion(e.currentTarget);
        });
        $('#contextNuanceBtn').off('click').on('click', (e) => {
            e.preventDefault();
            this.app.aiService.handleContextNuance(e.currentTarget);
        });
        $('#creativePracticeBtn').off('click').on('click', (e) => {
            e.preventDefault();
            this.app.aiService.handleCreativePractice(e.currentTarget);
        });

        this.app.audioService.speak(word, null, 1, this.app.lang);
        const modalElement = document.getElementById('wordActionsModal');
        if (modalElement) {
            const modal = new Modal(modalElement);
            modal.show();
        }
    }

    /**
     * Opens Google Translate in a new tab to translate the given text.
     * @param text The text to be translated.
     */
    public openTranslate(text: string) {
        const url = "https://translate.google.com/?sl=auto&tl=auto" + "&op=translate&text=" + encodeURIComponent(text);
        const newWin = window.open("", "_blank");

        if (newWin) {
            newWin.document.write(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body>
            <p style="font-family:sans-serif"></p>
            <script>
              location.replace("${url}");
            <\/script>
          </body>
          </html>
        `);
            newWin.document.close();
        } else {
            alert("Popup blocked! Please allow popups for this site.");
        }
    }

    /**
     * Provides visual feedback when text is successfully copied to the clipboard
     * and shows a confirmation modal to navigate to an external site.
     * @param element The element that triggered the copy action.
     * @param url The URL to open if the user confirms.
     */
    public showCopySuccessFeedback(element: HTMLElement, url: string): void {
        const $element = $(element);
        const originalHtml = $element.html();
        $element.html('<i class="bi bi-check-lg"></i> Copied!');
        $element.prop('disabled', true);
        setTimeout(() => {
            $element.html(originalHtml);
            $element.prop('disabled', false);
        }, 2000);

        const modalElement = document.getElementById('confirmationModal');
        if (!modalElement) return;

        const confirmBtn = modalElement.querySelector('#confirmGoToGptBtn');
        if (!confirmBtn) return;

        const confirmationModal = Modal.getOrCreateInstance(modalElement);
        const redirectToGpt = () => {
            window.open(url, '_blank');
            confirmationModal.hide();
        };

        $(confirmBtn).off('click').one('click', redirectToGpt);
        confirmationModal.show();
    }

    /**
     * Displays the application's build date, injected by the build process.
     */
    public displayAppVersion(): void {
        const buildDate = __APP_BUILD_DATE__;
        $('#app-version').text(`build.${buildDate}`);
    }

    /**
     * Toggles CSS classes on the body element based on the browser's online status.
     */
    public updateOnlineStatusClass(): void {
        const isOnline = navigator.onLine;
        document.body.classList.toggle('is-offline', !isOnline);
        document.body.classList.toggle('is-online', isOnline);
    }

    /**
     * Triggers a confetti animation to celebrate the completion of a practice session.
     */
    public triggerCelebrationAnimation(): void {
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 7,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 1 }
            });
            confetti({
                particleCount: 7,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 1 }
            });

            if (Date.now() < animationEnd) {
                requestAnimationFrame(frame);
            }
        }());
    }
}