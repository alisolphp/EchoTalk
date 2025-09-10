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

    // Describes a suite of tests for the terminateMicrophoneStream method.
    describe('terminateMicrophoneStream', () => {
        // This test ensures that when a media stream is active, the method
        // correctly stops all associated tracks and closes the AudioContext.
        it('should stop tracks and close audio context if a stream exists', () => {
            // Mock an active audio track and stream
            const mockTrack = { stop: vi.fn() };
            const mockStream = { getTracks: () => [mockTrack] };
            (audioService as any).stream = mockStream;

            // Mock an open AudioContext
            const mockAudioContext = { close: vi.fn(), state: 'running' };
            (audioService as any).audioContext = mockAudioContext;

            audioService.terminateMicrophoneStream();

            // Verify that the track's stop method was called
            expect(mockTrack.stop).toHaveBeenCalled();
            // Verify that the AudioContext was closed
            expect(mockAudioContext.close).toHaveBeenCalled();
            // Verify that the stream property is reset to null
            expect((audioService as any).stream).toBeNull();
        });
    });


    // Describes a suite of tests for the startRecording method.
    describe('startRecording', () => {
        // This test verifies that the recording starts successfully when the
        // MediaRecorder is in an 'inactive' state.
        it('should start recording if mediaRecorder is inactive', () => {
            // Mock MediaRecorder instance with an inactive state
            const mediaRecorderInstance = { state: 'inactive', start: vi.fn() };
            (audioService as any).mediaRecorder = mediaRecorderInstance;

            audioService.startRecording();

            // Check that the start method was called and UI feedback is shown
            expect(mediaRecorderInstance.start).toHaveBeenCalled();
            expect($('#feedback-text').hasClass('recording-text-indicator')).toBe(true);
            expect($('#feedback-text').html()).toBe('Speak aloud...');
        });

        // This test ensures that recording does not start if the MediaRecorder
        // is already in a 'recording' state.
        it('should not start recording if mediaRecorder is already recording', () => {
            // Mock MediaRecorder instance with a recording state
            const mediaRecorderInstance = { state: 'recording', start: vi.fn() };
            (audioService as any).mediaRecorder = mediaRecorderInstance;

            audioService.startRecording();

            // Verify that the start method was not called again
            expect(mediaRecorderInstance.start).not.toHaveBeenCalled();
        });
    });


    // Describes a test for the stopRecording method's happy path.
    describe('stopRecording', () => {
        // This test confirms that when recording is active, the stop method is called
        // and the UI is reset correctly.
        it('should stop the recorder and resolve the promise when in "recording" state', async () => {
            // Mock an active MediaRecorder
            const mediaRecorderInstance = {
                state: 'recording',
                stop: vi.fn(),
                // Mock addEventListener to immediately trigger the 'stop' event for the test
                addEventListener: vi.fn((event, cb) => {
                    if (event === 'stop') {
                        cb();
                    }
                })
            };
            (audioService as any).mediaRecorder = mediaRecorderInstance;

            // Activate the visualizer to test its deactivation
            $('#soundWaveVisualizer').addClass('active');

            await audioService.stopRecording();

            // Verify that the stop method was called
            expect(mediaRecorderInstance.stop).toHaveBeenCalled();
            // Verify that the visualizer is no longer active
            expect($('#soundWaveVisualizer').hasClass('active')).toBe(false);
            // Verify that the recording indicator class is removed from the feedback text
            expect($('#feedback-text').hasClass('recording-text-indicator')).toBe(false);
        });
    });


    // Describes a suite of tests for the playSound method.
    describe('playSound', () => {
        // This test verifies that an audio file is played with custom speed and volume.
        it('should create an Audio object and play it with specified options', () => {
            const src = './sounds/test.mp3';
            const speed = 1.5;
            const volume = 0.7;

            audioService.playSound(src, speed, volume);

            // Get the mock instance of the Audio object
            const audioInstance = (global.Audio as any).mock.results[0].value;

            // Verify that a new Audio object was created with the correct source
            expect(global.Audio).toHaveBeenCalledWith(src);
            // Verify that playback speed and volume were set correctly
            expect(audioInstance.playbackRate).toBe(speed);
            expect(audioInstance.volume).toBe(volume);
            // Verify that the play method was called
            expect(audioInstance.play).toHaveBeenCalled();
        });
    });


    // Describes a suite of tests for the speak method.
    describe('speak', () => {
        // This test ensures that the speak method correctly configures the
        // utterance with the specified language and rate before speaking.
        it('should create an utterance with the correct language and rate', () => {
            const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
            const text = 'Testing speech synthesis';
            const rate = 1.2;
            const lang = 'fr-FR';

            audioService.speak(text, null, rate, lang);

            // Verify that speechSynthesis.speak was called
            expect(speakSpy).toHaveBeenCalled();
            const utterance = speakSpy.mock.calls[0][0];

            // Verify the properties of the utterance object
            expect(utterance.text).toBe(text);
            expect(utterance.rate).toBe(rate);
            expect(utterance.lang).toBe(lang);
        });
    });


    // Describes a suite of tests for the speakAndHighlight method.
    describe('speakAndHighlight', () => {
        // This test checks if the method correctly populates the sentence container
        // with individual word spans. It does not test the highlighting animation itself.
        it('should populate the sentence container with word spans', () => {
            const sentence = 'This is a test';
            audioService.speakAndHighlight(sentence);

            const container = $('#sentence-container');
            // Check if the container has the correct number of child elements (words + spaces)
            expect(container.children().length).toBe(4);
            // Check if the children are spans with the 'word' class
            expect(container.find('span.word').length).toBe(4);
            // Verify the text content of the generated spans
            expect(container.find('span').eq(0).text()).toBe('This');
            expect(container.find('span').eq(2).text()).toBe('a');
        });
    });

    // Describes tests for the terminateMicrophoneStream method under different conditions.
    describe('terminateMicrophoneStream scenarios', () => {
        // This test ensures the method doesn't throw an error when no stream is active.
        it('should handle cases where the stream or audioContext is not set', () => {
            // Ensure stream and audioContext are null
            (audioService as any).stream = null;
            (audioService as any).audioContext = null;

            // Expect the method to run without errors
            expect(() => audioService.terminateMicrophoneStream()).not.toThrow();
        });

        // This test verifies that the method handles an already closed AudioContext gracefully.
        it('should not attempt to close an audio context if it is already closed', () => {
            // Mock a stream with a track
            const mockTrack = { stop: vi.fn() };
            const mockStream = { getTracks: () => [mockTrack] };
            (audioService as any).stream = mockStream;

            // Mock an already closed AudioContext
            const mockAudioContext = { close: vi.fn(), state: 'closed' };
            (audioService as any).audioContext = mockAudioContext;

            audioService.terminateMicrophoneStream();

            // Verify that the close method is not called again
            expect(mockAudioContext.close).not.toHaveBeenCalled();
        });
    });

    // Describes tests for the stopRecording method's alternative paths.
    describe('stopRecording scenarios', () => {
        // This test ensures that the method resolves immediately if the recorder is not active.
        it('should resolve immediately if the recorder is not in "recording" state', async () => {
            // Mock an inactive MediaRecorder
            const mediaRecorderInstance = { state: 'inactive', stop: vi.fn() };
            (audioService as any).mediaRecorder = mediaRecorderInstance;

            // The promise should resolve without calling stop
            await expect(audioService.stopRecording()).resolves.toBeUndefined();
            expect(mediaRecorderInstance.stop).not.toHaveBeenCalled();
        });
    });

