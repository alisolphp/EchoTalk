import $ from 'jquery';
import { EchoTalkApp } from '../app';
import { Practice } from '../types';

/**
 * Encapsulates the core logic for the practice session flow, including starting,
 * advancing through phrases, checking answers, and finishing a session.
 */
export class PracticeService {
    private app: EchoTalkApp;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /**
     * Starts a new practice session. It initializes state, saves the practice attempt
     * to IndexedDB, sets up the UI, and begins the first practice step.
     */
    public async startPractice(): Promise<void> {
        this.app.practiceMode = ($('#practiceModeSelect').val() as 'skip' | 'check' | 'auto-skip');
        const rawVal = $('#sentenceInput').attr('data-val');
        this.app.sentence = (typeof rawVal === 'string' ? rawVal.trim() : '').replace(/([^\.\?\!\n])\n/g, '$1.\n');

        if (this.app.sentence.trim() === '') {
            alert('Please enter a sentence to practice.');
            return;
        }

        this.app.words = this.app.sentence.split(/\s+/).filter(w => w.length > 0);
        this.app.reps = parseInt(($('#repsSelect').val() as string));
        this.app.currentCount = 0;
        this.app.correctCount = 0;
        this.app.attempts = 0;
        this.app.saveState();

        try {
            const transaction = this.app.db.transaction(['practices'], 'readwrite');
            const store = transaction.objectStore('practices');
            const request = store.get(this.app.sentence);
            request.onsuccess = () => {
                const data: Practice | undefined = request.result;
                if (data) {
                    data.count++;
                    data.lastPracticed = new Date();
                    store.put(data);
                } else {
                    const newPractice: Practice = {
                        sentence: this.app.sentence,
                        lang: this.app.lang,
                        count: 1,
                        lastPracticed: new Date()
                    };
                    store.add(newPractice);
                }
            };
            transaction.onerror = (event) => {
                console.error('Transaction error while saving practice:', (event.target as IDBTransaction).error);
            };
        } catch (error) {
            console.error('Error saving practice data:', error);
        }

        $('#session-complete-container').addClass('d-none').empty();
        $('#practice-ui-container').removeClass('d-none');
        $('#configArea').addClass('d-none');
        $('#practiceArea').removeClass('d-none');
        $('#backHomeButton').removeClass('d-none').addClass('d-inline-block');

        await this.app.audioService.initializeMicrophoneStream();
        this.app.uiService.setupPracticeUI();
        this.app.uiService.renderFullSentence();
        this.practiceStep();
        location.hash = 'practice';
    }

    /**
     * Executes a single step of the practice loop for the current phrase.
     * It determines the current phrase, speaks it using TTS, and sets up recording if enabled.
     * @param speed The playback speed for the TTS, defaults to 1.
     */
    public practiceStep(speed: number = 1): void {
        this.app.utilService.clearAutoSkipTimer();
        if (this.app.currentIndex >= this.app.words.length) {
            this.finishSession();
            return;
        }

        const endIndex = this.app.utilService.getPhraseBounds(this.app.currentIndex, this.getMaxWordsBasedOnLevel() as number);
        const startIndex = this.app.utilService.getStartOfCurrentPhrase();
        const phrase = this.app.words.slice(startIndex, endIndex).join(' ');
        this.app.currentPhrase = this.app.utilService.removeJunkCharsFromText(phrase);

        if (this.app.isRecordingEnabled) {
            const listeningMessages = [
                '👂 Listen carefully...', '🎧 Time to focus and listen!', '🔊 Pay close attention...',
                '👀 Just listen...', '🌊 Let the sound flow in...', '🧘 Stay calm, stay focused...',
                '📡 Receiving the signal...', '🎶 Tune in to the rhythm...'
            ];
            const randomMessage = listeningMessages[Math.floor(Math.random() * listeningMessages.length)];
            $('#feedback-text').html(`<div class="listening-indicator">${randomMessage}</div>`);
        } else {
            $('#feedback-text').html('');
        }

        const startRecordingCallback = () => {
            if (this.app.isRecordingEnabled) {
                setTimeout(() => {
                    this.app.audioService.startRecording();
                }, 50);
            }
        };

        this.app.audioService.speakAndHighlight(phrase, this.app.isRecordingEnabled ? startRecordingCallback : null, speed);
        $('#sentence-container').off('click', '.word').on('click', '.word', (e) => this.app.uiService.showWordActionsModal(e.currentTarget));
    }

