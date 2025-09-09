import { EchoTalkApp } from '../../app';
import { vi, Mock } from 'vitest';
import $ from 'jquery';

describe('Recordings Modal Logic', () => {
    let app: EchoTalkApp;
    let mockGetAll: Mock;

    beforeEach(async () => {
        vi.spyOn($, 'getJSON').mockResolvedValue({
            sentences: ['Recording test sentence'],
        });

        app = new EchoTalkApp();

        mockGetAll = vi.fn().mockReturnValue({
            onsuccess: null,
            result: []
        });

        const mockDbObject = {
            transaction: vi.fn(() => ({
                objectStore: () => ({
                    getAll: mockGetAll,
                    add: vi.fn()
                })
            }))
        };

        vi.spyOn(app.dataService, 'initDB').mockResolvedValue(mockDbObject as any);

        await app.init();
    });

    it('should truncate long sentences correctly', () => {
        const longSentence = 'This is a very long sentence for testing the truncation feature.';
        const expected = 'This is ... truncation feature.';
        const result = app.utilService.truncateSentence(longSentence);
        expect(result).toBe(expected);
    });

    it('should not truncate short sentences', () => {
        const shortSentence = 'This is short.';
        const result = app.utilService.truncateSentence(shortSentence);
        expect(result).toBe(shortSentence);
    });

    it('should play user audio when playUserAudio is called', () => {
        const mockBlob = new Blob(['audio data'], { type: 'audio/ogg' });
        const sentence = 'test sentence';
        window.modalRecordings = {
            [sentence]: [{ sentence, audio: mockBlob, timestamp: new Date(), lang: 'en-US' }]
        };

        const btn = $('<button>').attr('data-sentence', sentence).attr('data-index', 0)[0];
        app.audioService.playUserAudio(btn);

        const audioInstance = (global.Audio as any).mock.results[0].value;
        expect(audioInstance.play).toHaveBeenCalled();
    });

    it('should stop all audio playback', () => {
        const mockAudioElement = {
            pause: vi.fn(),
            src: 'blob:http://localhost/mock-url'
        };
        app.currentlyPlayingAudioElement = mockAudioElement as any;

        app.audioService.stopAllPlayback();

        expect(mockAudioElement.pause).toHaveBeenCalled();
        expect(app.currentlyPlayingAudioElement).toBeNull();
        expect((window.speechSynthesis as any).cancel).toHaveBeenCalled();
    });

    it('should show a "no recordings" message if the database is empty', async () => {
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

        await app.dataService.displayRecordings();

        const listHtml = $('#recordingsList').html();
        expect(listHtml).toContain('No recordings found yet.');
    });

    it('should display a list of recordings if the database has entries', async () => {
        const mockRecordings = [
            { sentence: 'Test sentence one', audio: new Blob(), timestamp: new Date(), lang: 'en-US' },
            { sentence: 'Test sentence two', audio: new Blob(), timestamp: new Date(Date.now() - 10000), lang: 'en-US' }
        ];

        mockGetAll.mockImplementation(() => {
            const request: any = { result: mockRecordings };
            setTimeout(() => {
                if (request.onsuccess) {
                    request.onsuccess({ target: request });
                }
            }, 0);
            return request;
        });

        await app.dataService.displayRecordings();

        const listContainer = $('#recordingsList');
        expect(listContainer.find('.accordion-item').length).toBe(2);
        expect(listContainer.html()).toContain('Test sentence one');
    });

    it('should not cancel TTS when stopAllPlayback is called with keepTTS true', () => {
        app.audioService.stopAllPlayback(true);
        expect((window.speechSynthesis as any).cancel).not.toHaveBeenCalled();
    });

    it('should handle errors when playing user audio fails', async () => {
        const mockPlay = vi.fn().mockRejectedValue(new Error('Playback failed'));
        (global.Audio as any).mockImplementation(() => ({
            play: mockPlay,
            pause: vi.fn(),
            onended: null,
            src: ''
        }));

        window.modalRecordings = {
            'test': [{ sentence: 'test', audio: new Blob(), timestamp: new Date(), lang: 'en-US' }]
        };

        const btn = $('<button>').attr('data-sentence', 'test').attr('data-index', 0)[0];
        const consoleSpy = vi.spyOn(console, 'error');

        app.audioService.playUserAudio(btn);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockPlay).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Error playing audio:', expect.any(Error));
    });
});