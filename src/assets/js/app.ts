// Imports third-party libraries and modules.
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import $ from 'jquery';
import { Modal } from 'bootstrap';
import './utils/string.extensions';

// Imports custom CSS styles and string extensions.
import './../css/style.css';

// Imports type definitions and services used throughout the application.
import { SampleData } from './types';

import { UiService } from './services/ui.service';
import { AudioService } from './services/audio.service';
import { DataService } from './services/data.service';
import { PracticeService } from './services/practice.service';
import { AiService } from './services/ai.service';
import { UtilService } from './services/util.service';

/**
 * The main class for the EchoTalk application.
 * This class orchestrates the entire application, managing state,
 * services, and the main initialization logic.
 */
export class EchoTalkApp {

    /**
     * Centralized keys for storing and retrieving data from localStorage.
     * Using a constant object prevents typos and keeps keys consistent.
     */
    public readonly STORAGE_KEYS = {
        sentence: 'shadow_sentence',
        reps: 'shadow_reps',
        index: 'shadow_index',
        count: 'shadow_count',
        correctCount: 'shadow_correct',
        attempts: 'shadow_attempts',
        recordAudio: 'shadow_record_audio',
        practiceMode: 'shadow_practice_mode',
        speechRate: 'shadow_speech_rate',
        lang: 'shadow_language',
        spellApiKey: 'shadow_spell_api_key',
        spellCheckerIsAvailable: 'shadow_spell_checker_is_available'
    };

    /** The full sentence being practiced. */
    public sentence: string = '';
    public words: string[] = [];

    /** The number of repetitions for each phrase. */
    public reps: number = 3;

    /** The index of the current word in the `words` array where practice is focused. */
    public currentIndex: number = 0;

    /** The number of times the current phrase has been repeated. */
    public currentCount: number = 0;

    /** The number of correct attempts in 'check' mode. */
    public correctCount: number = 0;

    /** The total number of attempts in 'check' mode. */
    public attempts: number = 0;

    /** The loaded sample sentences from JSON data. */
    public samples: SampleData = { levels: [] };

    /** The current phrase being spoken or practiced. */
    public currentPhrase: string = '';

    /** A flag indicating if audio recording is enabled by the user. */
    public isRecordingEnabled: boolean = false;

    /** The current area */
    public area: 'Home' | 'Help' | 'PrePractice' | 'Practice' | 'Options' | 'ForYou' = 'Home';

    /** The current practice mode: 'skip', 'check', or 'auto-skip'. */
    public practiceMode: 'skip' | 'check' | 'auto-skip' = 'skip';

    /** The IndexedDB database instance. */
    public db!: IDBDatabase;

    /** A reference to the currently playing HTMLAudioElement to allow for stopping it. */
    public currentlyPlayingAudioElement: HTMLAudioElement | null = null;

    /** A boolean flag to detect if the app is running on a mobile device. */
    public readonly isMobile: boolean = /Mobi|Android/i.test(navigator.userAgent);

    /** A timer for the 'auto-skip' practice mode. */
    public autoSkipTimer: number | null = null;

    /** A timer for the `auto restart current practice` in the 'auto-skip' practice mode. */
    public autoRestartTimer: number | null = null;

    /** An estimated words-per-second rate for TTS on mobile to simulate word highlighting. */
    public estimatedWordsPerSecond: number = 2.5;

    /** A counter for the number of phrases spoken by TTS to refine `estimatedWordsPerSecond`. */
    public phrasesSpokenCount: number = 0;

    /** The speech rate for the text-to-speech engine (0.1 to 10). */
    public speechRate: number = 1;

    /** The API key for the spell checker service. */
    public spellApiKey: string = '';

    /** A flag indicating if the spell checker service is available and the API key is valid. */
    public spellCheckerIsAvailable: boolean = false;

