// Imports
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import $ from 'jquery';
import './../css/style.css';

// --- Type Definitions ---
interface Recording {
    sentence: string;
    audio: Blob;
    timestamp: Date;
}

// Extend global interfaces
declare global {
    interface Window {
        modalRecordings: Record<string, Recording[]>;
        deferredPrompt: any;
    }
    interface String {
        hashCode(): string;
    }
}

/**
 * Simple hash function to generate a unique ID from a string.
 */
String.prototype.hashCode = function(): string {
    let hash = 0, i: number, chr: number;
    if (this.length === 0) return 'h0';
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return 'h' + Math.abs(hash);
};


// =================================================================
// The Main Application Class
// =================================================================
export class EchoTalkApp {
    // --- Constants ---
    private readonly STORAGE_KEYS = {
        sentence: 'shadow_sentence',
        reps: 'shadow_reps',
        index: 'shadow_index',
        count: 'shadow_count',
        correctCount: 'shadow_correct',
        attempts: 'shadow_attempts',
        recordAudio: 'shadow_record_audio'
    };

    // --- State Properties ---
    private sentence: string = '';
    private words: string[] = [];
    private reps: number = 3;
    private currentIndex: number = 0;
    private currentCount: number = 0;
    private correctCount: number = 0;
    private attempts: number = 0;
    private samples: string[] = [];
    private currentPhrase: string = '';
    private isRecordingEnabled: boolean = false;
    private practiceMode: 'skip' | 'check' = 'skip';

    // --- Media & DB Properties ---
    private mediaRecorder: MediaRecorder | undefined;
    private db!: IDBDatabase;
    private currentlyPlayingAudioElement: HTMLAudioElement | null = null;

    // --- Helper Properties ---
    private readonly isMobile: boolean = /Mobi|Android/i.test(navigator.userAgent);
    private estimatedWordsPerSecond: number = 2.5;
    private phrasesSpokenCount: number = 0;

    constructor() {
        window.modalRecordings = {};
    }

    public async init(): Promise<void> {
        try {
            const sampleData = await this.fetchSamples();
            this.samples = sampleData.sentences;
            this.db = await this.initDB();

            this.setupRepOptions();
            this.loadState();
            this.bindEvents();

            if (!this.sentence) {
                this.sentence = this.pickSample();
            }

            ($('#sentenceInput') as JQuery<HTMLTextAreaElement>).val(this.sentence);
            this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
            ($('#repsSelect') as JQuery<HTMLSelectElement>).val(this.reps.toString());
            this.renderSampleSentence();
        } catch (error) {
            console.error("Initialization failed:", error);
            $('#configArea').html('<div class="alert alert-danger">Failed to initialize the application. Please refresh the page.</div>');
        }
    }

