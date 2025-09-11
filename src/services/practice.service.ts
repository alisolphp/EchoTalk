import $ from 'jquery';
import { Modal } from 'bootstrap';
import { EchoTalkApp } from '../app';
import { Practice } from '../types';

/**
 * Encapsulates the core logic for the practice session flow, including starting,
 * advancing through phrases, checking answers, and finishing a session.
 */
export class PracticeService {
    private app: EchoTalkApp;
    private currentSentencePracticeCount: number = 0;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /**
     * Starts a new practice session.
     * It initializes state, saves the practice attempt
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

        const selectedReps = parseInt($('#repsSelect').val() as string);
        this.app.words = this.app.sentence.split(/\s+/).filter(w => w.length > 0);
        this.app.currentCount = 0;
        this.app.correctCount = 0;
        this.app.attempts = 0;
        this.app.area = 'Practice';
        this.app.saveState();
        try {
            const transaction = this.app.db.transaction(['practices'], 'readonly');
            const store = transaction.objectStore('practices');
            const request = store.get(this.app.sentence);

            request.onsuccess = () => {
                const data: Practice | undefined = request.result;
                let practicesTodayCount = 0;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (data && data.practiceHistory) {
                    practicesTodayCount = data.practiceHistory.filter(timestamp => {
                        const practiceDate = new Date(timestamp);
                        practiceDate.setHours(0, 0, 0, 0);
                        return practiceDate.getTime() === today.getTime();
                    }).length;
                }

                this.currentSentencePracticeCount = practicesTodayCount;

                if (selectedReps === 0) {
                    this.app.reps = Math.max(1, 5 - this.currentSentencePracticeCount);
                } else {
                    this.app.reps = selectedReps;
                }
            };
            transaction.oncomplete = async () => {
                $('#session-complete-container').addClass('d-none').empty();
                $('#practice-ui-container').removeClass('d-none');
                $('#configArea').addClass('d-none');
                $('#practiceArea').removeClass('d-none');
                $('#backHomeButton').removeClass('d-none').addClass('d-inline-block');

                if (this.app.practiceMode === 'auto-skip') {
                    this.app.requestWakeLock();
                }

                await this.app.audioService.initializeMicrophoneStream();
                this.app.uiService.setupPracticeUI();
                this.app.uiService.renderFullSentence();

                await this.practiceStep();
                location.hash = 'practice';
            };
            transaction.onerror = (event) => {
                console.error('Transaction error while reading practice count:', (event.target as IDBTransaction).error);
            };

        } catch (error) {
            console.error('Error reading practice data:', error);
        }
    }

    /**
     * Records the completion of a practice session into the database.
     * @returns A promise that resolves with the new streak count.
     */
    private recordPracticeCompletion(): Promise<number> {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.app.db.transaction(['practices'], 'readwrite');

                transaction.oncomplete = async () => {
                    const newStreak = await this.app.dataService.updateStreakCounters();
                    resolve(newStreak);
                };

                transaction.onerror = (event) => {
                    console.error('Transaction error while saving practice:', (event.target as IDBTransaction).error);
                    reject((event.target as IDBTransaction).error);
                };

                const store = transaction.objectStore('practices');
                const request = store.get(this.app.sentence);

                request.onsuccess = () => {
                    const data: Practice | undefined = request.result;
                    if (data) {
                        data.count++;
                        if (!data.practiceHistory) {
                            data.practiceHistory = [new Date()];
                        } else {
                            data.practiceHistory.push(new Date());
                        }
                        store.put(data);
                    } else {
                        const newPractice: Practice = {
                            sentence: this.app.sentence,
                            lang: this.app.lang,
                            count: 1,
                            practiceHistory: [new Date()]
                        };
                        store.add(newPractice);
                    }
                };

                request.onerror = (event) => {
                    console.error('Error fetching practice to update:', (event.target as IDBRequest).error);
                    reject((event.target as IDBRequest).error);
                };

            } catch (error) {
                console.error('Error initiating save practice transaction:', error);
                reject(error);
            }
        });
    }

    /**
     * Executes a single step of the practice loop for the current phrase.
     * It determines the current phrase, speaks it using TTS, and sets up recording if enabled.
     * @param speed The playback speed for the TTS, defaults to 1.
     */
    public async practiceStep(speed: number = 1): Promise<void> {
        this.app.utilService.clearAutoSkipTimer();
        if (this.app.currentIndex >= this.app.words.length) {
            await this.finishSession();
            return;
        }

        const endIndex = this.app.utilService.getPhraseBounds(this.app.currentIndex, this.getDynamicMaxWords());
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
            $('#checkBtn').focus();
            $('#feedback-text').html('');
            if (this.app.reps > 1 && this.app.currentCount >= 0) {
                const repetitionMessages = [
                    `Repetition ${this.app.currentCount + 1} of ${this.app.reps}`,
                    `Round ${this.app.currentCount + 1}/${this.app.reps}`,
                    `Practice ${this.app.currentCount + 1} of ${this.app.reps}`,
                    `Try ${this.app.currentCount + 1}/${this.app.reps}`
                ];
                const randomMessage = repetitionMessages[Math.floor(Math.random() * repetitionMessages.length)];
                $('#feedback-text').html(`<div class="repetition-indicator">${randomMessage}</div>`);
            }

        }

        const startRecordingCallback = () => {
            if (this.app.isRecordingEnabled) {
                setTimeout(() => {
                    this.app.audioService.startRecording();
                }, 50);
            }
        };

        let finalRate: number | null = null;
        // speechRate value `0` means automatic.
        if (this.app.speechRate === 0) {
            let automaticBaseRate: number;
            const practiceCountToday = this.currentSentencePracticeCount;
            if (practiceCountToday === 0) { // 1st time
                automaticBaseRate = 0.8;
                // Medium
            } else if (practiceCountToday === 1 || practiceCountToday === 2) { // 2nd and 3rd
                automaticBaseRate = 1.0;
                // Normal
            } else { // 4th+
                automaticBaseRate = 1.2;
                // Fast
            }
            finalRate = speed * automaticBaseRate;
        }

        this.app.audioService.speakAndHighlight(phrase, this.app.isRecordingEnabled ? startRecordingCallback : null, speed, finalRate);
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

    private getDynamicMaxWords(): number {
        const levelMaxWords = this.getMaxWordsBasedOnLevel() as number;

        // The newness limit now gradually increases with each practice session.
        const newnessLimit = this.currentSentencePracticeCount + 1;

        return Math.min(levelMaxWords, newnessLimit);
    }

    /**
     * Checks the user's spoken or typed answer against the target phrase.
     * This method is used in 'check' mode. It calculates similarity and provides feedback.
     */
    public async checkAnswer(): Promise<void> {
        if (this.app.isRecordingEnabled) {
            await this.app.audioService.stopRecording();
        }

        const endIndex = this.app.utilService.getPhraseBounds(this.app.currentIndex, this.getDynamicMaxWords());
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
        setTimeout(async () => {
            if (this.app.currentIndex < this.app.words.length) {
                this.app.uiService.renderFullSentence();
                await this.practiceStep();
            } else {
                await this.finishSession();
            }

        }, 1200);
    }

    /**
     * Advances the practice session to the next phrase in the sentence.
     * Used in 'skip' and 'auto-skip' modes.
     */
    public async advanceToNextPhrase(): Promise<void> {
        if (this.app.isRecordingEnabled) {
            await this.app.audioService.stopRecording();
        }
        const endIndex = this.app.utilService.getPhraseBounds(this.app.currentIndex, this.getDynamicMaxWords());
        this.app.currentIndex = endIndex;
        this.app.currentCount = 0;
        if (this.app.currentIndex >= this.app.words.length) {
            await this.finishSession();
            return;
        }
        this.app.saveState();
        this.app.uiService.renderFullSentence();
        await this.practiceStep();
    }

    /**
     * Restarts the current practice session from the beginning of the same sentence.
     */
    public async restartCurrentPractice(): Promise<void> {
        if (this.app.autoRestartTimer) {
            clearTimeout(this.app.autoRestartTimer);
            this.app.autoRestartTimer = null;
        }

        // Since we've just practiced it, its count is now > 0 in the DB.
        // By setting this to a non-zero value, we ensure the "newness" limit is lifted on restart.
        this.currentSentencePracticeCount = 1;

        // Reset state variables for the new run
        this.app.currentIndex = 0;
        this.app.currentCount = 0;
        this.app.correctCount = 0;
        this.app.attempts = 0;
        this.app.saveState();

        // Restore the UI from completion screen to practice screen
        $('#session-complete-container').addClass('d-none').empty();
        $('#practice-ui-container').removeClass('d-none');
        $('#backHomeButton').removeClass('d-none').addClass('d-inline-block');

        // Re-initialize microphone and start the practice loop
        await this.app.audioService.initializeMicrophoneStream();
        this.app.uiService.setupPracticeUI();
        this.app.uiService.renderFullSentence();
        this.practiceStep();
    }

    /**
     * Concludes the practice session when all phrases have been completed.
     * It shows a completion message, plays a victory sound, and clears session-specific state.
     */
    public async finishSession(): Promise<void> {
        const { newStreak, oldStreak } = await this.recordPracticeCompletion();
        const willShowStreakModal = newStreak > oldStreak;

        this.app.utilService.clearAutoSkipTimer();
        this.app.audioService.terminateMicrophoneStream();
        if (this.app.practiceMode === 'auto-skip') {
            await this.app.releaseWakeLock();
        }
        if (this.app.area === 'Practice') {
            this.app.uiService.triggerCelebrationAnimation();
            if (willShowStreakModal) {
                setTimeout(() => {
                    const modalEl = document.getElementById('myStreakModal');
                    if (modalEl) {
                        const myStreakModal = Modal.getOrCreateInstance(modalEl);
                        myStreakModal.show();
                    }
                }, 1500);
            }
        }
        const messages = ["You nailed it!", "That was sharp!", "Boom!", "Bravo!", "That was smooth!", "Great shadowing!", "You crushed it!", "Smart move!", "Echo mastered.", "That was fire!"];
        const emojis = ["🔥", "🎯", "💪", "🎉", "🚀", "👏", "🌟", "🧠", "🎧", "💥"];
        let ttsMsg = messages[Math.floor(Math.random() * messages.length)];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        let accuracyText = '';
        if (this.app.practiceMode === 'check') {
            const accuracy = this.app.attempts ? Math.round((this.app.correctCount / this.app.attempts) * 100) : 100;
            accuracyText = `<p class="lead mb-4">Your accuracy: ${accuracy}%.</p>`;
            ttsMsg += ` Your accuracy: ${accuracy}%.`;
        }

        ttsMsg += ` Ready for another round?`;
        if (this.app.area === 'Practice') {
            this.app.audioService.playSound('./sounds/victory.mp3', 2.5, 0.6);
            if(!willShowStreakModal){
                setTimeout(() => this.app.audioService.speak(ttsMsg, null, 1.3, 'en-US'), 1100);
            }
        }

        const completionHtml = `
        <div class="text-center py-3">
            <h2 class="mb-3">${emoji} ${ttsMsg.split(' Your accuracy:')[0]}</h2>
            ${accuracyText}
            <div class="d-grid gap-3 col-10 col-md-6 mx-auto mt-4">
                <button id="restartPracticeBtn" class="btn btn-primary btn-lg" onclick="app.practiceService.restartCurrentPractice(); return false;">

                  <i class="bi bi-arrow-repeat"></i> Repeat this sentence
                </button>
                <button class="btn btn-secondary" onclick="app.resetWithoutReload(); return false;">
                    Try a new sentence?
                </button>
            </div>
        </div>`;
        $('#practice-ui-container').addClass('d-none');
        $('#session-complete-container').html(completionHtml).removeClass('d-none');
        $('#restartPracticeBtn').focus();

        localStorage.removeItem(this.app.STORAGE_KEYS.index);
        localStorage.removeItem(this.app.STORAGE_KEYS.count);
        localStorage.removeItem(this.app.STORAGE_KEYS.correctCount);
        localStorage.removeItem(this.app.STORAGE_KEYS.attempts);

        $('#backHomeButton').addClass('d-none').removeClass('d-inline-block');

        if (this.app.practiceMode === 'auto-skip' && this.app.area === 'Practice' && !willShowStreakModal) {
            const waitTime = 5;
            const $restartBtn = $('#restartPracticeBtn');
            $restartBtn.addClass('auto-skip-progress').removeClass('loading');
            void ($restartBtn[0] as HTMLElement).offsetHeight;
            $restartBtn.css('animation-duration', `${waitTime}s`).addClass('loading');
            this.app.autoRestartTimer = setTimeout(() => {
                if (!$('#session-complete-container').hasClass('d-none')) {
                    this.restartCurrentPractice();
                }
            }, waitTime * 1000);
        }
    }

    /**
     * A handler for the main practice button.
     * In 'check' mode, it checks the answer;
     * otherwise, it advances to the next phrase.
     */
    public handleCheckOrNext(): void {
        if(this.app.practiceMode === 'auto-skip'){
            return;
        }
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