    /**
     * An array of common "stop words" to ignore for more natural phrase splitting.
     * Prevents phrases from ending with unimportant words like 'a', 'the', 'is'.
     */
    public readonly STOP_WORDS: string[] = [
        'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'with', 'by',
        'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
        'and', 'or', 'but', 'so', 'if', 'as', 'that', 'which', 'who', 'whom',
        'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ];

    /** A map of language codes to their human-readable names. */
    public readonly languageMap: Record<string, string> = {
        'en-US': 'English (US)', 'da-DK': 'Danish (DK)', 'nl-NL': 'Dutch (NL)',
        'fr-FR': 'French (FR)', 'de-DE': 'German (DE)', 'hi-IN': 'Hindi (IN)',
        'it-IT': 'Italian (IT)', 'pl-PL': 'Polish (PL)', 'pt-BR': 'Portuguese (BR)',
        'ro-RO': 'Romanian (RO)', 'ru-RU': 'Russian (RU)', 'es-ES': 'Spanish (ES)',
        'sv-SE': 'Swedish (SE)', 'no-NO': 'Norwegian (NO)', 'tr-TR': 'Turkish (TR)'
    };

    /** The currently selected language code (e.g., 'en-US'). */
    public lang: string;

    /** The general name of the current language (e.g., 'English (US)'). */
    public langGeneral: string;

    /** The default level name to select on first load. */
    public defaultLevelName: string = "Intermediate (B1-B2)";

    /** The default category name to select on first load. */
    public defaultCategoryName: string = "Interview";

    // --- Service Instances ---
    // The application is structured using a service-oriented architecture.
    // Each service encapsulates a specific domain of functionality.

    /** Manages all UI-related interactions and updates. */
    public uiService: UiService;

    /** Handles text-to-speech, audio recording, and sound playback. */
    public audioService: AudioService;

    /** Manages data fetching and IndexedDB storage. */
    public dataService: DataService;

    /** Contains the logic for the practice session flow. */
    public practiceService: PracticeService;

    /** Handles interactions with external AI services (e.g., generating prompts). */
    public aiService: AiService;

    /** Provides utility functions used across the application. */
    public utilService: UtilService;

    /**
     * Initializes the application, sets default language, and instantiates all services.
     */
    constructor() {
        const firstLangKey = Object.keys(this.languageMap)[0];
        this.lang = firstLangKey;
        this.langGeneral = this.languageMap[firstLangKey];

        // Instantiate services
        this.utilService = new UtilService(this);
        this.uiService = new UiService(this);
        this.audioService = new AudioService(this);
        this.dataService = new DataService(this);
        this.practiceService = new PracticeService(this);
        this.aiService = new AiService(this);

        window.modalRecordings = {};
        window.app = this;
    }

    /**
     * Asynchronously initializes the application.
     * This method sets up the database, fetches initial data, loads saved state,
     * binds UI events, and prepares the application for user interaction.
     */
    public async init(): Promise<void> {
        try {
            const shadowSentence = localStorage.getItem(this.STORAGE_KEYS.sentence) || '';
            if (shadowSentence !== '') {
                this.uiService.showPracticeSetup();
            }

            this.db = await this.dataService.initDB();
            this.samples = await this.dataService.fetchSamples();

            this.uiService.setupLanguageOptions();
            this.uiService.setupRepOptions();
            this.uiService.setupSampleOptions();
            this.loadState();
            this.uiService.updateLanguageUI();
            this.bindEvents();
            this.uiService.displayAppVersion();

            if (!this.sentence) {
                this.sentence = this.utilService.pickSample();
            }

            this.uiService.setInputValue(this.sentence);
            this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
            ($('#repsSelect') as JQuery<HTMLSelectElement>).val(this.reps.toString());
            this.uiService.renderSampleSentence();
            this.uiService.setInputValue('');
            this.registerServiceWorker();
            this.handleHashChange();
            await this.aiService.checkSpellApiKey();
            this.uiService.updateOnlineStatusClass();
        } catch (error) {
            console.error("Initialization failed:", error);
            $('#configArea').html('<div class="alert alert-danger">Failed to initialize the application. Please refresh the page.</div>');
        }
    }

    /**
     * Resets the application state to its initial configuration without a full page reload.
     * This is useful for starting a new practice session quickly. It stops all audio,
     * clears timers, resets state variables, and restores the UI to the setup screen.
     */
    public async resetWithoutReload(): Promise<void> {
        this.audioService.stopAllPlayback();
        this.utilService.clearAutoSkipTimer();
        await this.audioService.stopRecording();
        this.audioService.terminateMicrophoneStream();

        this.sentence = '';
        this.words = [];
        this.reps = parseInt(localStorage.getItem(this.STORAGE_KEYS.reps) || this.reps.toString());
        this.currentIndex = 0;
        this.currentCount = 0;
        this.correctCount = 0;
        this.attempts = 0;
        this.phrasesSpokenCount = 0;

        $('#practiceArea').addClass('d-none');
        $('#configArea').removeClass('d-none');
        $('#backHomeButton').addClass('d-none').removeClass('d-inline-block');
        $('#feedback-text').html('');
        $('#sentence-container').html('');
        $('#fullSentence').html('').addClass('d-none');

        this.loadState();
        this.uiService.updateLanguageUI();
        this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
        this.uiService.setInputValue(this.sentence);
        this.uiService.setInputValue('');
        this.uiService.renderSampleSentence();
        console.log("Application reset to saved state without reloading the page.");
    }

    /**
     * Handles a click on the "Practice" button from the practice history modal.
     * It closes the modal, sets the selected sentence and language, and starts a new practice session.
     * @param element The button element that was clicked.
     */
    public async handlePracticeThis(element: HTMLElement): Promise<void> {
        const sentence = $(element).data('sentence') as string;
        const lang = $(element).data('lang') as string;

        if (!sentence || !lang) {
            console.error("Could not start practice from history: sentence or lang missing.");
            return;
        }

        const modalElement = document.getElementById('practicesModal');
        if (modalElement) {
            this.uiService.showPracticeSetup();
            if (this.lang !== lang) {
                this.lang = lang;
                this.uiService.updateLanguageUI();
                try {
                    this.dataService.fetchSamples();
                    this.uiService.setupSampleOptions();
                } catch (error) {
                    console.error("Failed to load new language data:", error);
                    $('#configArea').html('<div class="alert alert-danger">Failed to load language data. Please refresh the page.</div>');
                    return;
                }
            }

            this.uiService.setInputValue(sentence);
            this.sentence = sentence;
            this.words = this.sentence.split(/\s+/).filter(w => w.length > 0);
            this.currentIndex = 0;

            await this.practiceService.startPractice();

            // Wait for the modal to be completely hidden before executing the rest of the code
            $(modalElement).one('hidden.bs.modal', async () => {});

            // Use getInstance here since we know it exists.
            const modalInstance = Modal.getInstance(modalElement);
            modalInstance?.hide();
        }
    }

    /**
     * Registers the service worker for PWA functionality like offline caching.
     */
    private registerServiceWorker(): void {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(error => {
                console.error('Service Worker registration failed:', error);
            });
        }
    }

