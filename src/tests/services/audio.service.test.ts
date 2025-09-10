import { EchoTalkApp } from '../../app';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';
import $ from 'jquery';

describe('AudioService', () => {
    let app: EchoTalkApp;
    let audioService: EchoTalkApp['audioService'];

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="feedback-text"></div>
            <input id="recordToggle" type="checkbox" />
            <div id="soundWaveVisualizer"></div>
            <div id="sentence-container"></div>
            <button id="checkBtn"></button>
            <input id="userInput" />
        `;
        app = new EchoTalkApp();
        audioService = app.audioService;

        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('checkTTSVoice', () => {
        it('should resolve true if a local voice is found immediately', async () => {
            (window.speechSynthesis.getVoices as any).mockReturnValue([
                { lang: 'en-US', localService: true }
            ]);
            await expect(audioService.checkTTSVoice('en-US')).resolves.toBe(true);
        });

        it('should resolve false if no local voice is found', async () => {
            (window.speechSynthesis.getVoices as any).mockReturnValue([
                { lang: 'en-US', localService: false },
                { lang: 'de-DE', localService: true }
            ]);
            await expect(audioService.checkTTSVoice('en-US')).resolves.toBe(false);
        });

        it('should handle onvoiceschanged event', async () => {
            const getVoicesMock = (window.speechSynthesis.getVoices as any);
            getVoicesMock.mockReturnValue([]);

            const promise = audioService.checkTTSVoice('en-US');

            (speechSynthesis as any).onvoiceschanged();
            getVoicesMock.mockReturnValue([{ lang: 'en-US', localService: true }]);
            (speechSynthesis as any).onvoiceschanged();

            await expect(promise).resolves.toBe(true);
        });

        it('should resolve true as a fallback if getVoices times out', async () => {
            (window.speechSynthesis.getVoices as any).mockReturnValue([]);
            const promise = audioService.checkTTSVoice('en-US');
            vi.runAllTimers();
            await expect(promise).resolves.toBe(true);
        });
    });

    describe('initializeMicrophoneStream', () => {
        it('should not initialize if recording is disabled', async () => {
            app.isRecordingEnabled = false;
            await audioService.initializeMicrophoneStream();
            expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
        });

        it('should not initialize if stream already exists', async () => {
            app.isRecordingEnabled = true;
            (audioService as any).stream = true;
            await audioService.initializeMicrophoneStream();
            expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
        });

        it('should handle browsers that do not support audio recording', async () => {
            app.isRecordingEnabled = true;
            (navigator as any).mediaDevices = null;
            await audioService.initializeMicrophoneStream();
            expect($('#feedback-text').html()).toContain('does not support audio recording');
        });

        it('should handle microphone permission denial', async () => {
            app.isRecordingEnabled = true;
            (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new Error('Permission denied'));
            await audioService.initializeMicrophoneStream();
            expect($('#feedback-text').html()).toContain('Could not access microphone');
            expect(app.isRecordingEnabled).toBe(false);
        });

    });

    describe('terminateMicrophoneStream', () => {
        it('should do nothing if stream is null initially', () => {
            (audioService as any).stream = null;
            const mockTrack = { stop: vi.fn() };
            const stream = { getTracks: () => [mockTrack] };

            audioService.terminateMicrophoneStream();
            expect(mockTrack.stop).not.toHaveBeenCalled();
        });
    });

    describe('stopRecording', () => {
        it('should resolve immediately if recorder is not in "recording" state', async () => {
            const mediaRecorderInstance = { state: 'inactive', addEventListener: vi.fn() };
            (audioService as any).mediaRecorder = mediaRecorderInstance;

            const promise = audioService.stopRecording();
            await expect(promise).resolves.toBeUndefined();
            expect(mediaRecorderInstance.addEventListener).not.toHaveBeenCalled();
        });
    });

    describe('speak', () => {
        it('should set volume if provided', () => {
            const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
            audioService.speak('test', null, null, null, 0.5);
            const utterance = speakSpy.mock.calls[0][0];
            expect(utterance.volume).toBe(0.5);
        });
    });

    describe('speakAndHighlight', () => {

        it('should not run onEnd callback logic if area is not Practice', () => {
            app.area = 'Home';
            const onEndCallback = vi.fn();

            audioService.speakAndHighlight('test', onEndCallback);

            const speakMock = window.speechSynthesis.speak as vi.Mock;
            const utterance = speakMock.mock.calls[0][0];
            utterance.onend();

            expect(onEndCallback).not.toHaveBeenCalled();
        });
    });

    describe('playUserAudio', () => {
        it('should do nothing if record is not found', () => {
            window.modalRecordings = {};
            const consoleSpy = vi.spyOn(console, 'error');
            const btn = document.createElement('button');
            btn.dataset.sentence = 'nonexistent';
            btn.dataset.index = '0';

            audioService.playUserAudio(btn);

            expect(consoleSpy).not.toHaveBeenCalled();
            expect((global.Audio as any)).not.toHaveBeenCalled();
        });
    });
});