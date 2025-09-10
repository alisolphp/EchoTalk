import $ from 'jquery';
import { Modal } from 'bootstrap';
import { EchoTalkApp } from '../app';
import {
    getTranslatePrompt,
    getGrammarAnalysisPrompt,
    getVocabularyExpansionPrompt,
    getContextNuancePrompt,
    getCreativePracticePrompt,
    getPronunciationAnalysisPrompt
} from './prompts.service';

/**
 * Service responsible for all interactions with AI,
 * including prompt generation for analysis and API key validation.
 */
export class AiService {
    private app: EchoTalkApp;
    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /**
     * Checks if a spell checker API key is provided either in the URL or localStorage.
     * If found, it validates the key with a backend service and updates the app state.
     */
    public async checkSpellApiKey(): Promise<void> {
        localStorage.setItem(this.app.STORAGE_KEYS.spellCheckerIsAvailable, String(false));
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const apiKey = urlParams.get('spellApiKey') || localStorage.getItem(this.app.STORAGE_KEYS.spellApiKey);
            if (apiKey) {
                localStorage.setItem(this.app.STORAGE_KEYS.spellApiKey, apiKey.toString());
                this.app.spellApiKey = apiKey;
                const response = await fetch(`https://alisol.ir/Projects/GetAccuracyFromRecordedAudio/?action=checkAPIKey&spellApiKey=${this.app.spellApiKey}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success' && result.message === 'api_key_is_valid') {
                        this.app.spellCheckerIsAvailable = true;
                        localStorage.setItem(this.app.STORAGE_KEYS.spellCheckerIsAvailable, String(this.app.spellCheckerIsAvailable));
                        console.log('Spell checker API key is valid and available.');
                    }
                }
            }
        } catch (error) {
            console.error('Error validating spell checker API key:', error);
        }
    }

    /**
     * Generates a detailed prompt for GPT to translate and explain a sentence.
     * The generated prompt is copied to the user's clipboard.
     * @param element The button element that triggered the action, used for UI feedback.
     */
    public async handleTranslateWithGpt(element: HTMLElement): Promise<void> {
        const sentence = this.app.currentPhrase;
        if (!sentence) return;
        const promptText = getTranslatePrompt(sentence, this.app.langGeneral);
        const success = await this.app.utilService.copyTextToClipboard(promptText);
        if (success) {
            this.app.uiService.showCopySuccessFeedback(element, 'https://chatgpt.com/');
        } else {
            alert("Could not copy the prompt to your clipboard.");
        }
    }

    /**
     * Generates a prompt for GPT to perform a grammatical analysis of a sentence.
     * The prompt is copied to the user's clipboard.
     * @param element The button element that triggered the action.
     */
    public async handleGrammarAnalysis(element: HTMLElement): Promise<void> {
        const sentence = this.app.currentPhrase;
        if (!sentence) return;

        const promptText = getGrammarAnalysisPrompt(sentence, this.app.langGeneral);

        const success = await this.app.utilService.copyTextToClipboard(promptText);
        if (success) {
            this.app.uiService.showCopySuccessFeedback(element, 'https://chatgpt.com/');
        } else {
            alert("Could not copy the prompt to your clipboard.");
        }
    }

    /**
     * Generates a prompt for GPT to provide vocabulary expansion based on a sentence.
     * The prompt is copied to the user's clipboard.
     * @param element The button element that triggered the action.
     */
    public async handleVocabularyExpansion(element: HTMLElement): Promise<void> {
        const sentence = this.app.currentPhrase;
        if (!sentence) return;

        const promptText = getVocabularyExpansionPrompt(sentence, this.app.langGeneral);

        const success = await this.app.utilService.copyTextToClipboard(promptText);
        if (success) {
            this.app.uiService.showCopySuccessFeedback(element, 'https://chatgpt.com/');
        } else {
            alert("Could not copy the prompt to your clipboard.");
        }
    }

    /**
     * Generates a prompt for GPT to explain the context and nuance of a sentence.
     * The prompt is copied to the user's clipboard.
     * @param element The button element that triggered the action.
     */
    public async handleContextNuance(element: HTMLElement): Promise<void> {
        const sentence = this.app.currentPhrase;
        if (!sentence) return;

        const promptText = getContextNuancePrompt(sentence, this.app.langGeneral);

        const success = await this.app.utilService.copyTextToClipboard(promptText);
        if (success) {
            this.app.uiService.showCopySuccessFeedback(element, 'https://chatgpt.com/');
        } else {
            alert("Could not copy the prompt to your clipboard.");
        }
    }

    /**
     * Generates a prompt for GPT to create creative practice exercises based on a sentence.
     * The prompt is copied to the user's clipboard.
     * @param element The button element that triggered the action.
     */
    public async handleCreativePractice(element: HTMLElement): Promise<void> {
        const sentence = this.app.currentPhrase;
        if (!sentence) return;

        const promptText = getCreativePracticePrompt(sentence, this.app.langGeneral);
        const success = await this.app.utilService.copyTextToClipboard(promptText);
        if (success) {
            this.app.uiService.showCopySuccessFeedback(element, 'https://chatgpt.com/');
        } else {
            alert("Could not copy the prompt to your clipboard.");
        }
    }

    /**
     * Sends a recorded audio file to a backend service for pronunciation accuracy analysis.
     * @param element The button element that triggered the analysis.
     */
    public async getPronunciationAccuracy(element: HTMLElement): Promise<void> {
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

            const endpointUrl = `https://alisol.ir/Projects/GetAccuracyFromRecordedAudio/?spellApiKey=${this.app.spellApiKey}`;
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

    /**
     * Renders the pronunciation accuracy results received from the server.
     * It displays an overall score and highlights correct/incorrect letters in the sentence.
     * @param result The accuracy data returned from the API.
     * @param $container The jQuery element where the results should be displayed.
     */
    private renderAccuracyResult(result: any, $container: JQuery<HTMLElement>): void {
        if (!result.real_transcripts || !result.is_letter_correct_all_words || !result.pronunciation_accuracy) {
            $container.html('<div class="alert alert-warning p-2">The server returned an unexpected response.</div>');
            return;
        }

        const words = result.real_transcripts.split(' ');
        const correctness = result.is_letter_correct_all_words.trim().split(' ');
        if (words.length !== correctness.length) {
            $container.html('<div class="alert alert-warning p-2">Could not parse the accuracy data from the server.</div>');
            return;
        }

        let coloredSentenceHtml = words.map((word: string, wordIndex: number) => {
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
        
            <p class="text-muted mb-0"><small><strong>Detected:</strong> <em>${detectedTranscript}</em></small></p>`;
        $container.html(resultHtml);
    }

    /**
     * Prepares for a full AI analysis by another service (like Gemini).
     * It copies a detailed analysis prompt to the clipboard and triggers the download
     * of the user's recorded audio file.
     * @param element The button element that triggered the action.
     */
    public async prepareForAIAnalysis(element: HTMLElement): Promise<void> {
        await this.copyAIPrompt(element);
        this.downloadUserAudio(element);
        const sentence = $(element).data('sentence') as string;

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

        $('#aiInstructionsModalBody').html(modalBodyContent);

        const modalElement = document.getElementById('aiInstructionsModal');
        if (modalElement) {
            const modal = Modal.getOrCreateInstance(modalElement);
            modal.show();
        }
    }

    /**
     * Finds the user's audio recording and triggers a browser download for it.
     * @param element The element containing data attributes about the recording.
     */
    private downloadUserAudio(element: HTMLElement): void {
        const sentence = $(element).data('sentence') as string;
        const index = $(element).data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];
        if (record && record.audio) {
            const audioUrl = URL.createObjectURL(record.audio);
            const link = document.createElement('a');
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
     * Generates a prompt for analyzing a user's audio recording and copies it to the clipboard.
     * This prompt instructs an AI (like Gemini) on how to score pronunciation and fluency.
     * @param element The element containing the sentence data for the prompt.
     */
    private async copyAIPrompt(element: HTMLElement): Promise<void> {
        const sentence = $(element).data('sentence') as string;
        const promptText = getPronunciationAnalysisPrompt(sentence, this.app.langGeneral);
        const success = await this.app.utilService.copyTextToClipboard(promptText);
        if (success) {
            const $element = $(element);
            const originalHtml = $element.html();
            $element.html('<i class="bi bi-check-lg"></i> Copied!');
            $element.prop('disabled', true);
            setTimeout(() => {
                $element.html(originalHtml);
                $element.prop('disabled', false);
            }, 2000);
        } else {
            alert("Could not copy the prompt to your clipboard. Please try again.");
        }
    }
}