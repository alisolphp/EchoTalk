// --- Imports ---
// Main CSS and JS files for styling and functionality
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import $ from 'jquery';
import { Modal } from 'bootstrap';
import './../css/style.css';
import confetti from 'canvas-confetti';

// --- Type Definitions ---
// Define the structure for a recording object
interface Recording {
    sentence: string;
    audio: Blob;
    timestamp: Date;
}

// Define the structure for the new sample data
interface SentenceCategory {
    name: string;
    sentences: string[];
}

interface SentenceLevel {
    name: string;
    categories: SentenceCategory[];
}

interface SampleData {
    levels: SentenceLevel[];
}

// Extend global interfaces to add custom properties
declare global {
    interface Window {
        // Stores all recordings grouped by sentence
        modalRecordings: Record<string, Recording[]>;
        // Stores the PWA install prompt event
        deferredPrompt: any;
    }
    interface String {
        // A custom method to generate a hash from a string
        hashCode(): string;
    }
}

/**
 * A simple hash function to generate a unique ID from a string.
 * This is added as a method to the String prototype.
 */
String.prototype.hashCode = function(): string {
    let hash = 0, i: number, chr: number;
    // Return a default hash for empty strings
    if (this.length === 0) return 'h0';
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        // Convert to a 32-bit integer
        hash |= 0;
    }
    // Return a unique string with a prefix to avoid conflicts
    return 'h' + Math.abs(hash);
};
// =================================================================
// The Main Application Class
// =================================================================
export class EchoTalkApp {
    // --- Constants ---
    // Keys for storing data in localStorage to manage application state
    private readonly STORAGE_KEYS = {
        sentence: 'shadow_sentence',
        reps: 'shadow_reps',
        index: 'shadow_index',
        count: 'shadow_count',
        correctCount: 'shadow_correct',
        attempts: 'shadow_attempts',
        recordAudio: 'shadow_record_audio',
        speechRate: 'shadow_speech_rate',
        lang: 'shadow_language'
    };
    // --- State Properties ---
    private sentence: string = '';
    private words: string[] = [];
    private reps: number = 3;
    private currentIndex: number = 0;
    private currentCount: number = 0;
    private correctCount: number = 0;
    private attempts: number = 0;
    private samples: SampleData = { levels: [] };
    private currentPhrase: string = '';
    private isRecordingEnabled: boolean = false;
    private practiceMode: 'skip' | 'check' = 'skip';

    // --- Media & DB Properties ---
    private mediaRecorder: MediaRecorder | undefined;
    private stream: MediaStream | null = null;
    private db!: IDBDatabase;
    private currentlyPlayingAudioElement: HTMLAudioElement | null = null;

    // --- Audio Visualization Properties ---
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private visualizerFrameId: number | null = null;
    private visualizerActive: boolean = false;

    // --- Helper Properties ---
    private readonly isMobile: boolean = /Mobi|Android/i.test(navigator.userAgent);
    private estimatedWordsPerSecond: number = 2.5;
    private phrasesSpokenCount: number = 0;
    private speechRate: number = 1;
    private spellApiKey: string = '';
    private spellCheckerIsAvailable: boolean = false;
    private readonly languageMap: Record<string, string> = {
        'en-US': 'English (US)',
        'da-DK': 'Danish (DK)',
        'nl-NL': 'Dutch (NL)',
        'fr-FR': 'French (FR)',
        'de-DE': 'German (DE)',
        'it-IT': 'Italian (IT)',
        'es-ES': 'Spanish (ES)',
        'sv-SE': 'Swedish (SE)',
        'no-NO': 'Norwegian (NO)',
        'tr-TR': 'Turkish (TR)'
    };
    private lang: string; // Default: First in map (e.g., 'en-US')
    private langGeneral: string; // Default: First in map (e.g., 'English (US)')
    private defaultLevelName: string = "Intermediate (B1-B2)";
    private defaultCategoryName: string = "Interview";

    constructor() {
        const firstLangKey = Object.keys(this.languageMap)[0];
        this.lang = firstLangKey;
        this.langGeneral = this.languageMap[firstLangKey];

        window.modalRecordings = {};
        (window as any).app = this;
    }

    public async init(selector: string, value: string): Promise<void> {
        try {
            const sampleData = await this.fetchSamples();
            this.samples = sampleData;
            this.db = await this.initDB();

            this.setupLanguageOptions();
            this.setupRepOptions();
            this.setupSampleOptions();
            this.loadState();

            // Note: Disabled temporary because it's problematic in many devices:
            // const isLocalVoiceAvailable = await this.checkTTSVoice(this.lang);
            // if (!isLocalVoiceAvailable) {
            //     // If no local voice is found, show a warning to the user.
            //     this.showTTSWarning();
            // }

            this.updateLanguageUI();
            this.bindEvents();
            this.displayAppVersion();

            // If there's no saved sentence, pick a random one from samples
            if (!this.sentence) {
                this.sentence = this.pickSample();
            }

            this.setInputValue(this.sentence);
            this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
            ($('#repsSelect') as JQuery<HTMLSelectElement>).val(this.reps.toString());
            this.renderSampleSentence();
            this.setInputValue('');

            this.registerServiceWorker();

            this.handleHashChange();
            await this.checkSpellApiKey();
        } catch (error) {
            console.error("Initialization failed:", error);
            // Display an error message if initialization fails
            $('#configArea').html('<div class="alert alert-danger">Failed to initialize the application. Please refresh the page.</div>');
        }
    }