    /**
     * Binds all necessary event listeners to UI elements.
     * This centralizes event handling for the application.
     */
    private bindEvents(): void {
        $('#startBtn').on('click', () => this.practiceService.startPractice());
        $('#resetBtn').on('click', () => this.resetApp());
        $('#checkBtn').on('click', () => this.practiceService.handleCheckOrNext());
        $('#userInput').on('keypress', (e: JQuery.KeyPressEvent) => {
            if (e.key === 'Enter' && this.practiceMode === 'check') {
                this.practiceService.checkAnswer();
            }
        });
        $('#useSampleBtn').on('click', () => this.practiceService.useSample());
        $('#sampleSentence').on('click', 'span', (e) => this.practiceService.handleSampleWordClick(e.currentTarget));
        $('#slowBtn').on('click', () => this.practiceService.practiceStep(0.6));
        $('#fastBtn').on('click', () => this.practiceService.practiceStep(1.3));
        $('#recordToggle').on('change', (e) => this.handleRecordToggle(e.currentTarget));
        $('#showRecordingsBtn').on('click', () => this.dataService.displayRecordings());
        $('#showPracticesBtn').on('click', () => this.dataService.displayPractices());
        $('#practicesList').on('click', '.practice-this-sentence-btn', (e) => this.handlePracticeThis(e.currentTarget));
        $('#recordingsList').on('click', '.play-user-audio', (e) => this.audioService.playUserAudio(e.currentTarget));
        $('#recordingsList').on('click', '.play-bot-audio', (e) => this.audioService.playBotAudio(e.currentTarget));
        $('#recordingsList').on('click', '.prepare-for-ai', (e) => this.aiService.prepareForAIAnalysis(e.currentTarget));
        $('#recordingsList').on('click', '.check-accuracy-btn', (e) => this.aiService.getPronunciationAccuracy(e.currentTarget));
        $('#recordingsModal').on('hidden.bs.modal', () => this.audioService.stopAllPlayback());

        $('#languageSelect, #headerLanguageSelect').on('change', (e) => {
            const newLang = $(e.currentTarget).val() as string;
            $('#languageSelect, #headerLanguageSelect').val(newLang);
            this.handleLanguageChange();
        });

        $('#levelSelect').on('change', () => {
            this.uiService.populateCategories();
            this.practiceService.useSample();
        });
        $('#sentenceInput').on('change', function () {
            $(this).attr('data-val', $(this).val());
        });
        $('#categorySelect').on('change', () => this.practiceService.useSample());

        $('#goToPracticeBtn').on('click', () => this.uiService.showPracticeSetup());
        $('#navPrePractice').on('click', () => this.uiService.showPracticeSetup());
        $('#navHome').on('click', () => this.uiService.showHomePage());
        $('#navForYou').on('click', () => this.uiService.showForYouPage());
        $('#myRecordingsLink').on('click', () => this.dataService.displayRecordings());
        $('.backHomeButton').on('click', () => this.uiService.showPracticeSetup());

        $('#speechRateSelect').on('change', (e) => {
            const val = parseFloat($(e.currentTarget).val() as string);
            this.speechRate = isNaN(val) ? 1 : val;
            localStorage.setItem(this.STORAGE_KEYS.speechRate, this.speechRate.toString());
            const sampleSentences: Record<number, string> = {
                0.6: "I’m taking my time… like a turtle on vacation.",
                0.8: "Just strolling through the words—steady and clear.",
                1.0: "This is my natural pace. Feels just right, doesn’t it?",
                1.2: "Okay, I’m picking up the pace—keep up if you can!",
                1.4: "Blink and you’ll miss it—I’m in turbo mode!"
            };
            const sentence = sampleSentences[val];
            if (sentence) {
                this.audioService.speak(sentence, null, val, 'en-US');
            }
        });

        $('#showTtsWarningBtn').on('click', () => this.uiService.showTTSWarning());

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
            if (window.location.hash !== '#modal') window.location.hash = 'modal';
        });
        document.addEventListener('hidden.bs.modal', () => {
            if (window.location.hash === '#modal') {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        });
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        window.addEventListener('online', () => this.uiService.updateOnlineStatusClass());
        window.addEventListener('offline', () => this.uiService.updateOnlineStatusClass());
    }

    /**
     * Handles the `visibilitychange` event of the document.
     * Stops audio recording if the user switches to another tab to conserve resources
     * and prevent unexpected behavior.
     */
    private handleVisibilityChange(): void {
        if (document.visibilityState === 'hidden') {
            const isPracticing = this.area === 'Practice';
            const shouldResetPractice = isPracticing && (this.isRecordingEnabled || this.practiceMode === 'auto-skip');

            if (shouldResetPractice) {
                this.uiService.showPracticeSetup();
            } else {
                this.audioService.stopRecording().then(() => {
                    this.audioService.terminateMicrophoneStream();
                });
            }
        }
    }

    /**
     * Manages application state based on the URL hash.
     * It handles closing modals or resetting the practice view when the user
     * navigates using the browser's back button.
     */
    private handleHashChange(): void {
        const hash = window.location.hash;
        const openModal = document.querySelector('.modal.show') as HTMLElement;
        const isPracticeVisible = !$('#practiceArea').hasClass('d-none');

        if (hash !== '#modal' && openModal) {
            const modalInstance = Modal.getInstance(openModal);
            if (modalInstance) {
                modalInstance.hide();
            }
        } else if (hash !== '#practice' && isPracticeVisible && hash !== '#modal') {
            this.resetWithoutReload();
        }
    }

    /**
     * Handles the logic for changing the application's language.
     * It updates the state, saves it, fetches new sample sentences for the selected language,
     * and refreshes the UI.
     */
    public async handleLanguageChange(): Promise<void> {
        try {
            const $languageSelect = $('#languageSelect') as JQuery<HTMLSelectElement>;
            this.lang = $languageSelect.val() as string;
            this.saveState();
            this.uiService.updateLanguageUI();
            this.samples = await this.dataService.fetchSamples();
            this.uiService.setupSampleOptions();
            this.practiceService.useSample();
        } catch (error) {
            console.error("Failed to load new language data:", error);
            $('#configArea').html('<div class="alert alert-danger">Failed to load language data. Please refresh the page.</div>');
        }
    }

    /**
     * Updates the general language name based on the current language code.
     */
    public updateLanguageGeneral() {
        this.langGeneral = this.languageMap[this.lang] || 'English';
    }

    /**
     * Loads the application's state from `localStorage`.
     * This allows the user's progress and settings to persist between sessions.
     */
    private loadState(): void {
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
        this.spellCheckerIsAvailable = localStorage.getItem(this.STORAGE_KEYS.spellCheckerIsAvailable) === 'true';

        const savedLevelIndex = localStorage.getItem('selectedLevelIndex');
        const savedCategoryIndex = localStorage.getItem('selectedCategoryIndex');
        if (savedLevelIndex) ($('#levelSelect') as JQuery<HTMLSelectElement>).val(savedLevelIndex);
        if (savedCategoryIndex) ($('#categorySelect') as JQuery<HTMLSelectElement>).val(savedCategoryIndex);

        const savedRate = parseFloat(localStorage.getItem(this.STORAGE_KEYS.speechRate) || '1');
        this.speechRate = isNaN(savedRate) ? 1 : savedRate;
        $('#speechRateSelect').val(this.speechRate.toString());

        this.practiceMode = (localStorage.getItem(this.STORAGE_KEYS.practiceMode) as 'skip' | 'check' | 'auto-skip') || 'skip';
        $('#practiceModeSelect').val(this.practiceMode);
    }

    /**
     * Saves the current application state to `localStorage`.
     * This is called whenever a setting or progress needs to be persisted.
     */
    public saveState(): void {
        localStorage.setItem(this.STORAGE_KEYS.sentence, this.sentence);
        localStorage.setItem(this.STORAGE_KEYS.reps, this.reps.toString());
        localStorage.setItem(this.STORAGE_KEYS.index, this.currentIndex.toString());
        localStorage.setItem(this.STORAGE_KEYS.count, this.currentCount.toString());
        localStorage.setItem(this.STORAGE_KEYS.correctCount, this.correctCount.toString());
        localStorage.setItem(this.STORAGE_KEYS.attempts, this.attempts.toString());
        localStorage.setItem(this.STORAGE_KEYS.speechRate, this.speechRate.toString());
        localStorage.setItem(this.STORAGE_KEYS.lang, this.lang.toString());
        localStorage.setItem(this.STORAGE_KEYS.practiceMode, this.practiceMode);
    }

    /**
     * Handles the change event for the record audio toggle switch.
     * Updates the `isRecordingEnabled` state and saves it to localStorage.
     * @param element The HTML element that triggered the event.
     */
    private handleRecordToggle(element: HTMLElement): void {
        this.isRecordingEnabled = $(element).is(':checked');
        localStorage.setItem(this.STORAGE_KEYS.recordAudio, String(this.isRecordingEnabled));
    }

    /**
     * Performs a hard reset of the application.
     * It clears all recordings from IndexedDB and all data from localStorage,
     * then reloads the page to start fresh.
     * @returns A promise that resolves when the reset is complete.
     */
    private resetApp(): Promise<void> {
        return new Promise((resolve, reject) => {
            speechSynthesis.cancel();
            this.audioService.terminateMicrophoneStream();
            if (!this.db) {
                localStorage.clear();
                window.location.reload();
                return resolve();
            }
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            transaction.onerror = (event) => {
                const error = (event.target as IDBTransaction).error;
                console.error("Transaction error during reset:", error);
                localStorage.clear();
                window.location.reload();
                reject(error);
            };
            const store = transaction.objectStore('recordings');
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                localStorage.clear();
                window.location.reload();
                resolve();
            };
            clearRequest.onerror = (event) => {
                const error = (event.target as IDBRequest).error;
                console.error("Error deleting recordings from IndexedDB:", error);
                localStorage.clear();
                window.location.reload();
                reject(error);
            };
        });
    }
}

// --- Application Entry Point ---
// Ensures the script runs only in a browser environment (not during tests)
// and initializes the app once the DOM is ready.
if (import.meta.env.MODE !== 'test') {
    $(function () {
        const app = new EchoTalkApp();
        app.init();
    });
}