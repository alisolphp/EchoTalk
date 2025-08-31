import { EchoTalkApp } from '../../assets/js/app';
import { vi, Mock } from 'vitest';
import $ from 'jquery';

describe('Recordings Modal Logic', () => {
    let app: EchoTalkApp;
    let mockGetAll: Mock; // A reference to the mock function

    beforeEach(async () => {
        app = new EchoTalkApp();

        // Create a mock for the 'getAll' method that we can reference later
        mockGetAll = vi.fn().mockReturnValue({
            onsuccess: null,
            result: [] // Default to an empty result
        });

        // Create the complete mock DB object that our tests in this file will use
        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: mockGetAll, // Ensure our mock function is here
                    add: vi.fn() // Add other methods if needed by other parts
                })
            }))
        };

        // *** THE KEY FIX IS HERE ***
        // Before app.init() is called, we spy on initDB and force it to return our mock DB.
        // This prevents app.init() from overwriting our mock with the one from setup.ts.
        vi.spyOn(app as any, 'initDB').mockResolvedValue(mockDbObject);

        // Now, safely initialize the app. It will use our controlled mock DB.
        await app.init();
    });

    // Verifies the sentence truncation logic for long sentences.
    it('should truncate long sentences correctly', () => {
        const longSentence = 'This is a very long sentence for testing the truncation feature.';
        const expected = 'This is ... truncation feature.';
        const result = (app as any).truncateSentence(longSentence);
        expect(result).toBe(expected);
    });

    // Verifies that short sentences are not truncated.
    it('should not truncate short sentences', () => {
        const shortSentence = 'This is short.';
        const result = (app as any).truncateSentence(shortSentence);
        expect(result).toBe(shortSentence);
    });

    // Tests the playUserAudio method to ensure it correctly creates and plays
    // an audio element from a Blob stored in window.modalRecordings.
    it('should play user audio when playUserAudio is called', () => {
        // Mock the global recordings object
        const mockBlob = new Blob(['audio data'], { type: 'audio/ogg' });
        const sentence = 'test sentence';
        window.modalRecordings = {
            [sentence]: [{ sentence, audio: mockBlob, timestamp: new Date() }]
        };

        // Create a mock button element with the necessary data attributes
        const btn = $('<button>').attr('data-sentence', sentence).attr('data-index', 0)[0];

        // Call the method
        (app as any).playUserAudio(btn);

        // The Audio constructor is mocked in setup.ts to have a 'play' spy
        const audioInstance = (global.Audio as any).mock.results[0].value;
        expect(audioInstance.play).toHaveBeenCalled();
    });

    // Tests the stopAllPlayback method. It should pause any currently playing
    // user audio and also cancel any ongoing text-to-speech synthesis.
    it('should stop all audio playback', () => {
        // Simulate an audio element is currently playing
        const mockAudioElement = {
            pause: vi.fn(),
            src: 'blob:http://localhost/mock-url'
        };
        (app as any).currentlyPlayingAudioElement = mockAudioElement;

        // Call the method to stop playback
        (app as any).stopAllPlayback();

        // Verify that the audio was paused
        expect(mockAudioElement.pause).toHaveBeenCalled();
        expect((app as any).currentlyPlayingAudioElement).toBeNull();

        // Verify that speech synthesis was cancelled
        expect((window.speechSynthesis as any).cancel).toHaveBeenCalled();
    });

    // Tests the behavior of displayRecordings when no recordings exist.
    // It should display a user-friendly message in the modal.
    it('should show a "no recordings" message if the database is empty', async () => {
        // We change the mock's *implementation* to properly simulate the async callback.
        mockGetAll.mockImplementation(() => {
            const request: any = {
                // This is the result the DB should provide for this specific test
                result: []
            };

            // Use setTimeout to simulate the async nature of an IndexedDB request.
            // This ensures that the .onsuccess handler is called *after* the main code
            // has assigned it to the request object.
            setTimeout(() => {
                if (request.onsuccess) {
                    // Fire the onsuccess event, which resolves the Promise in the app code
                    request.onsuccess({ target: request });
                }
            }, 0);

            // The getAll() call returns the request object immediately
            return request;
        });

        // Manually trigger the displayRecordings method
        await (app as any).displayRecordings();

        // Check if the recordings list container now shows the correct message
        const listHtml = $('#recordingsList').html();
        expect(listHtml).toContain('No recordings found yet.');
    });

    // Tests that displayRecordings correctly renders a list of recordings
    // when the database is not empty.
    it('should display a list of recordings if the database has entries', async () => {
        const mockRecordings = [
            { sentence: 'Test sentence one', audio: new Blob(), timestamp: new Date() },
            { sentence: 'Test sentence two', audio: new Blob(), timestamp: new Date(Date.now() - 10000) }
        ];

        // Configure the mock DB to return our test data
        mockGetAll.mockImplementation(() => {
            const request: any = { result: mockRecordings };
            setTimeout(() => {
                if (request.onsuccess) {
                    request.onsuccess({ target: request });
                }
            }, 0);
            return request;
        });

        // Trigger the method to display recordings
        await (app as any).displayRecordings();

        const listContainer = $('#recordingsList');
        // Check that accordion items were created for the recordings
        expect(listContainer.find('.accordion-item').length).toBe(2);
        // Check if the sentence text is present in the output
        expect(listContainer.html()).toContain('Test sentence one');
    });

    // Verifies that stopAllPlayback does not cancel speech synthesis when the keepTTS flag is true.
    it('should not cancel TTS when stopAllPlayback is called with keepTTS true', () => {
        // Call the method to stop playback but keep TTS
        (app as any).stopAllPlayback(true);

        // Verify that speech synthesis was NOT cancelled
        expect((window.speechSynthesis as any).cancel).not.toHaveBeenCalled();
    });

    // Tests that playUserAudio handles errors gracefully if the audio fails to play.
    it('should handle errors when playing user audio fails', async () => {
        // Create a mock play function that will be used by the Audio mock.
        // This function immediately returns a rejected promise.
        const mockPlay = vi.fn().mockRejectedValue(new Error('Playback failed'));

        // Mock the global Audio constructor for this specific test
        // to return an object that uses our failing play method.
        (global.Audio as any).mockImplementation(() => ({
            play: mockPlay,
            pause: vi.fn(),
            onended: null,
            src: ''
        }));

        // Mock the global recordings object with some test data
        window.modalRecordings = {
            'test': [{ sentence: 'test', audio: new Blob(), timestamp: new Date() }]
        };

        const btn = $('<button>').attr('data-sentence', 'test').attr('data-index', 0)[0];

        // Spy on console.error to check if the error is logged
        const consoleSpy = vi.spyOn(console, 'error');

        // Call the method that we are testing
        (app as any).playUserAudio(btn);

        // Await a macrotask to allow the promise rejection inside playUserAudio to be processed
        await new Promise(resolve => setTimeout(resolve, 0));

        // Expect our mock play method to have been called
        expect(mockPlay).toHaveBeenCalled();
        // Expect that the error was caught and logged to the console
        expect(consoleSpy).toHaveBeenCalledWith('Error playing audio:', expect.any(Error));
    });
});