    private async checkSpellApiKey(): Promise<void> {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const apiKey = urlParams.get('spellApiKey');

            if (apiKey) {
                this.spellApiKey = apiKey;
                const response = await fetch(`https://alisol.ir/Projects/GetAccuracyFromRecordedAudio/?action=checkAPIKey&spellApiKey=${this.spellApiKey}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success' && result.message === 'api_key_is_valid') {
                        this.spellCheckerIsAvailable = true;
                        console.log('Spell checker API key is valid and available.');
                    }
                }
            }
        } catch (error) {
            console.error('Error validating spell checker API key:', error);
        }
    }

    private async resetWithoutReload(): Promise<void> {
        // Stop any ongoing recording to release the microphone.
        await this.stopRecording();

        this.terminateMicrophoneStream();

        // Stop all ongoing audio playback, including TTS.
        this.stopAllPlayback();

        // Reset all internal state properties to their initial values.
        // We intentionally do not clear localStorage here.
        this.sentence = '';
        this.words = [];
        this.reps = parseInt(localStorage.getItem(this.STORAGE_KEYS.reps) || this.reps.toString());
        this.currentIndex = 0;
        this.currentCount = 0;
        this.correctCount = 0;
        this.attempts = 0;
        this.phrasesSpokenCount = 0;

        // Reset the UI to the initial configuration state.
        $('#practiceArea').addClass('d-none');
        $('#configArea').removeClass('d-none');
        $('#backHomeButton').addClass('d-none').removeClass('d-inline-block');
        $('#feedback-text').html('');
        $('#sentence-container').html('');
        $('#fullSentence').html('').addClass('d-none');

        // Reload the state from localStorage to use the previously saved sentence and settings.
        this.loadState();

        // Note: Disabled temporary because it's problematic in many devices:
        // const isLocalVoiceAvailable = await this.checkTTSVoice(this.lang);
        // if (!isLocalVoiceAvailable) {
        //     // If no local voice is found, show a warning to the user.
        //     this.showTTSWarning();
        // }

        this.updateLanguageUI();

        // Re-initialize the words array from the loaded sentence.
        this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);

        // Update the UI with the loaded state and sentence.
        this.setInputValue(this.sentence);
        this.setInputValue('');
        this.renderSampleSentence();

        console.log("Application reset to saved state without reloading the page.");
    }

    private registerServiceWorker(): void {
        if ('serviceWorker' in navigator) {
            // Vite PWA Plugin automatically places the sw.js file at the root of the build output
            navigator.serviceWorker.register('./sw.js').then(registration => {
                // console.log('Service Worker registered with scope:', registration.scope);
            }).catch(error => {
                console.error('Service Worker registration failed:', error);
            });
        }
    }

    private bindEvents(): void {
        // Binds all UI events to their corresponding methods
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
        $('#recordingsList').on('click', '.prepare-for-ai', (e) => this.prepareForAIAnalysis(e.currentTarget));
        $('#recordingsList').on('click', '.check-accuracy-btn', (e) => this.getPronunciationAccuracy(e.currentTarget));
        $('#recordingsModal').on('hidden.bs.modal', () => this.stopAllPlayback());
        $('#languageSelect, #headerLanguageSelect').on('change', (e) => {
            const newLang = $(e.currentTarget).val() as string;
            // Sync both selects
            $('#languageSelect, #headerLanguageSelect').val(newLang);
            // Call the main handler function
            this.handleLanguageChange();
        });
        $('#levelSelect').on('change', () => {
            this.populateCategories();
            this.useSample();
        });
        $('#sentenceInput').on('change', function () {
            $(this).attr('data-val', $(this).val());
        });
        $('#categorySelect').on('change', () => this.useSample());
        $('#backHomeButton').on('click', () => history.back());

        $('#speechRateSelect').on('change', (e) => {
            const val = parseFloat($(e.currentTarget).val() as string);
            this.speechRate = isNaN(val) ? 1 : val;
            localStorage.setItem(this.STORAGE_KEYS.speechRate, this.speechRate.toString());

            // sample sentences for each rate:
            const sampleSentences: Record<number, string> = {
                0.6: "I’m taking my time… like a turtle on vacation.",
                0.8: "Just strolling through the words—steady and clear.",
                1.0: "This is my natural pace. Feels just right, doesn’t it?",
                1.2: "Okay, I’m picking up the pace—keep up if you can!",
                1.4: "Blink and you’ll miss it—I’m in turbo mode!"
            };

            // play sample sentence with selected rate:
            const sentence = sampleSentences[val];
            if (sentence) {
                this.speak(sentence, null, val);
            }
        });


        // Hide the install button if the app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            $('#installBtn').addClass('d-none');
        }

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

        window.addEventListener('hashchange', () => this.handleHashChange());

        document.addEventListener('show.bs.modal', () => {
            if (window.location.hash !== '#modal') {
                window.location.hash = 'modal';
            }
        });

        document.addEventListener('hidden.bs.modal', () => {
            // Only run this logic if a modal was just closed and the hash is still '#modal'
            if (window.location.hash === '#modal') {
                // Get current URL without the hash part
                const urlWithoutHash = window.location.pathname + window.location.search; // Replace the current history state to clean up the URL without navigating
                history.replaceState(null, '', urlWithoutHash);
            }
        });

        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    }

    private handleVisibilityChange(): void {
        // When the tab becomes hidden (user switches apps or tabs), stop the recording.
        if (document.visibilityState === 'hidden') {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                console.log('Tab is hidden, stopping recording to release microphone.');
                this.stopRecording();
                this.terminateMicrophoneStream();
            }
        }
    }

    private handleHashChange(): void {
        const hash = window.location.hash;
        const openModal = document.querySelector('.modal.show') as HTMLElement;
        const isPracticeVisible = !$('#practiceArea').hasClass('d-none');

        if (hash !== '#modal' && openModal) {
            const modalInstance = Modal.getInstance(openModal);
            if (modalInstance) {
                openModal.addEventListener('hidden.bs.modal', () => {
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                }, { once: true });
                modalInstance.hide();
            }
        }
        else if (hash !== '#practice' && isPracticeVisible && hash !== '#modal') {
            this.resetWithoutReload();
        }
    }

    private setInputValue(value: string) {
        const $el = $('#sentenceInput');
        $el.val(value);
        if (value.trim() !== '') {
            $el.attr('data-val', value.trim());
        }
        $el.trigger('input');
    }

    private setupSampleOptions(): void {
        const $levelSelect = $('#levelSelect');
        $levelSelect.empty();

        // Populate the level dropdown
        this.samples.levels.forEach((level, index) => {
            $levelSelect.append(`<option value="${index}">${level.name}</option>`);
        });

        const defaultLevelIndex = this.samples.levels.findIndex(l => l.name === this.defaultLevelName);

        // Load saved level or set default
        const savedLevelIndex = parseInt(localStorage.getItem('selectedLevelIndex') || '-1');
        if (savedLevelIndex !== -1 && this.samples.levels[savedLevelIndex]) {
            $levelSelect.val(savedLevelIndex.toString());
        } else if (defaultLevelIndex !== -1) {
            $levelSelect.val(defaultLevelIndex.toString());
        } else {
            $levelSelect.val('0'); // Fallback to first level
        }

        // Populate categories based on the selected level
        this.populateCategories();
    }

    private setupLanguageOptions(): void {
        const $languageSelects = $('#languageSelect, #headerLanguageSelect');
        $languageSelects.empty();
        for (const [code, name] of Object.entries(this.languageMap)) {
            $languageSelects.append(`<option value="${code}">${name}</option>`);
        }

        $languageSelects.val(this.lang);
    }

    /**
     * Handles the entire process of switching the application's practice language.
     * This is triggered when the user selects a new language from the dropdown in the options modal.
     * The process involves fetching new data, updating the UI, and loading a new sample sentence.
     */
    private async handleLanguageChange(): Promise<void> {
        try {
            // Step 1: Get the newly selected language, save it to the state, and update the UI.
            const $languageSelect = $('#languageSelect') as JQuery<HTMLSelectElement>;
            this.lang = $languageSelect.val() as string;
            this.saveState();

            // Note: Disabled temporary because it's problematic in many devices:
            // const isLocalVoiceAvailable = await this.checkTTSVoice(this.lang);
            // if (!isLocalVoiceAvailable) {
            //     // If no local voice is found, show a warning to the user.
            //     this.showTTSWarning();
            // }

            this.updateLanguageUI();

            // Step 2: Asynchronously fetch the sample sentences for the selected language.
            // This replaces the existing `this.samples` with the new content (e.g., from 'sentences-nl-NL.json').
            this.samples = await this.fetchSamples();

            // Step 3: Re-populate the level and category dropdowns based on the newly fetched data.
            this.setupSampleOptions();

            // Step 4: Pick and display a new random sample sentence to immediately reflect the language change.
            this.useSample();

        } catch (error) {
            console.error("Failed to load new language data:", error);
            // In case of a network or file error, display a user-friendly message.
            $('#configArea').html('<div class="alert alert-danger">Failed to load language data. Please refresh the page.</div>');
        }
    }

    private updateLanguageUI() {
        this.updateLanguageGeneral();
        $('.current-language-general-name').text(this.langGeneral);
        $('#languageSelect, #headerLanguageSelect').val(this.lang);
    }

    private updateLanguageGeneral() {
        this.langGeneral = this.languageMap[this.lang] || 'English'
    }

    /**
     * Checks if a local (offline) TTS voice is available for the given language.
     * This version includes a timeout to avoid false negatives on slow-loading voice lists.
     * @param {string} lang - The language code to check (e.g., 'en-US').
     * @returns {Promise<boolean>} - A promise that resolves to true if a local voice is found, false otherwise.
     */
    private checkTTSVoice(lang: string): Promise<boolean> {
        return new Promise((resolve) => {
            let timeoutId: number | null = null;

            const findVoice = () => {
                // If this function is triggered (e.g., by onvoiceschanged), clear the fallback timeout
                // to prevent it from resolving the promise prematurely.
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                const voices = speechSynthesis.getVoices();

                // If the voice list is populated, we can perform a definitive check and resolve the promise.
                if (voices.length > 0) {
                    const hasLocalVoice = voices.some(voice => voice.lang === lang && voice.localService);
                    resolve(hasLocalVoice);
                    return;
                }
                // If the list is still empty, we wait for the 'onvoiceschanged' event to call this function again.
            };

            // The 'onvoiceschanged' event fires when the list of TTS voices has been loaded and is ready.
            speechSynthesis.onvoiceschanged = () => findVoice();

            // Attempt an immediate check in case the voices are already available in the browser cache.
            findVoice();

            // Set a fallback timeout. This handles browsers or situations where 'onvoiceschanged' may not fire reliably.
            timeoutId = setTimeout(() => {
                const voices = speechSynthesis.getVoices();
                if (voices.length === 0) {
                    // If the list is still empty after the delay, resolve with 'true' to avoid a false-negative warning.
                    // This assumes a voice is available, preventing a poor user experience due to a race condition.
                    console.warn('TTS voice list did not populate in time, assuming a voice is available.');
                    resolve(true);
                } else {
                    // If the list populated within the timeout window, perform the final, definitive check.
                    const hasLocalVoice = voices.some(voice => voice.lang === lang && voice.localService);
                    resolve(hasLocalVoice);
                }
            }, 500);
        });
    }

    private showTTSWarning(): void {
        // Make sure the language name in the modal is up-to-date
        $('.current-language-general-name').text(this.langGeneral);

        const modalElement = document.getElementById('ttsWarningModal');
        if (modalElement) {
            const modal = new Modal(modalElement);
            modal.show();
        }
    }

    private populateCategories(): void {
        const $levelSelect = $('#levelSelect') as JQuery<HTMLSelectElement>;
        const $categorySelect = $('#categorySelect');
        const selectedLevelIndex = parseInt($levelSelect.val() as string);

        // Save the selected level
        localStorage.setItem('selectedLevelIndex', selectedLevelIndex.toString());

        $categorySelect.empty();
        const categories = this.samples.levels[selectedLevelIndex].categories;
        categories.forEach((category, index) => {
            $categorySelect.append(`<option value="${index}">${category.name} (${category.sentences.length})</option>`);
        });

        const defaultCategoryIndex = categories.findIndex(c => c.name === this.defaultCategoryName);

        // Load saved category or set default
        const savedCategoryIndex = parseInt(localStorage.getItem('selectedCategoryIndex') || '-1');
        if (savedCategoryIndex !== -1 && categories[savedCategoryIndex]) {
            $categorySelect.val(savedCategoryIndex.toString());
        } else if (defaultCategoryIndex !== -1) {
            $categorySelect.val(defaultCategoryIndex.toString());
        } else {
            $categorySelect.val('0'); // Fallback to first category
        }
    }

    // Populates the "Reps" dropdown with specific options (1, 2, 3, 5, 10, 20)
    private setupRepOptions(): void {
        for (let i = 1; i <= 20; i++) {
            if ([1, 2, 3, 5, 10, 20].includes(i)) {
                $('#repsSelect').append(`<option value="${i}">${i}</option>`);
            }
        }
    }

    // --- State & Data Management ---

    private loadState(): void {
        // Loads application state from localStorage
        this.sentence = localStorage.getItem(this.STORAGE_KEYS.sentence) || '';
        this.reps = parseInt(localStorage.getItem(this.STORAGE_KEYS.reps) || this.reps.toString());
        this.currentIndex = parseInt(localStorage.getItem(this.STORAGE_KEYS.index) || '0');
        this.currentCount = parseInt(localStorage.getItem(this.STORAGE_KEYS.count) || '0');
        this.correctCount = parseInt(localStorage.getItem(this.STORAGE_KEYS.correctCount) || '0');
        this.attempts = parseInt(localStorage.getItem(this.STORAGE_KEYS.attempts) || '0');
        this.isRecordingEnabled = localStorage.getItem(this.STORAGE_KEYS.recordAudio) === 'true';
        $('#recordToggle').prop('checked', this.isRecordingEnabled);
        this.lang = localStorage.getItem(this.STORAGE_KEYS.lang) || 'en-US';
        ($('#languageSelect') as JQuery<HTMLSelectElement>).val(this.lang);

        // Load saved level and category, or set defaults
        const savedLevelIndex = localStorage.getItem('selectedLevelIndex');
        const savedCategoryIndex = localStorage.getItem('selectedCategoryIndex');

        const savedRate = parseFloat(localStorage.getItem(this.STORAGE_KEYS.speechRate) || '1');
        this.speechRate = isNaN(savedRate) ? 1 : savedRate;
        $('#speechRateSelect').val(this.speechRate.toString());


        if (savedLevelIndex) {
            ($('#levelSelect') as JQuery<HTMLSelectElement>).val(savedLevelIndex);
        }
        if (savedCategoryIndex) {
            ($('#categorySelect') as JQuery<HTMLSelectElement>).val(savedCategoryIndex);
        }
    }

    private saveState(): void {
        // Saves the current application state to localStorage
        localStorage.setItem(this.STORAGE_KEYS.sentence, this.sentence);
        localStorage.setItem(this.STORAGE_KEYS.reps, this.reps.toString());
        localStorage.setItem(this.STORAGE_KEYS.index, this.currentIndex.toString());
        localStorage.setItem(this.STORAGE_KEYS.count, this.currentCount.toString());
        localStorage.setItem(this.STORAGE_KEYS.correctCount, this.correctCount.toString());
        localStorage.setItem(this.STORAGE_KEYS.attempts, this.attempts.toString());
        localStorage.setItem(this.STORAGE_KEYS.speechRate, this.speechRate.toString());
        localStorage.setItem(this.STORAGE_KEYS.lang, this.lang.toString());
    }

    private fetchSamples(): Promise<SampleData> {
        // Fetches a list of sample sentences from a JSON file
        return $.getJSON(`./data/sentences/sentences-${this.lang}.json`);
    }

    private initDB(): Promise<IDBDatabase> {
        // Initializes the IndexedDB for storing recordings
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EchoTalkDB', 1);
            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                // Create the 'recordings' object store if it doesn't exist
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

    private async initializeMicrophoneStream(): Promise<void> {
        if (!this.isRecordingEnabled || this.stream) {
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('#feedback-text').html('<div class="incorrect">Your browser does not support audio recording.</div>');
            console.error("Audio recording is not supported.");
            return;
        }

        try {
            const constraints: MediaStreamConstraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: true,

                    autoGainControl: true
                }
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            // --- Setup for audio visualization ---
            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(this.stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            // We don't connect analyser to destination to avoid feedback

            const options = { mimeType: 'audio/ogg; codecs=opus' };
            this.mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType) ?
                new MediaRecorder(this.stream, options) : new MediaRecorder(this.stream);

            let localAudioChunks: Blob[] = [];
            this.mediaRecorder.ondataavailable = event => {
                localAudioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(localAudioChunks, { type: this.mediaRecorder?.mimeType });
                if (audioBlob.size > 0) {
                    this.saveRecording(audioBlob, this.currentPhrase);
                }
                localAudioChunks = [];
            };
        } catch (err) {
            console.error('Error accessing microphone:', err);
            $('#feedback-text').html('<div class="incorrect">Could not access microphone. Please grant permission.</div>');
            this.isRecordingEnabled = false;
            $('#recordToggle').prop('checked', false);
        }
    }

    private terminateMicrophoneStream(): void {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.mediaRecorder = undefined;

            // Stop animation and close AudioContext
            if (this.visualizerFrameId) {
                cancelAnimationFrame(this.visualizerFrameId);
                this.visualizerFrameId = null;
            }
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
                this.audioContext = null;
            }

            console.log("Microphone stream terminated.");
        }
    }

    private saveRecording(blob: Blob, sentenceText: string): void {
        // Saves an audio blob to the IndexedDB
        if (!this.db || blob.size === 0) return;
        const transaction = this.db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const record: Recording = { sentence: sentenceText, audio: blob, timestamp: new Date() };
        const request = store.add(record);
        request.onsuccess = () => console.log('Recording saved successfully.');
        request.onerror = (err) => console.error('Error saving recording:', err);
    }

    private async startRecording(): Promise<void> {
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            this.mediaRecorder.start();
            $('#feedback-text').html('Speak aloud...').addClass('recording-text-indicator');
            this.monitorAudioLevel();
        }
    }

    private stopRecording(): Promise<void> {
        // Stop the visualizer animation loop
        if (this.visualizerFrameId) {
            cancelAnimationFrame(this.visualizerFrameId);
            this.visualizerFrameId = null;
        }

        // Reset visualizer state immediately
        const visualizerElement = document.getElementById('soundWaveVisualizer');
        if (visualizerElement) {
            visualizerElement.classList.remove('active');
            const randomHeight = 0;
            visualizerElement.style.height = `${randomHeight}vh`;
        }
        this.visualizerActive = false;

        $('#feedback-text').html('').removeClass('recording-text-indicator');

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

    private monitorAudioLevel(): void {
        if (!this.analyser) return;

        const visualizerElement = document.getElementById('soundWaveVisualizer');
        if (!visualizerElement) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const threshold = 20; // Sensitivity threshold for detecting sound

        const checkSound = () => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);

            // Calculate average energy
            const energy = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;

            if (energy > threshold) {
                // Sound detected: transition to active state
                if (!this.visualizerActive) {
                    this.visualizerActive = true;
                    visualizerElement.classList.add('active');

                    // Set random height as requested
                    const randomHeight = 40 + Math.random() * 10; // Random height between 30vh and 40vh
                    visualizerElement.style.height = `${randomHeight}vh`;
                }
            } else {
                // No sound detected: transition back to idle state
                if (this.visualizerActive) {
                    this.visualizerActive = false;
                    visualizerElement.classList.remove('active');
                    const randomHeight = 0;
                    visualizerElement.style.height = `${randomHeight}vh`;
                }
            }
            this.visualizerFrameId = requestAnimationFrame(checkSound);
        };
        checkSound();
    }

    private renderSampleSentence(): void {
        // Renders the sentence for 'sample mode'
        $('#sampleSentence').empty();
        this.words.forEach((w, i) => {
            const cls = i === this.currentIndex ? 'current-word' : '';
            $('#sampleSentence').append(`<span data-index="${i}" class="${cls}">${w}</span> `);
        });
    }

    private renderFullSentence(): void {
        // Renders the full sentence for 'practice mode', highlighting the current section
        $('#fullSentence').empty();
        let lastPunctuationIndex = -1;
        // Find the start of the current phrase based on punctuation
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(this.words[i].slice(-1))) {
                lastPunctuationIndex = i;
                break;
            }
        }
        const startIndex = lastPunctuationIndex >= 0 ? lastPunctuationIndex + 1 : 0;
        this.words.forEach((w, i) => {
            let cls = '';
            // Dim the words that have already been practiced
            if (i < startIndex) cls = 'text-muted';
            else if (i === this.currentIndex) cls = 'current-word';
            $('#fullSentence').append(`<span class="${cls}">${w}</span> `);
        });
    }

    private setupPracticeUI(): void {
        const userInputGroup = $('#userInput').parent();
        // Adjust the UI based on the selected practice mode ('check' or 'skip')
        if (this.practiceMode === 'check') {
            $('#instructionText').text('Now it’s your turn. Tap the mic icon on your keyboard and speak the word.').show();
            userInputGroup.show();
            $('#userInput').trigger('focus');
            $('#checkBtn').text('Check/Skip');
        } else { // 'skip' mode
            $('#instructionText').text('Listen, repeat to yourself, then click "Next Step".').show();
            userInputGroup.hide();
            $('#checkBtn').html('<i class="bi bi-skip-forward-fill"></i> Next Step');
        }
    }

    // --- Core Logic Methods ---

    private practiceStep(speed: number = 1): void {
        // Main function to advance the practice session
        if (this.currentIndex >= this.words.length) {
            this.finishSession();
            return;
        }
        // Get the boundaries of the current phrase (up to 3 words or until punctuation)
        const endIndex = this.getPhraseBounds(this.currentIndex, 3);
        const startIndex = this.getStartOfCurrentPhrase();
        const phrase = this.words.slice(startIndex, endIndex).join(' ');
        this.currentPhrase = this.removeJunkCharsFromText(phrase);

        if (this.isRecordingEnabled) {
            const listeningMessages = [
                '👂 Listen carefully...',
                '🎧 Time to focus and listen!',
                '🔊 Pay close attention...',
                '👀 Just listen...',
                '🌊 Let the sound flow in...',
                '🧘 Stay calm, stay focused...',
                '📡 Receiving the signal...',
                '🎶 Tune in to the rhythm...'
            ];
            const randomMessage = listeningMessages[Math.floor(Math.random() * listeningMessages.length)];
            $('#feedback-text').html(`<div class="listening-indicator">${randomMessage}</div>`);
        } else {
            $('#feedback-text').html('');
        }

        const startRecordingCallback = () => {
            if (this.isRecordingEnabled) {
                setTimeout(() => {
                    this.startRecording();
                }, 50);
            }
        };

        this.speakAndHighlight(phrase, this.isRecordingEnabled ? startRecordingCallback : null, speed);

        // Add a click event to each word to look up its meaning or other options
        $('#sentence-container').off('click', '.word').on('click', '.word', (e) => this.showWordActionsModal(e.currentTarget));
    }

    private showWordActionsModal(element: HTMLElement): void {
        const word = $(element).text().trim().replace(/[.,!?;:"'(){}[\]]/g, '');
        if (!word) return;

        // Set the modal title to the word
        $('#wordActionsModalLabel').text(`Word: ${word}`);

        // Update the links for Google search
        const encodedWord = encodeURIComponent(word);
        $('#searchPronunciationLink').attr('href', `https://www.google.com/search?q=pronunciation:+${encodedWord}`);
        $('#searchMeaningLink').attr('href', `https://www.google.com/search?q=meaning:+${encodedWord}`);
        $('#searchExamplesLink').attr('href', `https://www.google.com/search?q=${encodedWord}+in+a+sentence`);
        $('#searchSentenceMeaningLink').on('click', () => {
            this.openTranslate(this.currentPhrase);
        });

        // Handle the "Play Word" button click
        $('#playWordBtn').off('click').on('click', () => {
            this.speak(word);
        });

        this.speak(word);

        // Show the modal
        const modalElement = document.getElementById('wordActionsModal');
        if (modalElement) {
            const modal = new Modal(modalElement);
            modal.show();
        }
    }

    private openTranslate(text) {
        const url = "https://translate.google.com/?sl=auto&tl=auto"
            + "&op=translate&text="
            + encodeURIComponent(text);

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

    private async checkAnswer(): Promise<void> {
        // Checks the user's spoken answer against the target phrase
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
            // Handle cases where the user just presses enter without speaking
            if (this.currentCount >= this.reps) {
                if (this.practiceMode === 'check') {
                    if (this.reps >= 2) {
                        $('#feedback-text').html(`<div class="correct">(0 of ${this.reps} attempts)</div>`);
                    }
                    setTimeout(() => this.advanceToNextPhrase(), 1200); // Delay only in check mode
                } else {
                    this.advanceToNextPhrase(); // Instant in skip mode
                }
            } else {
                if(this.reps >= 2) {
                    $('#feedback-text').html(`<div class="correct">(${this.currentCount} of ${this.reps} attempts)</div>`);
                }
                this.practiceStep();
            }
            return;
        }

        userInput.val('');
        this.attempts++;
        // Calculate similarity to provide feedback
        const similarity = this.calculateWordSimilarity(target, answer);
        const similarityPercent = Math.round(similarity * 100);

        if (similarity >= 0.6) {
            this.correctCount++;
            this.playSound('./sounds/correct.mp3', 1, 0.6);
            $('#feedback-text').html(`<div class="correct">Correct! (${similarityPercent}% match) - (${this.currentCount}/${this.reps})</div>`);
            if (this.currentCount >= this.reps) {
                // Advance to the next phrase if the repetition count is met
                this.currentIndex = endIndex;
                this.currentCount = 0;
            }
        } else {
            this.playSound('./sounds/wrong.mp3', 1, 0.6);
            $('#feedback-text').html(`<div class="incorrect">Try again! (${similarityPercent}% match) <br>Detected: "${answer}"</div>`);
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
        // Moves the practice session to the next phrase
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

    private triggerCelebrationAnimation(): void {
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;

        (function frame() {
            // launch a few confetti from the left edge
            confetti({
                particleCount: 7,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 1 }
            });
            // and launch a few from the right edge
            confetti({
                particleCount: 7,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 1 }
            });

            // keep going until the time is up
            if (Date.now() < animationEnd) {
                requestAnimationFrame(frame);
            }
        }());
    }

    private finishSession(): void {
        this.terminateMicrophoneStream();
        this.triggerCelebrationAnimation(); // <-- This is the new line
        // Displays a celebratory message and ends the practice session
        const messages = ["You nailed it!", "That was sharp!", "Boom!", "Bravo!", "That was smooth!", "Great shadowing!", "You crushed it!", "Smart move!", "Echo mastered.", "That was fire!"];
        const emojis = ["🔥", "🎯", "💪", "🎉", "🚀", "👏", "🌟", "🧠", "🎧", "💥"];
        let ttsMsg = messages[Math.floor(Math.random() * messages.length)];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        let displayMsg = `${emoji} ${ttsMsg}`;
        if (this.practiceMode === 'check') {
            const accuracy = this.attempts ?
                Math.round((this.correctCount / this.attempts) * 100) : 100;
            displayMsg += ` Your accuracy: ${accuracy}%.`;
            ttsMsg += ` Your accuracy: ${accuracy}%.`;
        }
        const callToActions = ["Let's Start Over!", "Go Again!", "Ready for Another Round?"];
        const callToAction = callToActions[Math.floor(Math.random() * callToActions.length)];
        ttsMsg += ` ${callToAction}`;
        this.playSound('./sounds/victory.mp3', 2.5, 0.6);
        setTimeout(() => this.speak(ttsMsg, null, 1.3), 1100);
        // Show a button to restart the session
        displayMsg += `<br><a class="btn btn-success mt-2" href="#" onclick="app.resetWithoutReload(); return false;">${callToAction}</a>`;
        // Hide the practice UI and show the completion message
        $('#practice-ui-container').addClass('d-none');
        $('#session-complete-container').html(`<h2>${displayMsg}</h2>`).removeClass('d-none');
        // Clear session-specific state from localStorage
        localStorage.removeItem(this.STORAGE_KEYS.index);
        localStorage.removeItem(this.STORAGE_KEYS.count);
        localStorage.removeItem(this.STORAGE_KEYS.correctCount);
        localStorage.removeItem(this.STORAGE_KEYS.attempts);
        // Hide the back home button
        $('#backHomeButton').addClass('d-none');
        $('#backHomeButton').removeClass('d-inline-block');
    }

    // --- Helper & Utility Methods ---

    private getStartOfCurrentPhrase(): number {
        // Finds the index of the first word in the current phrase by looking for punctuation
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
        // Determines the end index of the current phrase (up to maxWords or a punctuation mark)
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
        const savedLevelIndex = parseInt(localStorage.getItem('selectedLevelIndex') || '0');
        const savedCategoryIndex = parseInt(localStorage.getItem('selectedCategoryIndex') || '0');

        const levels = this.samples.levels;
        if (levels.length === 0) return '';

        const level = levels[savedLevelIndex];
        if (!level) return '';

        const categories = level.categories;
        if (categories.length === 0) return '';

        const category = categories[savedCategoryIndex];
        if (!category) return '';

        const sentences = category.sentences;
        if (sentences.length === 0) return '';

        // Selects a random sentence from the chosen category
        return sentences[Math.floor(Math.random() * sentences.length)];
    }

    private speak(text: string, onEnd?: (() => void) | null, rate: null|number = null): void {
        // Uses the SpeechSynthesis API to speak the provided text
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.lang;
        u.rate = typeof rate === 'number' ? rate : this.speechRate;
        if (onEnd) {
            u.onend = onEnd;
        }
        speechSynthesis.speak(u);
    }

    private playSound(src: string, speed: number = 1, volume: number = 1): void {
        // Plays a sound from a given source with speed and volume control
        const audio = new Audio(src);
        audio.playbackRate = speed;
        audio.volume = Math.max(0, Math.min(volume, 1)); // Clamp between 0 and 1
        audio.play();
    }

    private speakAndHighlight(text: string, onEnd?: (() => void) | null, speed: number = 1): void {
        const container = $('#sentence-container');
        container.empty();
        speechSynthesis.cancel();
        const phraseWords = text.split(' ');
        const wordSpans: HTMLElement[] = phraseWords.map(word => $('<span></span>').text(word).addClass('word')[0]);
        // Add each word as a span to the container
        wordSpans.forEach((span, index) => {
            container.append(span);
            if(index < wordSpans.length - 1) container.append(' ');
        });
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang;
        utterance.rate = speed * this.speechRate;
        if (this.isMobile) {
            // For mobile, estimate word boundaries based on calculated WPM
           const delayPerWord = 900 / (this.estimatedWordsPerSecond * speed)
            phraseWords.forEach((word, index) => {
                setTimeout(() => $(wordSpans[index]).addClass('highlighted'), index * delayPerWord);
            });
            let startTime: number;
            utterance.onstart = () => { startTime = performance.now(); };
            utterance.onend = () => {
                const duration = (performance.now() - startTime) / 1000;
                // Recalculate estimated WPM for better accuracy
                if (duration > 0.1) {
                    const currentWPS = phraseWords.length / duration;
                    this.estimatedWordsPerSecond = (this.estimatedWordsPerSecond * this.phrasesSpokenCount + currentWPS) / (this.phrasesSpokenCount + 1);
                    this.phrasesSpokenCount++;
                }
                if (onEnd) onEnd();
            };
        } else {
            // For desktop, use the onboundary event for precise highlighting
            const wordBoundaries: number[] = [];
            let charCounter = 0;
            phraseWords.forEach(word => {
                wordBoundaries.push(charCounter);
                charCounter += word.length + 1;
            });
            utterance.onboundary = (event: SpeechSynthesisEvent) => {
                if (event.name === 'word') {
                    // Find the index of the word that is currently being spoken
                    let wordIndex = wordBoundaries.findIndex(boundary => event.charIndex < boundary) -1;
                    if(wordIndex === -2) wordIndex = wordBoundaries.length - 1; // Last word
                    $('.word.highlighted').removeClass('highlighted');
                    $(wordSpans[wordIndex]).addClass('highlighted');
                }
            };
            utterance.onend = () => { if (onEnd) onEnd(); };
        }
        speechSynthesis.speak(utterance);
        // Automatically focus the input field for the user
        const userInput = $('#userInput') as JQuery<HTMLInputElement>;
        userInput.focus();
    }

    private cleanText(text: string): string {
        // Prepares text for comparison by cleaning and normalizing it
        return this.removeJunkCharsFromText(text.toLowerCase().trim().replace("&", "and"));
    }

    private removeJunkCharsFromText(text: string): string {
        // Removes leading/trailing punctuation and whitespace
        return text.replace(/^[\s.,;:/\\()[\]{}"'«»!?-]+|[\s.,;:/\\()[\]{}"'«»!?-]+$/g, '');
    }

    // --- Event Handler Implementations ---

    private async startPractice(): Promise<void> {
        // Handles the start of a new practice session
        this.practiceMode = ($('input[name="practiceMode"]:checked').val() as 'skip' | 'check');
        const rawVal = $('#sentenceInput').attr('data-val');
        this.sentence = (typeof rawVal === 'string' ? rawVal.trim() : '').replace(/([^\.\?\!\n])\n/g, '$1.\n');
        this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
        this.reps = parseInt(($('#repsSelect').val() as string));
        this.currentCount = 0;
        this.correctCount = 0;
        this.attempts = 0;
        this.saveState();

        // Reset UI visibility before showing the practice area
        $('#session-complete-container').addClass('d-none').empty();
        $('#practice-ui-container').removeClass('d-none');

        $('#configArea').addClass('d-none');
        $('#practiceArea').removeClass('d-none');

        // Show back home button and full sentence display
        $('#backHomeButton').removeClass('d-none');
        $('#backHomeButton').addClass('d-inline-block');

        await this.initializeMicrophoneStream();
        this.setupPracticeUI();
        this.renderFullSentence();
        this.practiceStep();

        location.hash = 'practice';
    }

    private resetApp(): void {
        // Resets the entire application to its initial state
        speechSynthesis.cancel();
        this.terminateMicrophoneStream();

        // Check if the database connection exists
        if (!this.db) {
            console.error("Database connection not available for reset.");
            // Fallback to original behavior if DB is not initialized
            localStorage.clear();
            this.resetWithoutReload();
            return;
        }

        // Create a transaction to clear the recordings object store
        const transaction = this.db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const clearRequest = store.clear();

        // On successful clearing of the database
        clearRequest.onsuccess = () => {
            console.log("All recordings have been deleted from IndexedDB.");
            // Now, clear localStorage and reload the page
            localStorage.clear();
            location.reload();
        };

        // If an error occurs during clearing
        clearRequest.onerror = (event) => {
            console.error("Error deleting recordings from IndexedDB:", (event.target as IDBRequest).error);
            // As a fallback, still clear local storage and reload to reset settings
            localStorage.clear();
            location.reload();
        };

    }

    private handleCheckOrNext(): void {
        // This method is now simplified as the commented-out logic is not used.
        this.checkAnswer();
    }

    private useSample(): void {
        // Saves the selected category and level to localStorage
        const selectedLevelIndex = ($('#levelSelect').val() as string);
        const selectedCategoryIndex = ($('#categorySelect').val() as string);
        localStorage.setItem('selectedLevelIndex', selectedLevelIndex);
        localStorage.setItem('selectedCategoryIndex', selectedCategoryIndex);

        // Replaces the current sentence with a random sample sentence
        this.sentence = this.pickSample();
        this.setInputValue(this.sentence);
        this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
        this.currentIndex = 0;
        this.renderSampleSentence();
        this.saveState();
        this.setInputValue('');
    }

    private handleSampleWordClick(element: HTMLElement): void {
        // Sets the current practice index to the clicked word in sample mode
        const newIndex = $(element).data('index');
        if (typeof newIndex === 'number') {
            this.currentIndex = newIndex;
            this.renderSampleSentence();
            this.saveState();
        }
    }

    private handleRecordToggle(element: HTMLElement): void {
        // Toggles the recording feature and saves the preference
        this.isRecordingEnabled = $(element).is(':checked');
        localStorage.setItem(this.STORAGE_KEYS.recordAudio, String(this.isRecordingEnabled));
    }

    public calculateWordSimilarity(targetStr: string, answerStr: string): number {
        // Compares two strings word by word to calculate a similarity score
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
        // Fetches all recordings and displays them in a modal
        if (!this.db) return;
        const transaction = this.db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        const allRecords: Recording[] = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as Recording[]);
            request.onerror = err => reject(err);
        });
        // Group recordings by their sentence text
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

        // Sort sentences by the timestamp of the last recording
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
                                <li class="list-group-item">
                                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                                        <span class="mb-2 mb-md-0">Recording from ${rec.timestamp?.toLocaleString() || 'an old date'}</span>
                                        <div class="row g-2 justify-content-center">
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-success play-bot-audio w-100" data-sentence="${sentence}">
                                                    <i class="bi bi-robot"></i> Play Bot
                                                </button>
                                            </div>
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-primary play-user-audio w-100" data-sentence="${sentence}" data-index="${index}">
                                                    <i class="bi bi-person-fill"></i> Play Mine
                                                </button>
                                            </div>
                                            ${this.lang === 'en-US' && this.spellCheckerIsAvailable ? `
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-info check-accuracy-btn w-100" data-sentence="${sentence}" data-index="${index}" title="Check pronunciation accuracy">
                                                    <i class="bi bi-magic"></i> Fast <span class="text-nowrap">AI Analyze</span>
                                                </button>
                                            </div>
                                            ` : ''}
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-warning prepare-for-ai w-100" title="Prepare file and prompt for analysis by AI" data-sentence="${sentence}" data-index="${index}">
                                                    <i class="bi bi-magic"></i> Full <span class="text-nowrap">AI Analyze</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="accuracy-result-container mt-2 border-top pt-2" style="display: none;"></div>
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
        // Truncates a long sentence for display purposes
        const words = sentence.split(' ');
        if (words.length > 4) {
            return `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`;
        }
        return sentence;
    }

    private playUserAudio(element: HTMLElement): void {
        // Plays a specific user-recorded audio file
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
        // Plays the sentence using the text-to-speech engine
        this.stopAllPlayback(true);
        const sentence = $(element).data('sentence') as string;
        this.speak(sentence);
    }

    private async getPronunciationAccuracy(element: HTMLElement): Promise<void> {
        const $element = $(element);
        const sentence = $element.data('sentence') as string;
        const index = $element.data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];

        const $resultContainer = $element.closest('li.list-group-item').find('.accuracy-result-container');

        if (!record || !record.audio) {
            $resultContainer.html('<div class="alert alert-danger p-2">Audio file not found.</div>').slideDown();
            return;
        }

        $element.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
        $resultContainer.html('<div class="text-center text-muted">Analyzing pronunciation, please wait...</div>').slideDown();

        try {
            const formData = new FormData();
            formData.append('title', sentence);
            formData.append('language', 'en');
            formData.append('audioFile', record.audio, 'recording.ogg');

            const endpointUrl = `https://alisol.ir/Projects/GetAccuracyFromRecordedAudio/?spellApiKey=${this.spellApiKey}`;

            const response = await fetch(endpointUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            this.renderAccuracyResult(result, $resultContainer);

        } catch (error) {
            console.error('Error checking pronunciation accuracy:', error);
            $resultContainer.html(`<div class="alert alert-danger p-2">Error: Your audio could not be analyzed. Please try again with another recording.</div>`);
        } finally {
            $element.prop('disabled', false).html('<i class="bi bi-magic"></i> Fast <span class="text-nowrap">AI Analyze</span>');
        }
    }

    private renderAccuracyResult(result: any, $container: JQuery<HTMLElement>): void {
        if (!result.real_transcripts || !result.is_letter_correct_all_words || !result.pronunciation_accuracy) {
            $container.html('<div class="alert alert-warning p-2">The server returned an unexpected response.</div>');
            return;
        }

        const words = result.real_transcripts.split(' ');
        const correctness = result.is_letter_correct_all_words.trim().split(' ');

        if (words.length !== correctness.length) {
            console.error('Mismatch between words and correctness data:', words, correctness);
            $container.html('<div class="alert alert-warning p-2">Could not parse the accuracy data from the server.</div>');
            return;
        }

        let coloredSentenceHtml = words.map((word, wordIndex) => {
            return [...word].map((char, charIndex) => {
                const isCorrect = (correctness[wordIndex] || '')[charIndex] === '1';
                return `<span class="${isCorrect ? 'text-success' : 'text-danger'}">${char}</span>`;
            }).join('');
        }).join(' ');

        const overallScore = result.pronunciation_accuracy;
        const detectedTranscript = result.real_transcript;

        const resultHtml = `
        <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Accuracy Analysis</h6>
            <div><strong>Overall Score:</strong> <span class="badge bg-info">${overallScore}%</span></div>
        </div>
        <p class="fs-5 fw-bold mt-2 mb-1">${coloredSentenceHtml}</p>
        <p class="text-muted mb-0"><small><strong>Detected:</strong> <em>${detectedTranscript}</em></small></p>
    `;

        $container.html(resultHtml);
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    private async prepareForAIAnalysis(element: HTMLElement): Promise<void> {
        // Step 1: Get sentence and record data from the element
        const sentence = $(element).data('sentence') as string;
        const index = $(element).data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];

        if (!record) {
            console.error("Could not find record for AI analysis.");
            alert("Sorry, the recording could not be found.");
            return;
        }

        // Step 2: Perform the copy and download actions
        await this.copyAIPrompt(element); // We can reuse the copy logic
        this.downloadUserAudio(element); // and the download logic

        // Step 3: Prepare the dynamic content for the modal
        const modalBodyContent = `
            <p class="fw-bold">All set! Here's what just happened:</p>
            <ul class="list-group list-group-flush mb-3">
                <li class="list-group-item bg-transparent">
                    <i class="bi bi-check-circle-fill text-success"></i> <strong>Your voice recording</strong> for the sentence below was successfully <strong>downloaded</strong>:
                    <br><small class="text-muted"><em>"${sentence}"</em></small>
                </li>
                <li class="list-group-item bg-transparent">
                    <i class="bi bi-check-circle-fill text-success"></i> The analysis prompt for <strong>your recording</strong> was copied to your <strong>clipboard</strong>.
                </li>
            </ul>
            <hr>
            <p class="fw-bold">What's next?</p>
            <p>
                Simply go to the <a href="https://gemini.google.com/" target="_blank">Gemini website</a>, upload <strong>your downloaded voice recording</strong> as an attachment, and paste the copied prompt into the chat.
            </p>
            <p class="mt-3">
                Enjoy the free, fast, accurate, and targeted AI analysis to improve your <strong>pronunciation and fluency</strong>!
            </p>
        `;

        // Step 4: Inject the content and show the modal
        $('#aiInstructionsModalBody').html(modalBodyContent);

        const modalElement = document.getElementById('aiInstructionsModal');
        if (modalElement) {
            const modal = new Modal(modalElement);
            modal.show();
        }
    }

    /**
     * Handles downloading the user's recorded audio blob as an OGG file.
     * @param element The button element that was clicked.
     */
    private downloadUserAudio(element: HTMLElement): void {
        const sentence = $(element).data('sentence') as string;
        const index = $(element).data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];

        if (record && record.audio) {
            const audioUrl = URL.createObjectURL(record.audio);
            const link = document.createElement('a');

            // Create a safe filename from the sentence
            const safeFilename = sentence.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20);
            link.download = `echotalk_recording_${safeFilename || 'audio'}.ogg`;
            link.href = audioUrl;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(audioUrl);
        } else {
            console.error("Could not find audio record to download.");
            alert("Sorry, the audio file could not be found.");
        }
    }

    /**
     * Copies a pre-formatted, improved prompt to the clipboard for AI analysis.
     * @param element The button element that was clicked.
     */
    private async copyAIPrompt(element: HTMLElement): Promise<void> {
        const sentence = $(element).data('sentence') as string;

        const promptText = `Analyze my pronunciation in the attached audio file. I was practicing the shadowing technique with the EchoTalk app.

The target sentence was:
"${sentence}"

Please provide the following analysis:
1.  **Overall Score (1-10):** How was my overall pronunciation of the full sentence?
2.  **Word-by-Word Analysis:**
    * List each word from the sentence.
    * Give each word a pronunciation score from 1 to 10.
    * If a word's pronunciation has issues, explain the specific error (e.g., vowel sound, stress, intonation) and provide clear instructions on how to correct it.
3.  **Fluency Score (1-10):** How fluent and natural did my speech sound?
4.  **General Recommendations:** What other advice do you have for improving my pronunciation of this sentence?
5. Motivate me to keep up doing practice with EchoTalk to enhance my speaking ability.

If I have forgotten to attach the audio file, please respond with only this exact message: "Please download your recorded audio for "${sentence}" sentence from the EchoTalk app and send it to me as an attachment for analysis."`;

        try {
            await navigator.clipboard.writeText(promptText);

            // Provide user feedback
            const originalHtml = $(element).html();
            $(element).html('<i class="bi bi-check-lg"></i> Copied!');
            $(element).prop('disabled', true);

            setTimeout(() => {
                $(element).html(originalHtml);
                $(element).prop('disabled', false);
            }, 2000);

        } catch (err) {
            console.error('Failed to copy prompt: ', err);
            // Optional: Alert the user that copying failed.
            alert("Could not copy the prompt to your clipboard. Please try again.");
        }
    }

    private stopAllPlayback(keepTTS: boolean = false): void {
        // Stops all currently playing audio
        if (this.currentlyPlayingAudioElement) {
            this.currentlyPlayingAudioElement.pause();
            URL.revokeObjectURL(this.currentlyPlayingAudioElement.src);
            this.currentlyPlayingAudioElement = null;
        }
        if (!keepTTS) {
            speechSynthesis.cancel();
        }
    }

    private displayAppVersion(): void {
        const buildDate = __APP_BUILD_DATE__;
        $('#app-version').text(`Build: ${buildDate}`);
    }

}


// =================================================================
// Application Entry Point
// =================================================================
// This ensures the application is initialized when the DOM is ready,
// but only when running outside of a test environment.
if (import.meta.env.MODE !== 'test') {
    $(function () {
        const app = new EchoTalkApp();
        app.init();
    });

}