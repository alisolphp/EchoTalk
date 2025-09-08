import $ from 'jquery';
import { EchoTalkApp } from '../app';

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
        const promptText = `You are a professional, patient, and encouraging language teacher.
Your role is not just to translate but to guide me like a personal mentor, helping me deeply understand and *remember* every element of the given sentence.
Imagine you are teaching me in a one-on-one lesson where clarity, memory retention, and motivation matter most.

Task: Please translate the following sentence into the language I feel most comfortable with.
But don’t stop at translation — teach me step by step in a way that makes the sentence unforgettable.

When crafting your output, follow these steps:

1. Fluent Translation: Provide a smooth, natural translation of the whole sentence.
2. Word-by-Word Breakdown: List every word from the original sentence, explain its meaning clearly, and highlight nuances where helpful.
3. Phonetic / Mnemonic Aid: For tricky words, add a phonetic hint or mnemonic (sound-alike trick, short story, or playful connection) that makes the word easy to recall.
4. Examples in Context: Show at least one simple, real-world example sentence for important words so I see how they are used naturally.
5. Visualization / Metaphor: Suggest an image, metaphor, or scenario that allows me to *visualize* and emotionally connect with the meaning.
6. Summary in Plain Words: Rephrase the whole sentence in simpler, everyday language so I can fully grasp its meaning and usage.
7. Active Recall Practice: End with an interactive element — e.g., a quiz-style question, a short fill-in-the-blank, or asking me to re-express the idea in my own words.
8. Motivation & Encouragement: Wrap up warmly, motivating me to keep practicing. Specifically, encourage me to continue shadowing practice in the EchoTalk app to strengthen fluency and confidence.
9. Language of Output: Present all section titles and explanations in the language I feel most comfortable with (probably it's not ${this.langGeneral}), so the learning experience feels natural, supportive, and personal.

Sentence:
"${sentence}"`;
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

        const promptText = `You are a meticulous and clear grammar instructor. Your task is to dissect the following sentence grammatically for a language learner. Avoid overly technical jargon and explain everything in a simple, intuitive way.

For the sentence below, provide the following breakdown:
1.  **Identify Parts of Speech:** List each word and identify its part of speech (e.g., noun, verb, adjective, preposition).
2.  **Sentence Structure:** Explain the main structure (e.g., Subject-Verb-Object). Identify the main subject and the main verb.
3.  **Verb Tense and Form:** What is the verb's tense (e.g., Present Simple, Past Perfect)? Explain why this tense is used here.
4.  **Key Grammar Concepts:** Point out 1-2 important grammar rules or concepts demonstrated in this sentence that a learner should pay attention to (e.g., use of articles, phrasal verbs, clauses).
5. Motivation & Encouragement: Wrap up warmly, motivating me to keep practicing. Specifically, encourage me to continue shadowing practice in the EchoTalk app to strengthen fluency and confidence.
6. Language of Output: Present all section titles and explanations in the language I feel most comfortable with (probably it's not ${this.langGeneral}), so the learning experience feels natural, supportive, and personal.

Present your analysis in a clear, organized format. All explanations should be in the language I am most comfortable with to ensure full understanding.

Sentence:
"${sentence}"`;

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

        const promptText = `You are a helpful vocabulary coach. Your goal is to help me expand my vocabulary based on the key words in the sentence provided.

For the sentence below, please perform the following steps:
1.  **Identify Key Vocabulary:** Select the 2-3 most important or useful words from the sentence (not common words like 'a', 'the', 'is').
2.  **For Each Key Word, Provide:**
    * **Meaning:** A simple, clear definition.
    * **Synonyms:** List 2-3 synonyms (words with similar meaning).
    * **Antonyms:** List 1-2 antonyms (words with the opposite meaning), if applicable.
    * **Example Sentence:** Provide a new, simple sentence using the key word to show its context.
3. Motivation & Encouragement: Wrap up warmly, motivating me to keep practicing. Specifically, encourage me to continue shadowing practice in the EchoTalk app to strengthen fluency and confidence.
4. Language of Output: Present all section titles and explanations in the language I feel most comfortable with (probably it's not ${this.langGeneral}), so the learning experience feels natural, supportive, and personal.

Please format the output clearly for easy learning. All explanations should be in the language I am most comfortable with.

Sentence:
"${sentence}"`;

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

        const promptText = `You are a cultural and linguistic expert. Your task is to help me understand the subtle nuances and appropriate context for using the following sentence.

Please analyze the sentence and answer these questions:
1.  **Formality Level:** How formal or informal is this sentence? (e.g., Very Formal, Neutral, Casual, Slang).
2.  **Common Scenarios:** In what kind of real-life situations would a native speaker use this sentence? (e.g., at work, with friends, in a formal speech).
3.  **Emotional Tone:** What is the likely emotional tone behind this sentence? (e.g., happy, frustrated, sarcastic, neutral).
4.  **Idioms or Expressions:** Does the sentence contain any idioms, phrasal verbs, or common expressions? If so, explain what they mean.
5. Motivation & Encouragement: Wrap up warmly, motivating me to keep practicing. Specifically, encourage me to continue shadowing practice in the EchoTalk app to strengthen fluency and confidence.
6. Language of Output: Present all section titles and explanations in the language I feel most comfortable with (probably it's not ${this.langGeneral}), so the learning experience feels natural, supportive, and personal.

Provide your analysis in the language I am most comfortable with.

Sentence:
"${sentence}"`;

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

        const promptText = `You are a creative writing partner for a language learner. Your goal is to help me practice using the grammar and vocabulary from a sentence I've learned.

Based on the sentence below, please do the following:
1.  **Create a Variation:** Write one new sentence that uses a similar grammatical structure but changes the topic.
2.  **Create an Opposite:** Write one new sentence that expresses the opposite idea.
3.  **Ask a Question:** Form a question that could be answered with the original sentence.
4.  **Fill in the Blank:** Provide a short "fill-in-the-blank" exercise based on a key word or phrase from the sentence for me to complete.

# IMPORTANT:
- Motivation & Encouragement: Wrap up warmly, motivating me to keep practicing. Specifically, encourage me to continue shadowing practice in the EchoTalk app to strengthen fluency and confidence.
- Language of Output: Present all section titles and explanations in the language I feel most comfortable with (probably it's not ${this.langGeneral}), so the learning experience feels natural, supportive, and personal.

Present everything in a fun, encouraging way, and provide all instructions in the language I am most comfortable with.

Sentence:
"${sentence}"`;

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

        const promptText = `You are an AI language model. Your task is to analyze pronunciation and fluency in the attached audio file.

IMPORTANT:
- If you cannot actually analyze the user's audio for pronunciation or fluency, respond honestly with exactly:
"I do not have the capability to analyze audio pronunciation. Please use another service or chatbot for this."
- Do NOT make up scores, word-level feedback, or fluency analysis under any circumstances. Accuracy and honesty are mandatory.

Now, if an audio file is provided, perform the following analysis for the target sentence:
"${sentence}"

Analysis instructions:
1. **Overall Score (1-10):** Provide an overall pronunciation score for the full sentence.
2. **Word-by-Word Analysis:**
   * List each word from the sentence.
   * Assign a pronunciation score (1-10) to each word.
   * If a word has issues, clearly explain the error (e.g., vowel sound, stress, intonation) and give practical correction tips.
3. **Fluency Score (1-10):** Evaluate how fluent and natural the speech sounds.
4. **General Recommendations:** Provide guidance for improving pronunciation of this sentence.
5. **Motivation:** Encourage the user to continue practicing with EchoTalk to improve speaking skills.
6. **Language of Output:** Present all section titles and explanations in the language I feel most comfortable with (probably it's not ${this.langGeneral}), so the learning experience feels natural, supportive, and personal.


If no audio file is attached, respond ONLY with this exact message:
"Please download your recorded audio for "${sentence}" sentence from the EchoTalk app and send it to me as an attachment for analysis."`;


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