// Describes a suite of tests for the terminateMicrophoneStream method.
    describe('terminateMicrophoneStream', () => {
        // This test ensures that if the visualizer is active, its animation frame is cancelled
        // upon terminating the microphone stream to prevent unnecessary rendering loops.
        it('should cancel the visualizer animation frame if it is active', () => {
            // Mock a cancellable animation frame
            const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame');
            (audioService as any).visualizerFrameId = 123; // Set a mock frame ID

            // Mock a stream to ensure the method proceeds
            const mockTrack = { stop: vi.fn() };
            const mockStream = { getTracks: () => [mockTrack] };
            (audioService as any).stream = mockStream;

            audioService.terminateMicrophoneStream();

            // Verify that cancelAnimationFrame was called with the correct ID
            expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(123);
            expect((audioService as any).visualizerFrameId).toBeNull();
        });
    });

// Describes a suite of tests for the startRecording method.
    describe('startRecording', () => {
        // This test ensures that recording does not start if the MediaRecorder
        // is already in a 'recording' state, preventing redundant calls.
        it('should not start recording if mediaRecorder is already recording', () => {
            // Mock MediaRecorder instance with a recording state
            const mediaRecorderInstance = { state: 'recording', start: vi.fn() };
            (audioService as any).mediaRecorder = mediaRecorderInstance;

            audioService.startRecording();

            // Verify that the start method was not called again
            expect(mediaRecorderInstance.start).not.toHaveBeenCalled();
        });
    });


// Describes a test for the stopRecording method's happy path.
    describe('stopRecording', () => {
        // This test ensures that the method handles the case where the mediaRecorder
        // is not initialized, resolving without causing an error.
        it('should resolve immediately if mediaRecorder is undefined', async () => {
            (audioService as any).mediaRecorder = undefined;

            // The promise should resolve without any errors being thrown
            await expect(audioService.stopRecording()).resolves.toBeUndefined();
        });
    });

