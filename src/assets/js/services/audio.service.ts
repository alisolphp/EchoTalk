import $ from 'jquery';
import { EchoTalkApp } from '../app';

export class AudioService {
    private app: EchoTalkApp;
    private mediaRecorder: MediaRecorder | undefined;
    private stream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private visualizerFrameId: number | null = null;
    private visualizerActive: boolean = false;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    public checkTTSVoice(lang: string): Promise<boolean> {
        return new Promise((resolve) => {
            let timeoutId: number | null = null;

            const findVoice = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                const voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                    const hasLocalVoice = voices.some(voice => voice.lang === lang && voice.localService);
                    resolve(hasLocalVoice);
                    return;
                }
            };
            speechSynthesis.onvoiceschanged = () => findVoice();
            findVoice();
            timeoutId = setTimeout(() => {
                const voices = speechSynthesis.getVoices();
                if (voices.length === 0) {
                    console.warn('TTS voice list did not populate in time, assuming a voice is available.');
                    resolve(true);
                } else {
                    const hasLocalVoice = voices.some(voice => voice.lang === lang && voice.localService);
                    resolve(hasLocalVoice);
                }
            }, 500);
        });
    }

    public async initializeMicrophoneStream(): Promise<void> {
        if (!this.app.isRecordingEnabled || this.stream) {
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('#feedback-text').html('<div class="incorrect">Your browser does not support audio recording.</div>');
            console.error("Audio recording is not supported.");
            return;
        }
        try {
            const constraints: MediaStreamConstraints = {
                audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true }
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(this.stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
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
                    this.app.dataService.saveRecording(audioBlob);
                }
                localAudioChunks = [];
            };
        } catch (err) {
            console.error('Error accessing microphone:', err);
            $('#feedback-text').html('<div class="incorrect">Could not access microphone. Please grant permission.</div>');
            this.app.isRecordingEnabled = false;
            $('#recordToggle').prop('checked', false);
        }
    }

    public terminateMicrophoneStream(): void {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.mediaRecorder = undefined;
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

    public async startRecording(): Promise<void> {
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            this.mediaRecorder.start();
            $('#feedback-text').html('Speak aloud...').addClass('recording-text-indicator');
            this.monitorAudioLevel();
        }
    }

    public stopRecording(): Promise<void> {
        if (this.visualizerFrameId) {
            cancelAnimationFrame(this.visualizerFrameId);
            this.visualizerFrameId = null;
        }
        const visualizerElement = document.getElementById('soundWaveVisualizer');
        if (visualizerElement) {
            visualizerElement.classList.remove('active');
            visualizerElement.style.height = `0vh`;
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

    private monitorAudioLevel(): void {
        if (!this.analyser) return;
        const visualizerElement = document.getElementById('soundWaveVisualizer');
        if (!visualizerElement) return;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const threshold = 20;
        const checkSound = () => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            const energy = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
            if (energy > threshold) {
                if (!this.visualizerActive) {
                    this.visualizerActive = true;
                    visualizerElement.classList.add('active');
                    const randomHeight = 40 + Math.random() * 10;
                    visualizerElement.style.height = `${randomHeight}vh`;
                }
            } else {
                if (this.visualizerActive) {
                    this.visualizerActive = false;
                    visualizerElement.classList.remove('active');
                    visualizerElement.style.height = `0vh`;
                }
            }
            this.visualizerFrameId = requestAnimationFrame(checkSound);
        };
        checkSound();
    }

    public speak(text: string, onEnd?: (() => void) | null, rate: number | null = null, lang: string | null = null, volume: number | null = null): void {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || this.app.lang;
        u.rate = typeof rate === 'number' ? rate : this.app.speechRate;
        if (typeof volume === 'number') {
            u.volume = Math.max(0, Math.min(1, volume));
        }
        if (onEnd) {
            u.onend = onEnd;
        }
        speechSynthesis.speak(u);
    }

    public playSound(src: string, speed: number = 1, volume: number = 1): void {
        const audio = new Audio(src);
        audio.playbackRate = speed;
        audio.volume = Math.max(0, Math.min(volume, 1));
        audio.play();
    }

    public speakAndHighlight(text: string, onEnd?: (() => void) | null, speed: number = 1): void {
        const container = $('#sentence-container');
        container.empty();
        speechSynthesis.cancel();
        const phraseWords = text.split(' ');
        const wordSpans: HTMLElement[] = phraseWords.map(word => $('<span></span>').text(word).addClass('word')[0]);
        wordSpans.forEach((span, index) => {
            container.append(span);
            if (index < wordSpans.length - 1) container.append(' ');
        });

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.app.lang;
        utterance.rate = speed * this.app.speechRate;
        let startTime: number;

        utterance.onstart = () => {
            startTime = performance.now();
        };

        utterance.onend = () => {
            const duration = (performance.now() - startTime) / 1000;
            if (this.app.isMobile && duration > 0.1) {
                const currentWPS = phraseWords.length / duration;
                this.app.estimatedWordsPerSecond = (this.app.estimatedWordsPerSecond * this.app.phrasesSpokenCount + currentWPS) / (this.app.phrasesSpokenCount + 1);
                this.app.phrasesSpokenCount++;
            }
            if (this.app.practiceMode === 'auto-skip') {
                this.app.currentCount++;
                const $checkBtn = $('#checkBtn');
                const waitTime = duration * 1.5;
                $checkBtn.removeClass('loading');
                void $checkBtn[0].offsetHeight;
                $checkBtn.css('animation-duration', `${waitTime}s`);
                $checkBtn.addClass('loading');
                this.app.autoSkipTimer = setTimeout(() => {
                    if (this.app.currentCount >= this.app.reps) {
                        this.app.practiceService.advanceToNextPhrase();
                    } else {
                        this.app.practiceService.practiceStep();
                    }
                }, (waitTime * 1000) + 50);
            }
            if (onEnd) onEnd();
        };

        if (this.app.isMobile) {
            const delayPerWord = 900 / (this.app.estimatedWordsPerSecond * speed);
            phraseWords.forEach((word, index) => {
                setTimeout(() => $(wordSpans[index]).addClass('highlighted'), index * delayPerWord);
            });
        } else {
            const wordBoundaries: number[] = [];
            let charCounter = 0;
            phraseWords.forEach(word => {
                wordBoundaries.push(charCounter);
                charCounter += word.length + 1;
            });
            utterance.onboundary = (event: SpeechSynthesisEvent) => {
                if (event.name === 'word') {
                    let wordIndex = wordBoundaries.findIndex(boundary => event.charIndex < boundary) - 1;
                    if (wordIndex === -2) wordIndex = wordBoundaries.length - 1;
                    $('.word.highlighted').removeClass('highlighted');
                    $(wordSpans[wordIndex]).addClass('highlighted');
                }
            };
        }

        speechSynthesis.speak(utterance);
        ($('#userInput') as JQuery<HTMLInputElement>).focus();
    }

    public playUserAudio(element: HTMLElement): void {
        this.stopAllPlayback(true);
        const sentence = $(element).data('sentence') as string;
        const index = $(element).data('index') as number;
        const record = window.modalRecordings[sentence]?.[index];
        if (record && record.audio) {
            const audioUrl = URL.createObjectURL(record.audio);
            const audio = new Audio(audioUrl);
            this.app.currentlyPlayingAudioElement = audio;
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.app.currentlyPlayingAudioElement = null;
            };
            audio.play().catch(err => {
                console.error("Error playing audio:", err);
                URL.revokeObjectURL(audioUrl);
                this.app.currentlyPlayingAudioElement = null;
            });
        }
    }

    public playBotAudio(element: HTMLElement): void {
        this.stopAllPlayback(true);
        const sentence = $(element).data('sentence') as string;
        const sentenceLang = $(element).data('lang') as string;
        this.speak(sentence, null, 1, sentenceLang);
    }

    public stopAllPlayback(keepTTS: boolean = false): void {
        if (this.app.currentlyPlayingAudioElement) {
            this.app.currentlyPlayingAudioElement.pause();
            URL.revokeObjectURL(this.app.currentlyPlayingAudioElement.src);
            this.app.currentlyPlayingAudioElement = null;
        }
        if (!keepTTS) {
            speechSynthesis.cancel();
        }
    }
}