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
});