    /**
     * Determines the maximum number of words for a practice phrase based on the selected difficulty level.
     * @returns The maximum number of words for the current level.
     */
    private getMaxWordsBasedOnLevel(): Number {
        const $levelSelect = $('#levelSelect');
        const level = Number($levelSelect.val());
        const wordsPerLevel: { [key: number]: number } = {
            0: 2, 1: 5, 2: 7
        };
        return wordsPerLevel[level] ?? 5;
    }

    /**
     * Checks the user's spoken or typed answer against the target phrase.
     * This method is used in 'check' mode. It calculates similarity and provides feedback.
     */
    public async checkAnswer(): Promise<void> {
        if (this.app.isRecordingEnabled) {
            await this.app.audioService.stopRecording();
        }

        const endIndex = this.app.utilService.getPhraseBounds(this.app.currentIndex, this.getMaxWordsBasedOnLevel() as number);
        const startIndex = this.app.utilService.getStartOfCurrentPhrase();
        const target = this.app.utilService.cleanText(this.app.words.slice(startIndex, endIndex).join(' '));

        const userInput = $('#userInput') as JQuery<HTMLInputElement>;
        let answer = this.app.utilService.cleanText(userInput.val() as string);
        this.app.currentCount++;

        if (answer === "") {
            if (this.app.currentCount >= this.app.reps) {
                if (this.app.practiceMode === 'check') {
                    if (this.app.reps >= 2) {
                        $('#feedback-text').html(`<div class="correct">(0 of ${this.app.reps} attempts)</div>`);
                    }
                    setTimeout(() => this.advanceToNextPhrase(), 1200);
                } else {
                    this.advanceToNextPhrase();
                }
            } else {
                if (this.app.reps >= 2) {
                    $('#feedback-text').html(`<div class="correct">(${this.app.currentCount} of ${this.app.reps} attempts)</div>`);
                }
                this.practiceStep();
            }
            return;
        }

        userInput.val('');
        this.app.attempts++;
        const similarity = this.app.utilService.calculateWordSimilarity(target, answer);
        const similarityPercent = Math.round(similarity * 100);

        if (similarity >= 0.6) {
            this.app.correctCount++;
            this.app.audioService.playSound('./sounds/correct.mp3', 1, 0.6);
            $('#feedback-text').html(`<div class="correct">Correct! (${similarityPercent}% match) - (${this.app.currentCount}/${this.app.reps})</div>`);
            if (this.app.currentCount >= this.app.reps) {
                this.app.currentIndex = endIndex;
                this.app.currentCount = 0;
            }
        } else {
            this.app.audioService.playSound('./sounds/wrong.mp3', 1, 0.6);
            $('#feedback-text').html(`<div class="incorrect">Try again! (${similarityPercent}% match) <br>Detected: "${answer}"</div>`);
        }

        this.app.saveState();
        setTimeout(() => {
            if (this.app.currentIndex < this.app.words.length) {
                this.app.uiService.renderFullSentence();
                this.practiceStep();
            } else {
                this.finishSession();
            }
        }, 1200);
    }

    /**
     * Advances the practice session to the next phrase in the sentence.
     * Used in 'skip' and 'auto-skip' modes.
     */
    public advanceToNextPhrase(): void {
        if (this.app.isRecordingEnabled) {
            this.app.audioService.stopRecording();
        }
        const endIndex = this.app.utilService.getPhraseBounds(this.app.currentIndex, this.getMaxWordsBasedOnLevel() as number);
        this.app.currentIndex = endIndex;
        this.app.currentCount = 0;
        if (this.app.currentIndex >= this.app.words.length) {
            this.finishSession();
            return;
        }
        this.app.saveState();
        this.app.uiService.renderFullSentence();
        this.practiceStep();
    }

