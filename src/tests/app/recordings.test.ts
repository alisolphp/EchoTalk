import { EchoTalkApp } from '../../assets/js/app';
import { vi, Mock } from 'vitest';
import $ from 'jquery';

describe('Recordings Modal Logic', () => {
    let app: EchoTalkApp;
    let mockGetAll: Mock; // Reference to the mock function for IndexedDB's getAll.

    beforeEach(async () => {
        app = new EchoTalkApp();

        // Create a mock for the `getAll` method of IndexedDB's object store.
        mockGetAll = vi.fn().mockReturnValue({
            onsuccess: null,
            result: [] // Default to an empty result for `getAll`.
        });

        // Construct a complete mock IndexedDB object.
        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: mockGetAll, // Use our specific mock for `getAll`.
                    add: vi.fn() // Mock `add` if other parts of the app use it.
                })
            }))
        };

        // Spy on the `initDB` method and force it to return our mock DB object.
        // This ensures the app uses our controlled IndexedDB mock during initialization.
        vi.spyOn(app as any, 'initDB').mockResolvedValue(mockDbObject);

        // Initialize the app. It will now use our mocked IndexedDB.
        await app.init();
    });

    it('should truncate long sentences correctly', () => {
        const longSentence = 'This is a very long sentence for testing the truncation feature.';
        const expected = 'This is ... truncation feature.';
        const result = (app as any).truncateSentence(longSentence);
        expect(result).toBe(expected);
    });

    it('should not truncate short sentences', () => {
        const shortSentence = 'This is short.';
        const result = (app as any).truncateSentence(shortSentence);
        expect(result).toBe(shortSentence);
    });

    it('should play user audio when playUserAudio is called', () => {
        // Mock the global `window.modalRecordings` object with a test Blob.
        const mockBlob = new Blob(['audio data'], { type: 'audio/ogg' });
        const sentence = 'test sentence';
        window.modalRecordings = {
            [sentence]: [{ sentence, audio: mockBlob, timestamp: new Date() }]
        };

        // Create a mock button element with the necessary data attributes to identify the recording.
        const btn = $('<button>').attr('data-sentence', sentence).attr('data-index', 0)[0];

        (app as any).playUserAudio(btn); // Call the method to play user audio.

        // The `Audio` constructor is mocked in `setup.ts` to have a `play` spy.
        const audioInstance = (global.Audio as any).mock.results[0].value;
        expect(audioInstance.play).toHaveBeenCalled();
    });

    it('should stop all audio playback', () => {
        // Simulate an audio element currently playing.
        const mockAudioElement = {
            pause: vi.fn(),
            src: 'blob:http://localhost/mock-url'
        };
        (app as any).currentlyPlayingAudioElement = mockAudioElement;

        (app as any).stopAllPlayback(); // Call the method to stop all playback.

        // Verify that the audio was paused and the reference to it cleared.
        expect(mockAudioElement.pause).toHaveBeenCalled();
        expect((app as any).currentlyPlayingAudioElement).toBeNull();

        // Verify that ongoing speech synthesis was cancelled.
        expect((window.speechSynthesis as any).cancel).toHaveBeenCalled();
    });

    it('should show a "no recordings" message if the database is empty', async () => {
        // Configure `mockGetAll` to simulate an empty database result after an async delay.
        mockGetAll.mockImplementation(() => {
            const request: any = {
                result: []
            };
            setTimeout(() => {
                if (request.onsuccess) {
                    request.onsuccess({ target: request });
                }
            }, 0);
            return request;
        });

        await (app as any).displayRecordings(); // Manually trigger the method to display recordings.

        // Verify that the recordings list container displays the "No recordings found yet." message.
        const listHtml = $('#recordingsList').html();
        expect(listHtml).toContain('No recordings found yet.');
    });

    it('should display a list of recordings if the database has entries', async () => {
        const mockRecordings = [
            { sentence: 'Test sentence one', audio: new Blob(), timestamp: new Date() },
            { sentence: 'Test sentence two', audio: new Blob(), timestamp: new Date(Date.now() - 10000) }
        ];

        // Configure `mockGetAll` to return our test data after an async delay.
        mockGetAll.mockImplementation(() => {
            const request: any = { result: mockRecordings };
            setTimeout(() => {
                if (request.onsuccess) {
                    request.onsuccess({ target: request });
                }
            }, 0);
            return request;
        });

        await (app as any).displayRecordings(); // Trigger the method to display recordings.

        const listContainer = $('#recordingsList');
        // Verify that accordion items are created for each mock recording.
        expect(listContainer.find('.accordion-item').length).toBe(2);
        // Verify that the sentence text from the recordings is present in the output.
        expect(listContainer.html()).toContain('Test sentence one');
    });

    it('should not cancel TTS when stopAllPlayback is called with keepTTS true', () => {
        (app as any).stopAllPlayback(true); // Call stopAllPlayback with the `keepTTS` flag set to true.

        // Verify that `speechSynthesis.cancel` was NOT called.
        expect((window.speechSynthesis as any).cancel).not.toHaveBeenCalled();
    });

    it('should handle errors when playing user audio fails', async () => {
        // Create a mock `play` function that immediately rejects to simulate a playback error.
        const mockPlay = vi.fn().mockRejectedValue(new Error('Playback failed'));

        // Mock the global `Audio` constructor to return an object using our failing `play` method.
        (global.Audio as any).mockImplementation(() => ({
            play: mockPlay,
            pause: vi.fn(),
            onended: null,
            src: ''
        }));

        // Mock `window.modalRecordings` with some test data.
        window.modalRecordings = {
            'test': [{ sentence: 'test', audio: new Blob(), timestamp: new Date() }]
        };

        const btn = $('<button>').attr('data-sentence', 'test').attr('data-index', 0)[0];

        // Spy on `console.error` to confirm error logging.
        const consoleSpy = vi.spyOn(console, 'error');

        (app as any).playUserAudio(btn); // Call the method under test.

        // Await a macrotask to allow the promise rejection to be processed.
        await new Promise(resolve => setTimeout(resolve, 0));

        // Verify that our mock `play` method was called and the error was logged.
        expect(mockPlay).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Error playing audio:', expect.any(Error));
    });
});