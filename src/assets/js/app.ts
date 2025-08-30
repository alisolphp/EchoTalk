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

/**
 * Extend global interfaces to inform TypeScript about custom properties
 * on the Window object and new methods on the String prototype.
 */
declare global {
    interface Window {
        modalRecordings: Record<string, Recording[]>;
        deferredPrompt: any; // For PWA installation prompt
    }
    interface String {
        hashCode(): string;
    }
}

$(function () {
    // --- Constants ---
    const STORAGE_KEYS = {
        sentence: 'shadow_sentence',
        reps: 'shadow_reps',
        index: 'shadow_index',
        count: 'shadow_count',
        correctCount: 'shadow_correct',
        attempts: 'shadow_attempts',
        recordAudio: 'shadow_record_audio'
    };

    // --- State Variables ---
    let sentence: string = '';
    let words: string[] = [];
    let reps: number = 3;
    let currentIndex: number = 0;
    let currentCount: number = 0;
    let correctCount: number = 0;
    let attempts: number = 0;
    let samples: string[] = [];
    let currentPhrase: string = '';
    let isRecordingEnabled: boolean = false;

    const isMobile: boolean = /Mobi|Android/i.test(navigator.userAgent);
    let estimatedWordsPerSecond: number = 2.5; // Initial estimation: ~150 WPM
    let phrasesSpokenCount: number = 0;

    let practiceMode: 'skip' | 'check' = 'skip';

    let mediaRecorder: MediaRecorder | undefined;
    let db: IDBDatabase;
    window.modalRecordings = {};
    let currentlyPlayingAudioElement: HTMLAudioElement | null = null;
    let deferredPrompt: any;


    // --- Initialization ---

    for (let i = 1; i <= 20; i++) {
        if (![1, 2, 3, 5, 10, 20].includes(i)) {
            continue;
        }
        $('#repsSelect').append(`<option value="${i}">${i}</option>`);
    }

    /**
     * Initializes the IndexedDB database for storing audio recordings.
     */
    function initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EchoTalkDB', 1);
            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('recordings')) {
                    const store = db.createObjectStore('recordings', { autoIncrement: true });
                    store.createIndex('sentence', 'sentence', { unique: false });
                }
            };
            request.onsuccess = event => {
                db = (event.target as IDBOpenDBRequest).result;
                resolve(db);
            };
            request.onerror = event => {
                console.error('Database error:', (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }


    // --- Core Functions ---

    function saveRecording(blob: Blob, sentenceText: string): void {
        if (!db || blob.size === 0) return;
        const transaction = db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const record: Recording = {
            sentence: sentenceText,
            audio: blob,
            timestamp: new Date()
        };
        const request = store.add(record);
        request.onsuccess = () => console.log('Recording saved successfully.');
        request.onerror = (err) => console.error('Error saving recording:', err);
    }

    async function startRecording(): Promise<void> {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('#feedback').html('<div class="incorrect">Your browser does not support audio recording.</div>');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let localAudioChunks: Blob[] = [];

            const options = { mimeType: 'audio/ogg; codecs=opus' };
            mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType)
                ? new MediaRecorder(stream, options)
                : new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                localAudioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(localAudioChunks, { type: mediaRecorder?.mimeType });
                if (audioBlob.size > 0) {
                    saveRecording(audioBlob, currentPhrase);
                }
                mediaRecorder?.stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            $('#feedback').html('<div class="recording-indicator">Recording... <span class="dot"></span></div>');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            $('#feedback').html('<div class="incorrect">Could not access microphone. Please grant permission.</div>');
        }
    }

    function stopRecording(): Promise<void> {
        return new Promise(resolve => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
                mediaRecorder.stop();
            } else {
                resolve();
            }
        });
    }

    function saveState(): void {
        localStorage.setItem(STORAGE_KEYS.sentence, sentence);
        localStorage.setItem(STORAGE_KEYS.reps, reps.toString());
        localStorage.setItem(STORAGE_KEYS.index, currentIndex.toString());
        localStorage.setItem(STORAGE_KEYS.count, currentCount.toString());
        localStorage.setItem(STORAGE_KEYS.correctCount, correctCount.toString());
        localStorage.setItem(STORAGE_KEYS.attempts, attempts.toString());
    }

    function loadState(): void {
        const s = localStorage.getItem(STORAGE_KEYS.sentence);
        const r = parseInt(localStorage.getItem(STORAGE_KEYS.reps) || reps.toString());
        const idx = parseInt(localStorage.getItem(STORAGE_KEYS.index) || '0');
        const cnt = parseInt(localStorage.getItem(STORAGE_KEYS.count) || '0');
        const cc = parseInt(localStorage.getItem(STORAGE_KEYS.correctCount) || '0');
        const at = parseInt(localStorage.getItem(STORAGE_KEYS.attempts) || '0');
        const recordSetting = localStorage.getItem(STORAGE_KEYS.recordAudio);

        isRecordingEnabled = recordSetting === 'true';
        $('#recordToggle').prop('checked', isRecordingEnabled);

        if (s) sentence = s;
        if (!isNaN(r)) reps = r;
        if (!isNaN(idx)) currentIndex = idx;
        if (!isNaN(cnt)) currentCount = cnt;
        if (!isNaN(cc)) correctCount = cc;
        if (!isNaN(at)) attempts = at;
    }

    function fetchSamples(): JQuery.Promise<{ sentences: string[] }> {
        return $.getJSON('/assets/data/sentences.json').then(data => {
            samples = data.sentences;
            return data;
        });
    }

    function getPhraseBounds(startIndex: number, maxWords: number = 3): number {
        let endIndex = startIndex;
        let count = 0;
        while (endIndex < words.length && count < maxWords) {
            endIndex++;
            count++;
            if (/[.!?]/.test(words[endIndex - 1].slice(-1))) {
                break;
            }
        }
        return endIndex;
    }

    function pickSample(): string {
        return samples[Math.floor(Math.random() * samples.length)] || '';
    }

    function renderSampleSentence(): void {
        $('#sampleSentence').empty();
        words.forEach((w, i) => {
            const cls = i === currentIndex ? 'current-word' : '';
            $('#sampleSentence').append(`<span data-index="${i}" class="${cls}">${w}</span> `);
        });
    }

    function renderFullSentence(): void {
        $('#fullSentence').empty();
        let lastPunctuationIndex = -1;
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(words[i].slice(-1))) {
                lastPunctuationIndex = i;
                break;
            }
        }
        const startIndex = lastPunctuationIndex >= 0 ? lastPunctuationIndex + 1 : 0;
        words.forEach((w, i) => {
            let cls = '';
            if (i < startIndex) cls = 'text-muted';
            else if (i === currentIndex) cls = 'current-word';
            $('#fullSentence').append(`<span class="${cls}">${w}</span> `);
        });
    }

    function speak(text: string, onEnd?: (() => void) | null, rate: number = 1): void {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = rate;
        if (onEnd) {
            u.onend = onEnd;
        }
        speechSynthesis.speak(u);
    }

    function playSound(src: string, speed: number = 1): void {
        // Paths are relative to the root, as handled by Vite.
        const audio = new Audio(src.replace('./', '/'));
        audio.playbackRate = speed;
        audio.play();
    }

    /**
     * A hybrid karaoke-style text-to-speech function.
     * - For desktop, it uses the reliable `onboundary` event for precise word highlighting.
     * - For mobile (where `onboundary` is often buggy), it falls back to a timer-based
     * approach that self-adjusts its timing using a moving average (Kaizen).
     */
    function speakAndHighlight(text: string, onEnd?: (() => void) | null, speed: number = 1): void {
        const container = $('#sentence-container');
        container.empty();
        speechSynthesis.cancel();

        const phraseWords = text.split(' ');
        const wordSpans: HTMLElement[] = [];
        phraseWords.forEach(word => {
            const wordSpan = $('<span></span>').text(word).addClass('word');
            container.append(wordSpan).append(' ');
            if (wordSpan[0]) {
                wordSpans.push(wordSpan[0]);
            }
        });

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = speed;

        if (isMobile) {
            // Mobile fallback: Timer-based highlighting with self-correction.
            const delayPerWord = 1000 / estimatedWordsPerSecond / speed;
            phraseWords.forEach((word, index) => {
                setTimeout(() => {
                    $(wordSpans[index]).addClass('highlighted');
                }, index * delayPerWord);
            });

            let startTime: number;
            utterance.onstart = () => {
                startTime = performance.now();
            };
            utterance.onend = () => {
                const endTime = performance.now();
                const duration = (endTime - startTime) / 1000;
                // Refine the words-per-second estimation for the next playback.
                if (duration > 0.1) {
                    const currentWordsPerSecond = phraseWords.length / duration;
                    estimatedWordsPerSecond = (estimatedWordsPerSecond * phrasesSpokenCount + currentWordsPerSecond) / (phrasesSpokenCount + 1);
                    phrasesSpokenCount++;
                }
                if (onEnd) onEnd();
            };
        } else {
            // Desktop standard: Use `onboundary` event for accuracy.
            const wordBoundaries: number[] = [];
            let charCounter = 0;
            phraseWords.forEach(word => {
                wordBoundaries.push(charCounter);
                charCounter += word.length + 1;
            });
            utterance.onboundary = function (event: SpeechSynthesisEvent) {
                if (event.name === 'word') {
                    let wordIndex = -1;
                    for (let i = wordBoundaries.length - 1; i >= 0; i--) {
                        if (event.charIndex >= wordBoundaries[i]) {
                            wordIndex = i;
                            break;
                        }
                    }
                    if (wordIndex !== -1) {
                        $('.word.highlighted').removeClass('highlighted');
                        $(wordSpans[wordIndex]).addClass('highlighted');
                    }
                }
            };
            utterance.onend = function () {
                if (onEnd) onEnd();
            };
        }
        speechSynthesis.speak(utterance);
    }

    function practiceStep(speed: number = 1): void {
        if (currentIndex >= words.length) {
            return finishSession();
        }
        let lastPuncIndex = -1;
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(words[i].slice(-1))) {
                lastPuncIndex = i;
                break;
            }
        }
        const startIndex = lastPuncIndex >= 0 ? lastPuncIndex + 1 : 0;
        const endIndex = getPhraseBounds(currentIndex, 3);
        const phrase = words.slice(startIndex, endIndex).join(' ');
        currentPhrase = removeJunkCharsFromText(phrase);

        speakAndHighlight(phrase, isRecordingEnabled ? startRecording : null, speed);
        $('#sentence-container').on('click', '.word', function() {
            const word = $(this).text().trim().replace(/[.,!?;:"'(){}[\]]/g, '');
            const url = `https://www.google.com/search?q=meaning:+${encodeURIComponent(word)}`;
            window.open(url, '_blank');
        });
    }

    function removeJunkCharsFromText(text: string): string {
        return text.replace(/^[\s.,;:/\\()[\]{}"'«»!?-]+|[\s.,;:/\\()[\]{}"'«»!?-]+$/g, '');
    }

    function cleanText(text: string): string {
        return removeJunkCharsFromText(text.toLowerCase().trim().replace("&", "and"));
    }

    function setupPracticeUI(): void {
        const userInputGroup = $('#userInput').parent();
        if (practiceMode === 'check') {
            $('#instructionText').text('Now it’s your turn. Tap the mic icon on your keyboard and speak the word.').show();
            userInputGroup.show();
            $('#userInput').trigger('focus');
            $('#checkBtn').text('Check/Skip');
        } else { // 'skip' mode
            $('#instructionText').text('Listen, repeat to yourself, then click "Next Phrase".').show();
            userInputGroup.hide();
            $('#checkBtn').text('Next Phrase');
        }
    }

    function advanceToNextPhrase(): void {
        if (isRecordingEnabled) {
            stopRecording();
        }
        const endIndex = getPhraseBounds(currentIndex, 3);
        currentIndex = endIndex;
        currentCount = 0;
        if (currentIndex >= words.length) {
            finishSession();
            return;
        }
        saveState();
        renderFullSentence();
        practiceStep();
    }

    function calculateWordSimilarity(targetStr: string, answerStr: string): number {
        const targetWords = targetStr.split(/\s+/).filter(Boolean);
        const answerWords = answerStr.split(/\s+/).filter(Boolean);

        if (targetWords.length === 0) {
            return answerWords.length === 0 ? 1 : 0;
        }

        let correctWords = 0;
        const minLength = Math.min(targetWords.length, answerWords.length);
        for (let i = 0; i < minLength; i++) {
            if (targetWords[i] === answerWords[i]) {
                correctWords++;
            }
        }
        return correctWords / targetWords.length;
    }

    async function checkAnswer(): Promise<void> {
        if (isRecordingEnabled) {
            await stopRecording();
        }

        let lastPuncIndex = -1;
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (/[.!?]/.test(words[i].slice(-1))) {
                lastPuncIndex = i;
                break;
            }
        }
        const startIndex = lastPuncIndex >= 0 ? lastPuncIndex + 1 : 0;
        const endIndex = getPhraseBounds(currentIndex, 3);
        const target = cleanText(words.slice(startIndex, endIndex).join(' '));
        const userInput = $('#userInput') as JQuery<HTMLInputElement>;
        let answer = cleanText(userInput.val() as string);

        if (answer === "") {
            advanceToNextPhrase();
            return;
        }

        userInput.val('');
        attempts++;
        const similarityThreshold = 0.6;
        const similarity = calculateWordSimilarity(target, answer);
        const similarityPercent = Math.round(similarity * 100);

        if (similarity >= similarityThreshold) {
            correctCount++;
            currentCount++;
            playSound('./assets/sounds/correct.mp3');
            $('#feedback').html(`<div class="correct">Correct! (${similarityPercent}% match) - (${currentCount}/${reps})</div>`);
            if (currentCount >= reps) {
                currentIndex = endIndex;
                currentCount = 0;
            }
            saveState();
            setTimeout(() => {
                renderFullSentence();
                practiceStep();
            }, 1200);
        } else {
            playSound('./assets/sounds/wrong.mp3');
            $('#feedback').html(`<div class="incorrect">Try again! (${similarityPercent}% match) <br>Detected: "${answer}"</div>`);
            saveState();
        }
    }

    function finishSession(): void {
        const messages = ["You nailed it! Keep that energy flowing.", "That was sharp! Your pronunciation is leveling up.", "Boom! Another step closer to fluency.", "Bravo! You’re sounding more native by the minute.", "That was smooth! English is no match for you.", "Great shadowing! Your ears and tongue are in sync.", "You crushed it! That accent’s getting crisp.", "Smart move! Your brain just got a little more bilingual.", "Echo mastered. You’re becoming a language ninja.", "That was fire! Keep shadowing like a boss."];
        const emojis = ["🔥", "🎯", "💪", "🎉", "🚀", "👏", "🌟", "🧠", "🎧", "💥"];
        let ttsMsg = messages[Math.floor(Math.random() * messages.length)];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        let displayMsg = `${emoji} ${ttsMsg}`;

        if (practiceMode === 'check') {
            const accuracy = attempts ? Math.round((correctCount / attempts) * 100) : 100;
            const accuracyText = ` Your accuracy: ${accuracy}%.`;
            displayMsg += accuracyText;
            ttsMsg += accuracyText;
        }

        const callToActions = ["Let's Start Over!", "Go Again!", "Ready for Another Round?", "Let's Go Again!", "Let's Do This!", "Bring It On!"];
        const callToAction = callToActions[Math.floor(Math.random() * callToActions.length)];
        ttsMsg += ` ${callToAction}`;

        playSound('./assets/sounds/victory.mp3', 2);
        setTimeout(() => speak(ttsMsg), 1500);

        displayMsg += `<br><a class="btn btn-success mt-2" href="#" onclick="location.reload(); return false;">${callToAction}</a>`;
        $('#practiceArea').html(`<h2>${displayMsg}</h2>`);

        localStorage.removeItem(STORAGE_KEYS.index);
        localStorage.removeItem(STORAGE_KEYS.count);
        localStorage.removeItem(STORAGE_KEYS.correctCount);
        localStorage.removeItem(STORAGE_KEYS.attempts);
    }

    function truncateSentence(sentence: string): string {
        const words = sentence.split(' ');
        if (words.length > 4) {
            return `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`;
        }
        return sentence;
    }

    /**
     * Simple hash function to generate a unique ID from a string.
     * Used for creating unique IDs for accordion elements.
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

    async function displayRecordings(): Promise<void> {
        if (!db) return;
        const transaction = db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        const allRecords: Recording[] = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (err) => reject(err);
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
            $list.html('<p class="text-center text-muted">No recordings found yet. Enable `Record my voice` option, then start practicing!</p>');
            return;
        }

        const sortedSentences = Object.keys(grouped).sort((a, b) => {
            const lastA = Math.max(...grouped[a].map(r => r.timestamp ? new Date(r.timestamp).getTime() : 0));
            const lastB = Math.max(...grouped[b].map(r => r.timestamp ? new Date(r.timestamp).getTime() : 0));
            return lastB - lastA;
        });

        for (const sentence of sortedSentences) {
            const recordings = grouped[sentence];
            recordings.sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0));

            const firstValidRecord = recordings.find(r => r.timestamp);
            if (!firstValidRecord) continue;

            const lastRecTime = new Date(firstValidRecord.timestamp);
            const count = recordings.length;
            const truncated = truncateSentence(sentence);
            const uniqueId = sentence.hashCode();
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
                  <div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#recordingsList">
                      <div class="accordion-body">
                          <ul class="list-group">
                              ${recordings.map((rec, index) => `
                                  <li class="list-group-item d-flex justify-content-between align-items-center">
                                      <span>Recording from ${rec.timestamp ? new Date(rec.timestamp).toLocaleString() : 'an old date'}</span>
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


    // --- Event Handlers ---

    $('#recordToggle').on('change', function() {
        isRecordingEnabled = $(this).is(':checked');
        localStorage.setItem(STORAGE_KEYS.recordAudio, String(isRecordingEnabled));
    });

    $('#startBtn').on('click', () => {
        practiceMode = ($('input[name="practiceMode"]:checked').val() as 'skip' | 'check');
        sentence = ($('#sentenceInput').val() as string).trim();
        sentence = sentence.replace(/([^\.\?\!\n])\n/g, '$1.\n');
        words = sentence.split(/\s+/).filter(w => w.length > 0);
        reps = parseInt(($('#repsSelect').val() as string));
        currentIndex = 0;
        currentCount = 0;
        correctCount = 0;
        attempts = 0;
        saveState();

        $('#configArea').addClass('d-none');
        $('#practiceArea').removeClass('d-none');
        setupPracticeUI();
        renderFullSentence();
        practiceStep();
    });

    $('#resetBtn').on('click', () => {
        speechSynthesis.cancel();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        localStorage.clear();
        location.reload();
    });

    $('#checkBtn').on('click', () => {
        if (practiceMode === 'check') {
            checkAnswer();
        } else {
            advanceToNextPhrase();
        }
    });

    $('#userInput').on('keypress', (e: JQuery.KeyPressEvent) => {
        if (e.key === 'Enter' && practiceMode === 'check') {
            checkAnswer();
        }
    });

    $('#useSampleBtn').on('click', () => {
        sentence = pickSample();
        ($('#sentenceInput') as JQuery<HTMLTextAreaElement>).val(sentence);
        words = sentence.split(/\s+/).filter(w => w.length > 0);
        currentIndex = 0;
        renderSampleSentence();
        saveState();
    });

    $('#sampleSentence').on('click', 'span', function() {
        const newIndex = $(this).data('index');
        if (typeof newIndex === 'number') {
            currentIndex = newIndex;
            renderSampleSentence();
            saveState();
        }
    });

    $('#repeatBtn').on('click', () => practiceStep(0.6));

    $('#showRecordingsBtn').on('click', displayRecordings);

    $('#recordingsList').on('click', '.play-user-audio', function(e: JQuery.ClickEvent) {
        e.preventDefault();

        if (currentlyPlayingAudioElement) {
            currentlyPlayingAudioElement.pause();
            URL.revokeObjectURL(currentlyPlayingAudioElement.src);
        }

        const sentence = $(this).data('sentence') as string;
        const index = $(this).data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];

        if (record && record.audio) {
            const audioUrl = URL.createObjectURL(record.audio);
            const audio = new Audio(audioUrl);
            currentlyPlayingAudioElement = audio;

            audio.onended = function() {
                URL.revokeObjectURL(audioUrl);
                currentlyPlayingAudioElement = null;
            };

            audio.play().catch(err => {
                console.error("Error playing audio with <audio> tag:", err);
                URL.revokeObjectURL(audioUrl);
                currentlyPlayingAudioElement = null;
            });

        } else {
            console.warn("No audio blob found for this record.");
        }
    });

    $('#recordingsList').on('click', '.play-bot-audio', function() {
        const sentence = $(this).data('sentence') as string;
        speak(sentence);
    });

    $('#recordingsModal').on('hidden.bs.modal', function() {
        if (currentlyPlayingAudioElement) {
            currentlyPlayingAudioElement.pause();
            URL.revokeObjectURL(currentlyPlayingAudioElement.src);
            currentlyPlayingAudioElement = null;
        }
        window.modalRecordings = {};
    });

    // --- PWA Installation ---

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        $('#installBtn').removeClass('d-none');
    });

    $('#installBtn').on('click', () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            $('#installBtn').addClass('d-none');
        });
    });

    // --- Initial Load ---

    $.when(fetchSamples(), initDB()).then(() => {
        loadState();
        if (!sentence) {
            sentence = pickSample();
        }
        ($('#sentenceInput') as JQuery<HTMLTextAreaElement>).val(sentence);
        words = sentence.split(/\s+/).filter(w => w.length > 0);
        ($('#repsSelect') as JQuery<HTMLSelectElement>).val(reps.toString());
        renderSampleSentence();
    });
});