    /**
     * Concludes the practice session when all phrases have been completed.
     * It shows a completion message, plays a victory sound, and clears session-specific state.
     */
    public finishSession(): void {
        this.app.utilService.clearAutoSkipTimer();
        this.app.audioService.terminateMicrophoneStream();
        this.app.uiService.triggerCelebrationAnimation();

        const messages = ["You nailed it!", "That was sharp!", "Boom!", "Bravo!", "That was smooth!", "Great shadowing!", "You crushed it!", "Smart move!", "Echo mastered.", "That was fire!"];
        const emojis = ["🔥", "🎯", "💪", "🎉", "🚀", "👏", "🌟", "🧠", "🎧", "💥"];
        let ttsMsg = messages[Math.floor(Math.random() * messages.length)];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        let displayMsg = `${emoji} ${ttsMsg}`;

        if (this.app.practiceMode === 'check') {
            const accuracy = this.app.attempts ? Math.round((this.app.correctCount / this.app.attempts) * 100) : 100;
            displayMsg += ` Your accuracy: ${accuracy}%.`;
            ttsMsg += ` Your accuracy: ${accuracy}%.`;
        }

        const callToActions = ["Let's Start Over!", "Go Again!", "Ready for Another Round?"];
        const callToAction = callToActions[Math.floor(Math.random() * callToActions.length)];
        ttsMsg += ` ${callToAction}`;
        this.app.audioService.playSound('./sounds/victory.mp3', 2.5, 0.6);
        setTimeout(() => this.app.audioService.speak(ttsMsg, null, 1.3, 'en-US'), 1100);

        displayMsg += `<br><a class="btn btn-success mt-2" href="#" onclick="app.resetWithoutReload(); return false;">${callToAction}</a>`;
        $('#practice-ui-container').addClass('d-none');
        $('#session-complete-container').html(`<h2>${displayMsg}</h2>`).removeClass('d-none');

        localStorage.removeItem(this.app.STORAGE_KEYS.index);
        localStorage.removeItem(this.app.STORAGE_KEYS.count);
        localStorage.removeItem(this.app.STORAGE_KEYS.correctCount);
        localStorage.removeItem(this.app.STORAGE_KEYS.attempts);

        $('#backHomeButton').addClass('d-none').removeClass('d-inline-block');
    }

    /**
     * A handler for the main practice button. In 'check' mode, it checks the answer;
     * otherwise, it advances to the next phrase.
     */
    public handleCheckOrNext(): void {
        this.checkAnswer();
    }

    /**
     * Selects a new random sample sentence based on the chosen level and category,
     * and updates the UI and application state accordingly.
     */
    public useSample(): void {
        const selectedLevelIndex = ($('#levelSelect').val() as string);
        const selectedCategoryIndex = ($('#categorySelect').val() as string);
        localStorage.setItem('selectedLevelIndex', selectedLevelIndex);
        localStorage.setItem('selectedCategoryIndex', selectedCategoryIndex);

        this.app.sentence = this.app.utilService.pickSample();
        this.app.uiService.setInputValue(this.app.sentence);
        this.app.words = this.app.sentence.split(/\s+/).filter(w => w.length > 0);
        this.app.currentIndex = 0;
        this.app.uiService.renderSampleSentence();
        this.app.saveState();
        this.app.uiService.setInputValue('');
    }

    /**
     * Handles clicks on words in the sample sentence display, allowing the user
     * to set the starting point for their practice.
     * @param element The clicked word span element.
     */
    public handleSampleWordClick(element: HTMLElement): void {
        const newIndex = $(element).data('index');
        if (typeof newIndex === 'number') {
            this.app.currentIndex = newIndex;
            this.app.uiService.renderSampleSentence();
            this.app.saveState();
        }
    }
}