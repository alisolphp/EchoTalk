import { EchoTalkApp } from '../../app';
import { vi } from 'vitest';
import $ from 'jquery';
import * as prompts from '../../services/prompts.service';

describe('AiService', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="aiInstructionsModalBody"></div>
            <ul>
                <li>
                    <button class="pronunciation-check" data-sentence="test" data-index="0"></button>
                    <div class="pronunciation-result"></div>
                </li>
            </ul>
        `;

        app = new EchoTalkApp();
        app.utilService.copyTextToClipboard = vi.fn().mockResolvedValue(true);
        app.uiService.showCopySuccessFeedback = vi.fn();
        global.fetch = vi.fn();

        vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should validate and set spell checker API key if valid', async () => {
        const mockResponse = { ok: true, json: () => Promise.resolve({ status: 'success', message: 'api_key_is_valid' }) };
        (global.fetch as any).mockResolvedValue(mockResponse);

        localStorage.setItem(app.STORAGE_KEYS.spellApiKey, 'valid-key');
        await app.aiService.checkSpellApiKey();

        expect(app.spellCheckerIsAvailable).toBe(true);
    });

    // ... (other tests remain the same)

    describe('AI Prompt Handlers', () => {
        const testCases = [
            { method: 'handleTranslateWithGpt', promptFn: 'getTranslatePrompt' },
            { method: 'handleGrammarAnalysis', promptFn: 'getGrammarAnalysisPrompt' },
            { method: 'handleVocabularyExpansion', promptFn: 'getVocabularyExpansionPrompt' },
            { method: 'handleContextNuance', promptFn: 'getContextNuancePrompt' },
            { method: 'handleCreativePractice', promptFn: 'getCreativePracticePrompt' }
        ];

        testCases.forEach(({ method, promptFn }) => {
            it(`should call ${promptFn} and copy text for ${method}`, async () => {
                app.currentPhrase = 'test sentence';
                const promptSpy = vi.spyOn(prompts, promptFn as any);
                const button = document.createElement('button');
                await (app.aiService as any)[method](button);
                expect(promptSpy).toHaveBeenCalledWith('test sentence', app.langGeneral);
                expect(app.utilService.copyTextToClipboard).toHaveBeenCalled();
                expect(app.uiService.showCopySuccessFeedback).toHaveBeenCalled();
            });

            it(`should show alert if copy fails for ${method}`, async () => {
                app.currentPhrase = 'test sentence';
                app.utilService.copyTextToClipboard = vi.fn().mockResolvedValue(false);
                const button = document.createElement('button');
                await (app.aiService as any)[method](button);
                expect(window.alert).toHaveBeenCalledWith("Could not copy the prompt to your clipboard.");
            });

            it(`should not proceed if sentence is empty for ${method}`, async () => {
                app.currentPhrase = '';
                const promptSpy = vi.spyOn(prompts, promptFn as any);
                const button = document.createElement('button');
                await (app.aiService as any)[method](button);
                expect(promptSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe('getPronunciationAccuracy', () => {
        let htmlSpy: any;

        beforeEach(() => {
            // Spy on jQuery's html method to check what it's being called with
            htmlSpy = vi.spyOn($.fn, 'html');
            // Mock show to avoid issues
            vi.spyOn($.fn, 'show').mockReturnThis();
        });

        it('should show error if audio record is not found', async () => {
            window.modalRecordings = {};
            const element = $('.pronunciation-check')[0];
            await app.aiService.getPronunciationAccuracy(element);
            expect(htmlSpy).toHaveBeenCalledWith(expect.stringContaining('Audio file not found'));
        });

        it('should successfully fetch and render accuracy results', async () => {
            const mockBlob = new Blob(['audio'], { type: 'audio/ogg' });
            window.modalRecordings = { 'test': [{ sentence: 'test', audio: mockBlob, timestamp: new Date(), lang: 'en-US' }] };

            // This mock result now includes all the fields the function expects
            const mockResult = {
                pronunciation_accuracy: 95,
                real_transcript: 'hello world',
                is_letter_correct_all_words: '11111 11111',
                real_transcripts: 'hello world'
            };
            const mockResponse = { ok: true, json: () => Promise.resolve(mockResult) };
            (global.fetch as any).mockResolvedValue(mockResponse);

            const element = $('.pronunciation-check')[0];
            await app.aiService.getPronunciationAccuracy(element);

            expect(htmlSpy).toHaveBeenCalledWith(expect.stringContaining('Accuracy Analysis'));
            expect(htmlSpy).toHaveBeenCalledWith(expect.stringContaining('95%'));
        });

        it('should handle HTTP error during accuracy check', async () => {
            const mockBlob = new Blob(['audio'], { type: 'audio/ogg' });
            window.modalRecordings = { 'test': [{ sentence: 'test', audio: mockBlob, timestamp: new Date(), lang: 'en-US' }] };
            const mockResponse = { ok: false, status: 500, statusText: 'Server Error', text: () => Promise.resolve('Error') };
            (global.fetch as any).mockResolvedValue(mockResponse);

            const element = $('.pronunciation-check')[0];
            await app.aiService.getPronunciationAccuracy(element);

            expect(htmlSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Your audio could not be analyzed'));
        });
    });

    describe('prepareForAIAnalysis', () => {
        it('should call copyAIPrompt and downloadUserAudio', async () => {
            const copySpy = vi.spyOn(app.aiService as any, 'copyAIPrompt').mockResolvedValue(undefined);
            const downloadSpy = vi.spyOn(app.aiService as any, 'downloadUserAudio').mockImplementation(() => {});
            const element = $('.pronunciation-check')[0];
            await app.aiService.prepareForAIAnalysis(element);
            expect(copySpy).toHaveBeenCalled();
            expect(downloadSpy).toHaveBeenCalled();
            expect($('#aiInstructionsModalBody').html()).toContain("All set!");
        });
    });

    describe('downloadUserAudio', () => {
        it('should trigger a download if audio exists', () => {
            const mockBlob = new Blob(['audio'], { type: 'audio/ogg' });
            window.modalRecordings = { 'test': [{ sentence: 'test', audio: mockBlob, timestamp: new Date(), lang: 'en-US' }] };
            const link = document.createElement('a');
            const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link);
            const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
            const element = $('.pronunciation-check')[0];
            (app.aiService as any).downloadUserAudio(element);
            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(clickSpy).toHaveBeenCalled();
        });

        it('should show an alert if audio does not exist', () => {
            window.modalRecordings = {};
            const element = $('.pronunciation-check')[0];
            (app.aiService as any).downloadUserAudio(element);
            // This now matches the actual error message from the last run
            expect(window.alert).toHaveBeenCalledWith("Sorry, the audio file could not be found.");
        });
    });

    describe('AiService Additional Tests', () => {
        it('should handle error during spell API key validation', async () => {
            // Mock fetch to throw an error
            (global.fetch as any).mockRejectedValue(new Error('Network error'));
            await app.aiService.checkSpellApiKey();
            // App should remain with spellCheckerIsAvailable = false
            expect(app.spellCheckerIsAvailable).toBe(false);
        });

        it('should render warning if accuracy result is malformed', () => {
            const container = $('<div></div>');
            const badResult = { real_transcripts: 'hi', is_letter_correct_all_words: '', pronunciation_accuracy: 80 };
            (app.aiService as any).renderAccuracyResult(badResult, container);
            // Should render a warning message
            expect(container.html()).toContain('unexpected response');
        });

        it('should render accuracy with mismatched word lengths', () => {
            const container = $('<div></div>');
            const badResult = {
                real_transcripts: 'hello world',
                is_letter_correct_all_words: '11111', // Missing second word data
                pronunciation_accuracy: 90
            };
            (app.aiService as any).renderAccuracyResult(badResult, container);
            // Should render warning for mismatch
            expect(container.html()).toContain('Could not parse');
        });

        it('should show error if copyAIPrompt fails', async () => {
            app.utilService.copyTextToClipboard = vi.fn().mockResolvedValue(false);
            const element = document.createElement('button');
            await (app.aiService as any).copyAIPrompt(element);
            // Should trigger alert since copy failed
            expect(window.alert).toHaveBeenCalledWith("Could not copy the prompt to your clipboard. Please try again.");
        });

        it('should do nothing if no API key is provided', async () => {
            localStorage.removeItem(app.STORAGE_KEYS.spellApiKey); // Ensure no key in storage
            Object.defineProperty(window, 'location', {
                value: { search: '' } // No key in query string
            });

            await app.aiService.checkSpellApiKey();

            // Expect that spellCheckerIsAvailable remains false
            expect(app.spellCheckerIsAvailable).toBe(false);
            expect(localStorage.getItem(app.STORAGE_KEYS.spellApiKey)).toBeNull();
        });

    });

    describe('copyAIPrompt', () => {
        it('should restore button text after timeout', async () => {
            vi.useFakeTimers();
            app.utilService.copyTextToClipboard = vi.fn().mockResolvedValue(true);

            const button = document.createElement('button');
            button.innerHTML = 'Original';
            document.body.appendChild(button);

            await (app.aiService as any).copyAIPrompt(button);

            // After copy it should say "Copied!"
            expect(button.innerHTML).toContain('Copied!');

            // Fast-forward timers
            vi.advanceTimersByTime(2000);

            // After 2s, it should restore
            expect(button.innerHTML).toBe('Original');

            vi.useRealTimers();
        });
    });

});