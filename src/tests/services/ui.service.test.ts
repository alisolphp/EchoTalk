// Projects/EchoTalk/src/tests/services/ui.service.test.ts

import { EchoTalkApp } from '../../app';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import $ from 'jquery';
import { Modal } from 'bootstrap';
import confetti from 'canvas-confetti';

/**
 * Fully mock the Bootstrap Modal module so tests don't rely on real DOM behaviors.
 * - getOrCreateInstance returns an object with spy-able show/hide methods.
 * - We spread the original export to keep unrelated Bootstrap exports intact if needed.
 */
vi.mock('bootstrap', async (importOriginal) => {
    const original = await importOriginal<typeof import('bootstrap')>();
    const showSpy = vi.fn();
    const hideSpy = vi.fn();

    // Spy-able Modal facade returned by getOrCreateInstance
    const mockModal = {
        getOrCreateInstance: vi.fn(() => ({
            show: showSpy,
            hide: hideSpy,
        })),
    };

    return {
        ...original,
        Modal: mockModal,
    };
});

describe('UiService', () => {
    let app: EchoTalkApp;
    let uiService: EchoTalkApp['uiService'];

    beforeEach(() => {
        // Reset JSDOM and create a fresh app instance before each test
        document.body.innerHTML = `
            <div id="areaOptions" class="d-none"></div>
            <div id="areaHome"></div>
            <div id="navOptions"></div>
            <div id="navHome"></div>
            <input id="sentenceInput" />
            <select id="levelSelect"></select>
            <select id="languageSelect"></select>
            <div id="ttsWarningModal"></div>
            <select id="categorySelect"></select>
            <select id="repsSelect"></select>
            <div id="sampleSentence"></div>
            <div id="fullSentence"></div>
            <div id="userInput"><div></div></div>
            <button id="checkBtn"></button>
            <div id="wordActionsModal"><div class="modal-label" id="wordActionsModalLabel"></div></div>
            <a id="searchMeaningLink"></a>
            <div id="confirmationModal"></div>
            <div id="app-version"></div>
            <div id="myStreakModal"><div class="confetti-container"></div></div>
            <div class="current-language-general-name"></div>
        `;

        app = new EchoTalkApp();
        uiService = app.uiService;

        // Seed minimal sample data for option-populating tests
        app.samples = {
            levels: [
                {
                    name: "Beginner",
                    categories: [
                        { name: "General", sentences: ["a b c"] },
                        { name: "Travel", sentences: ["d e f"] }
                    ]
                },
                {
                    name: "Intermediate",
                    categories: [
                        { name: "Work", sentences: ["g h i"] }
                    ]
                }
            ]
        };

        vi.clearAllMocks();
    });

    // Verifies: setInputValue updates the input value and normalized data attribute.
    it('should set the input value and data attribute correctly', () => {
        const sentence = '  A test sentence.  ';
        uiService.setInputValue(sentence);

        expect($('#sentenceInput').val()).toBe(sentence);
        expect($('#sentenceInput').attr('data-val')).toBe('A test sentence.');
    });

    // Verifies: level dropdown is populated from app.samples.
    it('should populate level select options correctly', () => {
        uiService.setupSampleOptions();
        const levelOptions = $('#levelSelect option');

        expect(levelOptions.length).toBe(2);
        expect(levelOptions.eq(0).text()).toBe('Beginner');
        expect(levelOptions.eq(1).text()).toBe('Intermediate');
    });

    // Verifies: language dropdown is populated from app.languageMap.
    it('should populate language select options correctly', () => {
        uiService.setupLanguageOptions();
        const langOptions = $('#languageSelect option');

        expect(langOptions.length).toBe(Object.keys(app.languageMap).length);
        expect(langOptions.first().val()).toBe('en-US');
        expect(langOptions.first().text()).toBe('English (US)');
    });

    // Verifies: UI reflects a programmatic language change.
    it('should update UI elements when language changes', () => {
        uiService.setupLanguageOptions(); // Initialize language options first
        app.lang = 'nl-NL';
        uiService.updateLanguageUI();

        expect($('.current-language-general-name').first().text()).toBe('Dutch (NL)');
        expect($('#languageSelect').val()).toBe('nl-NL');
    });

    // Verifies: TTS warning modal is shown via Bootstrap API.
    it('should show the TTS warning modal', () => {
        uiService.showTTSWarning();
        const modalInstance = Modal.getOrCreateInstance(document.getElementById('ttsWarningModal')!);

        expect(Modal.getOrCreateInstance).toHaveBeenCalled();
        expect(modalInstance.show).toHaveBeenCalled();
    });

    // Verifies: categories are populated when a level is chosen.
    it('should populate categories based on the selected level', () => {
        uiService.setupSampleOptions();
        $('#levelSelect').val('0').trigger('change'); // select first level and trigger change

        const categoryOptions = $('#categorySelect option');

        expect(categoryOptions.length).toBe(2);
        expect(categoryOptions.eq(0).text()).toContain('General');
        expect(categoryOptions.eq(1).text()).toContain('Travel');
    });

    // Verifies: repetition options (Auto + numeric) are populated.
    it('should populate repetition options correctly', () => {
        uiService.setupRepOptions();
        const repOptions = $('#repsSelect option');

        expect(repOptions.length).toBeGreaterThan(1);
        expect(repOptions.first().val()).toBe('0');
        expect(repOptions.first().text()).toContain('Auto');
        expect(repOptions.eq(4).val()).toBe('5');
    });

    // Verifies: sample sentence shows tokens with the current word highlighted.
    it('should render the sample sentence with the current word highlighted', () => {
        app.words = ['This', 'is', 'a', 'test'];
        app.currentIndex = 2;
        uiService.renderSampleSentence();

        const spans = $('#sampleSentence span');
        expect(spans.length).toBe(4);
        expect(spans.eq(2).hasClass('current-word')).toBe(true);
        expect(spans.eq(1).hasClass('current-word')).toBe(false);
    });

    // Verifies: full sentence view mutes past tokens and marks current word.
    it('should render the full sentence, muting past phrases', () => {
        app.words = ['Phrase', 'one.', 'And', 'phrase', 'two.'];
        app.currentIndex = 3;
        uiService.renderFullSentence();

        const spans = $('#fullSentence span');
        expect(spans.eq(0).hasClass('text-muted')).toBe(true);
        expect(spans.eq(1).hasClass('text-muted')).toBe(true);
        expect(spans.eq(3).hasClass('current-word')).toBe(true);
    });

    // Verifies: "check" practice mode shows input and sets button label.
    // Note: in JSDOM, prefer checking 'd-none' presence instead of :hidden queries.
    it('should set up UI for "check" practice mode', () => {
        app.practiceMode = 'check';
        uiService.setupPracticeUI();

        expect($('#userInput').parent().hasClass('d-none')).toBe(false);
        expect($('#checkBtn').text()).toBe('Check/Skip');
    });

    // Verifies: word actions modal is populated with word-specific data and shown.
    it('should show word actions modal with correct data', () => {
        const wordElement = $('<span>play</span>')[0];
        app.currentPhrase = "Let's play a game.";
        uiService.showWordActionsModal(wordElement);

        const modalInstance = Modal.getOrCreateInstance(document.getElementById('wordActionsModal')!);

        expect($('#wordActionsModalLabel').text()).toBe('Word: play');
        expect($('#searchMeaningLink').attr('href')).toContain('meaning:+play');
        expect(modalInstance.show).toHaveBeenCalled();
    });

    // Verifies: app version renders from global __APP_BUILD_DATE__.
    // Example: 20250910 -> "build.20250910"
    it('should display the app version from the build date', () => {
        (global as any).__APP_BUILD_DATE__ = '20250910';
        uiService.displayAppVersion();

        expect($('#app-version').text()).toBe('build.20250910');
    });

    // Verifies: body class toggles according to navigator.onLine.
    it('should update body class based on online status', () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        uiService.updateOnlineStatusClass();
        expect(document.body.classList.contains('is-online')).toBe(true);
        expect(document.body.classList.contains('is-offline')).toBe(false);

        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        uiService.updateOnlineStatusClass();
        expect(document.body.classList.contains('is-offline')).toBe(true);
        expect(document.body.classList.contains('is-online')).toBe(false);
    });

    // Verifies: confetti animation is triggered.
    // Tip: use fake timers because the animation may be scheduled via timeouts/intervals.
    it('should trigger the celebration confetti animation', () => {
        vi.useFakeTimers();
        uiService.triggerCelebrationAnimation();

        expect(confetti).toHaveBeenCalled();
        vi.runAllTimers();
        vi.useRealTimers();
    });

    // Verifies: static confetti DOM elements are added once to the streak modal.
    // Tip: calling showStaticConfetti again should be idempotent.
    it('should add static confetti elements to the streak modal', () => {
        const container = $('#myStreakModal .confetti-container');
        uiService.showStaticConfetti();

        expect(container.children('.confetti').length).toBeGreaterThan(0);

        const initialCount = container.children().length;
        uiService.showStaticConfetti();

        expect(container.children().length).toBe(initialCount);
    });
});