// Describes a suite of tests for the speak method.
    describe('speak', () => {
        // This test checks if the default language and speech rate from the app state
        // are applied to the utterance when no overrides are provided.
        it('should use default app language and rate when no overrides are given', () => {
            const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
            app.lang = 'de-DE';
            app.speechRate = 1.5;

            audioService.speak('Hallo Welt');

            const utterance = speakSpy.mock.calls[0][0];
            expect(utterance.lang).toBe('de-DE');
            expect(utterance.rate).toBe(1.5);
        });

        // This test verifies that an onEnd callback function is correctly
        // attached to the utterance's onend property.
        it('should attach an onEnd callback if one is provided', () => {
            const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
            const onEndCallback = vi.fn();

            audioService.speak('test', onEndCallback);

            const utterance = speakSpy.mock.calls[0][0];
            expect(utterance.onend).toBe(onEndCallback);
        });
    });

    // Describes a suite of tests for the speakAndHighlight method.
    describe('speakAndHighlight', () => {
        // This test verifies that for non-mobile environments, the `onboundary` event
        // handler is set on the SpeechSynthesisUtterance object to enable word-by-word highlighting.
        it('should set up onboundary event for word highlighting on desktop', () => {
            (app as any).isMobile = false; // Simulate desktop environment
            const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');

            audioService.speakAndHighlight('Highlight this text');

            const utterance = speakSpy.mock.calls[0][0];
            // The onboundary property should be a function
            expect(utterance.onboundary).toBeInstanceOf(Function);
        });

    });

    // Describes a suite of tests for the playUserAudio method.
    describe('playUserAudio', () => {
        // This test handles a specific edge case where a recording entry exists,
        // but the actual audio blob is missing. It ensures no attempt is made to play audio.
        it('should do nothing if the record exists but its audio blob is null', () => {
            const sentence = 'test sentence';
            // Mock a record without the `audio` property
            (window as any).modalRecordings = {
                [sentence]: [{ sentence, audio: null, timestamp: new Date(), lang: 'en-US' }]
            };

            const btn = document.createElement('button');
            btn.dataset.sentence = sentence;
            btn.dataset.index = '0';

            const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');
            const audioSpy = vi.spyOn(global, 'Audio');

            audioService.playUserAudio(btn);

            // Verify that no object URL was created and no Audio object was instantiated
            expect(createObjectUrlSpy).not.toHaveBeenCalled();
            expect(audioSpy).not.toHaveBeenCalled();
        });
    });

    describe('AudioService - Additional Tests', () => {

        describe('startRecording', () => {
            // This test ensures UI feedback is updated even if MediaRecorder is not ready
            it('should not throw error if mediaRecorder is undefined', async () => {
                (audioService as any).mediaRecorder = undefined;
                await expect(audioService.startRecording()).resolves.toBeUndefined();
                expect($('#feedback-text').text()).not.toContain('Speak aloud...');
            });
        });

        describe('speakAndHighlight', () => {
            // This test checks that word spans are created and highlighted on mobile simulation
            it('should highlight words on mobile using timers', () => {
                (app as any).isMobile = true; // simulate mobile
                const sentence = 'one two three';
                audioService.speakAndHighlight(sentence);

                vi.advanceTimersByTime(2000); // fast forward timers

                const highlighted = $('#sentence-container').find('.highlighted');
                expect(highlighted.length).toBeGreaterThan(0);
            });

        });

        describe('playBotAudio', () => {
            // This test verifies that bot audio playback uses speak with correct params
            it('should call speak with sentence and language', () => {
                const speakSpy = vi.spyOn(audioService, 'speak');
                const btn = document.createElement('button');
                btn.dataset.sentence = 'Bonjour';
                btn.dataset.lang = 'fr-FR';

                audioService.playBotAudio(btn);

                expect(speakSpy).toHaveBeenCalledWith('Bonjour', null, 1, 'fr-FR');
            });
        });

        describe('stopAllPlayback', () => {
            // This test ensures TTS is cancelled unless keepTTS flag is true
            it('should cancel TTS when keepTTS is false', () => {
                const cancelSpy = vi.spyOn(window.speechSynthesis, 'cancel');
                audioService.stopAllPlayback();
                expect(cancelSpy).toHaveBeenCalled();
            });

            it('should not cancel TTS when keepTTS is true', () => {
                const cancelSpy = vi.spyOn(window.speechSynthesis, 'cancel');
                audioService.stopAllPlayback(true);
                expect(cancelSpy).not.toHaveBeenCalled();
            });

            // This test ensures that any currently playing audio element is stopped and revoked
            it('should stop and revoke currently playing audio element', () => {
                const mockAudio = {
                    pause: vi.fn(),
                    src: 'blob:test',
                } as any;
                app.currentlyPlayingAudioElement = mockAudio;

                const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
                audioService.stopAllPlayback();

                expect(mockAudio.pause).toHaveBeenCalled();
                expect(revokeSpy).toHaveBeenCalledWith('blob:test');
                expect(app.currentlyPlayingAudioElement).toBeNull();
            });
        });
    });

});