    private bindEvents(): void {
        $('#startBtn').on('click', () => this.startPractice());
        $('#resetBtn').on('click', () => this.resetApp());
        $('#checkBtn').on('click', () => this.handleCheckOrNext());
        $('#userInput').on('keypress', (e: JQuery.KeyPressEvent) => {
            if (e.key === 'Enter' && this.practiceMode === 'check') {
                this.checkAnswer();
            }
        });
        $('#useSampleBtn').on('click', () => this.useSample());
        $('#sampleSentence').on('click', 'span', (e) => this.handleSampleWordClick(e.currentTarget));
        $('#repeatBtn').on('click', () => this.practiceStep(0.6));
        $('#recordToggle').on('change', (e) => this.handleRecordToggle(e.currentTarget));

        $('#showRecordingsBtn').on('click', () => this.displayRecordings());
        $('#recordingsList').on('click', '.play-user-audio', (e) => this.playUserAudio(e.currentTarget));
        $('#recordingsList').on('click', '.play-bot-audio', (e) => this.playBotAudio(e.currentTarget));
        $('#recordingsModal').on('hidden.bs.modal', () => this.stopAllPlayback());

        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            window.deferredPrompt = e;
            $('#installBtn').removeClass('d-none');
        });
        $('#installBtn').on('click', () => {
            if (!window.deferredPrompt) return;
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then(() => {
                window.deferredPrompt = null;
                $('#installBtn').addClass('d-none');
            });
        });
    }

    private setupRepOptions(): void {
        for (let i = 1; i <= 20; i++) {
            if ([1, 2, 3, 5, 10, 20].includes(i)) {
                $('#repsSelect').append(`<option value="${i}">${i}</option>`);
            }
        }
    }

    // --- State & Data Management ---

    private loadState(): void {
        this.sentence = localStorage.getItem(this.STORAGE_KEYS.sentence) || '';
        this.reps = parseInt(localStorage.getItem(this.STORAGE_KEYS.reps) || this.reps.toString());
        this.currentIndex = parseInt(localStorage.getItem(this.STORAGE_KEYS.index) || '0');
        this.currentCount = parseInt(localStorage.getItem(this.STORAGE_KEYS.count) || '0');
        this.correctCount = parseInt(localStorage.getItem(this.STORAGE_KEYS.correctCount) || '0');
        this.attempts = parseInt(localStorage.getItem(this.STORAGE_KEYS.attempts) || '0');
        this.isRecordingEnabled = localStorage.getItem(this.STORAGE_KEYS.recordAudio) === 'true';
        $('#recordToggle').prop('checked', this.isRecordingEnabled);
    }

    private saveState(): void {
        localStorage.setItem(this.STORAGE_KEYS.sentence, this.sentence);
        localStorage.setItem(this.STORAGE_KEYS.reps, this.reps.toString());
        localStorage.setItem(this.STORAGE_KEYS.index, this.currentIndex.toString());
        localStorage.setItem(this.STORAGE_KEYS.count, this.currentCount.toString());
        localStorage.setItem(this.STORAGE_KEYS.correctCount, this.correctCount.toString());
        localStorage.setItem(this.STORAGE_KEYS.attempts, this.attempts.toString());
    }

    private fetchSamples(): Promise<{ sentences: string[] }> {
        return $.getJSON('./data/sentences.json');
    }

    private initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EchoTalkDB', 1);
            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('recordings')) {
                    const store = db.createObjectStore('recordings', { autoIncrement: true });
                    store.createIndex('sentence', 'sentence', { unique: false });
                }
            };
            request.onsuccess = event => resolve((event.target as IDBOpenDBRequest).result);
            request.onerror = event => reject((event.target as IDBOpenDBRequest).error);
        });
    }

    // --- Audio and Recording ---

    private saveRecording(blob: Blob, sentenceText: string): void {
        if (!this.db || blob.size === 0) return;
        const transaction = this.db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const record: Recording = { sentence: sentenceText, audio: blob, timestamp: new Date() };
        const request = store.add(record);
        request.onsuccess = () => console.log('Recording saved successfully.');
        request.onerror = (err) => console.error('Error saving recording:', err);
    }

    private async startRecording(): Promise<void> {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('#feedback').html('<div class="incorrect">Your browser does not support audio recording.</div>');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let localAudioChunks: Blob[] = [];
            const options = { mimeType: 'audio/ogg; codecs=opus' };
            this.mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType) ? new MediaRecorder(stream, options) : new MediaRecorder(stream);

            this.mediaRecorder.ondataavailable = event => localAudioChunks.push(event.data);

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(localAudioChunks, { type: this.mediaRecorder?.mimeType });
                if (audioBlob.size > 0) {
                    this.saveRecording(audioBlob, this.currentPhrase);
                }
                this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
            };
            this.mediaRecorder.start();
            $('#feedback').html('<div class="recording-indicator">Recording... <span class="dot"></span></div>');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            $('#feedback').html('<div class="incorrect">Could not access microphone. Please grant permission.</div>');
        }
    }

    private stopRecording(): Promise<void> {
        return new Promise(resolve => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
                this.mediaRecorder.stop();
            } else {
                resolve();
            }
        });
    }

    // --- UI and Rendering ---

    private renderSampleSentence(): void {
        $('#sampleSentence').empty();
        this.words.forEach((w, i) => {
            const cls = i === this.currentIndex ? 'current-word' : '';
            $('#sampleSentence').append(`<span data-index="${i}" class="${cls}">${w}</span> `);
        });
    }

    private renderFullSentence(): void {
        $('#fullSentence').empty();
        let lastPunctuationIndex = -1;
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(this.words[i].slice(-1))) {
                lastPunctuationIndex = i;
                break;
            }
        }
        const startIndex = lastPunctuationIndex >= 0 ? lastPunctuationIndex + 1 : 0;
        this.words.forEach((w, i) => {
            let cls = '';
            if (i < startIndex) cls = 'text-muted';
            else if (i === this.currentIndex) cls = 'current-word';
            $('#fullSentence').append(`<span class="${cls}">${w}</span> `);
        });
    }

    private setupPracticeUI(): void {
        const userInputGroup = $('#userInput').parent();
        if (this.practiceMode === 'check') {
            $('#instructionText').text('Now it’s your turn. Tap the mic icon on your keyboard and speak the word.').show();
            userInputGroup.show();
            $('#userInput').trigger('focus');
            $('#checkBtn').text('Check/Skip');
        } else { // 'skip' mode
            $('#instructionText').text('Listen, repeat to yourself, then click "Next Step".').show();
            userInputGroup.hide();
            $('#checkBtn').text('Next Step');
        }
    }

    // --- Core Logic Methods ---

    private practiceStep(speed: number = 1): void {
        if (this.currentIndex >= this.words.length) {
            this.finishSession();
            return;
        }
        const endIndex = this.getPhraseBounds(this.currentIndex, 3);
        const startIndex = this.getStartOfCurrentPhrase();
        const phrase = this.words.slice(startIndex, endIndex).join(' ');
        this.currentPhrase = this.removeJunkCharsFromText(phrase);
        this.speakAndHighlight(phrase, this.isRecordingEnabled ? () => this.startRecording() : null, speed);
        $('#sentence-container').off('click', '.word').on('click', '.word', function() {
            const word = $(this).text().trim().replace(/[.,!?;:"'(){}[\]]/g, '');
            window.open(`https://www.google.com/search?q=meaning:+${encodeURIComponent(word)}`, '_blank');
        });
    }

    private async checkAnswer(): Promise<void> {
        if (this.isRecordingEnabled) {
            await this.stopRecording();
        }

        const endIndex = this.getPhraseBounds(this.currentIndex, 3);
        const startIndex = this.getStartOfCurrentPhrase();
        const target = this.cleanText(this.words.slice(startIndex, endIndex).join(' '));

        const userInput = $('#userInput') as JQuery<HTMLInputElement>;
        let answer = this.cleanText(userInput.val() as string);

        this.currentCount++;

        if (answer === "") {
            if (this.currentCount >= this.reps) {
                if(this.reps >= 2){
                    $('#feedback').html(`<div class="correct">(0 of ${this.reps} attempts)</div>`);
                }
                this.advanceToNextPhrase();
            } else {
                if(this.reps >= 2) {
                    $('#feedback').html(`<div class="correct">(${this.currentCount} of ${this.reps} attempts)</div>`);
                }
                this.practiceStep();
            }
            return;
        }

        userInput.val('');
        this.attempts++;
        const similarity = this.calculateWordSimilarity(target, answer);
        const similarityPercent = Math.round(similarity * 100);

        if (similarity >= 0.6) {
            this.correctCount++;
            this.playSound('./sounds/correct.mp3');
            $('#feedback').html(`<div class="correct">Correct! (${similarityPercent}% match) - (${this.currentCount}/${this.reps})</div>`);
            if (this.currentCount >= this.reps) {
                this.currentIndex = endIndex;
                this.currentCount = 0;
            }
        } else {
            this.playSound('./sounds/wrong.mp3');
            $('#feedback').html(`<div class="incorrect">Try again! (${similarityPercent}% match) <br>Detected: "${answer}"</div>`);
        }

        this.saveState();
        setTimeout(() => {
            if(this.currentIndex < this.words.length) {
                this.renderFullSentence();
                this.practiceStep();
            } else {
                this.finishSession();
            }
        }, 1200);
    }

    private advanceToNextPhrase(): void {
        if (this.isRecordingEnabled) {
            this.stopRecording();
        }
        const endIndex = this.getPhraseBounds(this.currentIndex, 3);
        this.currentIndex = endIndex;
        this.currentCount = 0;
        if (this.currentIndex >= this.words.length) {
            this.finishSession();
            return;
        }
        this.saveState();
        this.renderFullSentence();
        this.practiceStep();
    }

    private finishSession(): void {
        const messages = ["You nailed it!", "That was sharp!", "Boom!", "Bravo!", "That was smooth!", "Great shadowing!", "You crushed it!", "Smart move!", "Echo mastered.", "That was fire!"];
        const emojis = ["🔥", "🎯", "💪", "🎉", "🚀", "👏", "🌟", "🧠", "🎧", "💥"];
        let ttsMsg = messages[Math.floor(Math.random() * messages.length)];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        let displayMsg = `${emoji} ${ttsMsg}`;
        if (this.practiceMode === 'check') {
            const accuracy = this.attempts ? Math.round((this.correctCount / this.attempts) * 100) : 100;
            displayMsg += ` Your accuracy: ${accuracy}%.`;
            ttsMsg += ` Your accuracy: ${accuracy}%.`;
        }
        const callToActions = ["Let's Start Over!", "Go Again!", "Ready for Another Round?"];
        const callToAction = callToActions[Math.floor(Math.random() * callToActions.length)];
        ttsMsg += ` ${callToAction}`;
        this.playSound('./sounds/victory.mp3', 2);
        setTimeout(() => this.speak(ttsMsg), 1500);
        displayMsg += `<br><a class="btn btn-success mt-2" href="#" onclick="location.reload(); return false;">${callToAction}</a>`;
        $('#practiceArea').html(`<h2>${displayMsg}</h2>`);
        localStorage.removeItem(this.STORAGE_KEYS.index);
        localStorage.removeItem(this.STORAGE_KEYS.count);
        localStorage.removeItem(this.STORAGE_KEYS.correctCount);
        localStorage.removeItem(this.STORAGE_KEYS.attempts);
    }

    // --- Helper & Utility Methods ---

    private getStartOfCurrentPhrase(): number {
        let lastPuncIndex = -1;
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(this.words[i].slice(-1))) {
                lastPuncIndex = i;
                break;
            }
        }
        return lastPuncIndex >= 0 ? lastPuncIndex + 1 : 0;
    }

    private getPhraseBounds(startIndex: number, maxWords: number = 3): number {
        let endIndex = startIndex;
        let count = 0;
        while (endIndex < this.words.length && count < maxWords) {
            endIndex++;
            count++;
            if (/[.!?]/.test(this.words[endIndex - 1].slice(-1))) {
                break;
            }
        }
        return endIndex;
    }

    private pickSample(): string {
        return this.samples[Math.floor(Math.random() * this.samples.length)] || '';
    }

    private speak(text: string, onEnd?: (() => void) | null, rate: number = 1): void {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = rate;
        if (onEnd) {
            u.onend = onEnd;
        }
        speechSynthesis.speak(u);
    }

    private playSound(src: string, speed: number = 1): void {
        const audio = new Audio(src);
        audio.playbackRate = speed;
        audio.play();
    }

    private speakAndHighlight(text: string, onEnd?: (() => void) | null, speed: number = 1): void {
        const container = $('#sentence-container');
        container.empty();
        speechSynthesis.cancel();
        const phraseWords = text.split(' ');
        const wordSpans: HTMLElement[] = phraseWords.map(word => $('<span></span>').text(word).addClass('word')[0]);
        wordSpans.forEach((span, index) => {
            container.append(span);
            if(index < wordSpans.length - 1) container.append(' ');
        });

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = speed;

        if (this.isMobile) {
            const delayPerWord = 1000 / this.estimatedWordsPerSecond / speed;
            phraseWords.forEach((word, index) => {
                setTimeout(() => $(wordSpans[index]).addClass('highlighted'), index * delayPerWord);
            });
            let startTime: number;
            utterance.onstart = () => { startTime = performance.now(); };
            utterance.onend = () => {
                const duration = (performance.now() - startTime) / 1000;
                if (duration > 0.1) {
                    const currentWPS = phraseWords.length / duration;
                    this.estimatedWordsPerSecond = (this.estimatedWordsPerSecond * this.phrasesSpokenCount + currentWPS) / (this.phrasesSpokenCount + 1);
                    this.phrasesSpokenCount++;
                }
                if (onEnd) onEnd();
            };
        } else {
            const wordBoundaries: number[] = [];
            let charCounter = 0;
            phraseWords.forEach(word => {
                wordBoundaries.push(charCounter);
                charCounter += word.length + 1;
            });
            utterance.onboundary = (event: SpeechSynthesisEvent) => {
                if (event.name === 'word') {
                    let wordIndex = wordBoundaries.findIndex(boundary => event.charIndex < boundary) -1;
                    if(wordIndex === -2) wordIndex = wordBoundaries.length - 1; // Last word
                    $('.word.highlighted').removeClass('highlighted');
                    $(wordSpans[wordIndex]).addClass('highlighted');
                }
            };
            utterance.onend = () => { if (onEnd) onEnd(); };
        }
        speechSynthesis.speak(utterance);

        const userInput = $('#userInput') as JQuery<HTMLInputElement>;
        userInput.focus();
    }

    private cleanText(text: string): string {
        return this.removeJunkCharsFromText(text.toLowerCase().trim().replace("&", "and"));
    }

    private removeJunkCharsFromText(text: string): string {
        return text.replace(/^[\s.,;:/\\()[\]{}"'«»!?-]+|[\s.,;:/\\()[\]{}"'«»!?-]+$/g, '');
    }

    // --- Event Handler Implementations ---

    private startPractice(): void {
        this.practiceMode = ($('input[name="practiceMode"]:checked').val() as 'skip' | 'check');
        this.sentence = ($('#sentenceInput').val() as string).trim().replace(/([^\.\?\!\n])\n/g, '$1.\n');
        this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
        this.reps = parseInt(($('#repsSelect').val() as string));
        this.currentIndex = 0;
        this.currentCount = 0;
        this.correctCount = 0;
        this.attempts = 0;
        this.saveState();
        $('#configArea').addClass('d-none');
        $('#practiceArea').removeClass('d-none');
        this.setupPracticeUI();
        this.renderFullSentence();
        this.practiceStep();
    }

    private resetApp(): void {
        speechSynthesis.cancel();
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        localStorage.clear();
        location.reload();
    }

    private handleCheckOrNext(): void {

        this.checkAnswer();

        // if (this.practiceMode === 'check') {
        //     this.checkAnswer();
        // } else {
        //     this.advanceToNextPhrase();
        // }
    }

    private useSample(): void {
        this.sentence = this.pickSample();
        ($('#sentenceInput') as JQuery<HTMLTextAreaElement>).val(this.sentence);
        this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
        this.currentIndex = 0;
        this.renderSampleSentence();
        this.saveState();
    }

    private handleSampleWordClick(element: HTMLElement): void {
        const newIndex = $(element).data('index');
        if (typeof newIndex === 'number') {
            this.currentIndex = newIndex;
            this.renderSampleSentence();
            this.saveState();
        }
    }

    private handleRecordToggle(element: HTMLElement): void {
        this.isRecordingEnabled = $(element).is(':checked');
        localStorage.setItem(this.STORAGE_KEYS.recordAudio, String(this.isRecordingEnabled));
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

    // --- Recordings Modal Logic ---
    private async displayRecordings(): Promise<void> {
        if (!this.db) return;

        const transaction = this.db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        const allRecords: Recording[] = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as Recording[]);
            request.onerror = err => reject(err);
        });

        const grouped: Record<string, Recording[]> = {};
        allRecords.forEach(rec => {
            if (!grouped[rec.sentence]) {
                grouped[rec.sentence] = [];
            }
            grouped[rec.sentence].push(rec);
        });

        window.modalRecordings = grouped;

        const $list = $('#recordingsList');
        $list.empty();

        if (Object.keys(grouped).length === 0) {
            $list.html('<p class="text-center text-muted">No recordings found yet. Enable "Record my voice" and start practicing!</p>');
            return;
        }

        const sortedSentences = Object.keys(grouped).sort((a, b) => {
            const lastA = Math.max(...grouped[a].map(r => r.timestamp?.getTime() || 0));
            const lastB = Math.max(...grouped[b].map(r => r.timestamp?.getTime() || 0));
            return lastB - lastA;
        });

        for (const sentence of sortedSentences) {
            const recordings = grouped[sentence].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
            const truncated = this.truncateSentence(sentence);
            const uniqueId = sentence.hashCode();
            const lastRecTime = recordings[0].timestamp;
            const count = recordings.length;

            const sentenceHtml = `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-${uniqueId}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}" aria-expanded="false">
                        <div class="w-100 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
                            <span class="fw-bold mb-1 mb-sm-0">${truncated}</span>
                            <div class="d-flex align-items-center">
                                <span class="badge bg-secondary me-2">${count} recording${count > 1 ? 's' : ''}</span>
                                <small class="text-muted">${lastRecTime.toLocaleString()}</small>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#recordingsList" data-sentence="${sentence.replace(/"/g, '&quot;')}">
                    <div class="accordion-body">
                        <ul class="list-group">
                            ${recordings.map((rec, index) => `
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <span>Recording from ${rec.timestamp?.toLocaleString() || 'an old date'}</span>
                                    <span class="d-flex gap-2">
                                        <button class="btn btn-sm btn-primary play-user-audio" data-sentence="${sentence}" data-index="${index}">Play Mine</button>
                                        <button class="btn btn-sm btn-outline-secondary play-bot-audio" data-sentence="${sentence}">Play Bot</button>
                                    </span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
            $list.append(sentenceHtml);
        }
    }

    private truncateSentence(sentence: string): string {
        const words = sentence.split(' ');
        if (words.length > 4) {
            return `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`;
        }
        return sentence;
    }

    private playUserAudio(element: HTMLElement): void {
        this.stopAllPlayback(true);
        const sentence = $(element).data('sentence') as string;
        const index = $(element).data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];
        if (record && record.audio) {
            const audioUrl = URL.createObjectURL(record.audio);
            const audio = new Audio(audioUrl);
            this.currentlyPlayingAudioElement = audio;
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.currentlyPlayingAudioElement = null;
            };
            audio.play().catch(err => {
                console.error("Error playing audio:", err);
                URL.revokeObjectURL(audioUrl);
                this.currentlyPlayingAudioElement = null;
            });
        }
    }

    private playBotAudio(element: HTMLElement): void {
        this.stopAllPlayback(true);
        const sentence = $(element).data('sentence') as string;
        this.speak(sentence);
    }

    private stopAllPlayback(keepTTS: boolean = false): void {
        if (this.currentlyPlayingAudioElement) {
            this.currentlyPlayingAudioElement.pause();
            URL.revokeObjectURL(this.currentlyPlayingAudioElement.src);
            this.currentlyPlayingAudioElement = null;
        }
        if (!keepTTS) {
            speechSynthesis.cancel();
        }
    }
}


// =================================================================
// Application Entry Point
// =================================================================
$(function () {
    const app = new EchoTalkApp();
    app.init();
});