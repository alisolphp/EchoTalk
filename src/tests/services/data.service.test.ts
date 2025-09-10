import { EchoTalkApp } from '../../app';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import $ from 'jquery';
import { Practice } from '../../types';

describe('DataService', () => {
    let app: EchoTalkApp;
    let dataService: EchoTalkApp['dataService'];
    let mockDb: any;
    let mockPracticesStore: any;
    let mockRecordingsStore: any;

    // This function helps create a Date object for a specific number of days ago.
    const daysAgo = (days: number): Date => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    };

    beforeEach(async () => {
        // Mock the stores for our in-memory IndexedDB
        mockPracticesStore = {
            add: vi.fn(),
            getAll: vi.fn(),
        };
        mockRecordingsStore = {
            add: vi.fn(),
        };

        // Mock the IndexedDB transaction system
        mockDb = {
            transaction: vi.fn((storeNames: string[]) => {
                let store;
                if (storeNames.includes('practices')) {
                    store = mockPracticesStore;
                } else if (storeNames.includes('recordings')) {
                    store = mockRecordingsStore;
                }
                return {
                    objectStore: () => store,
                };
            }),
        };

        app = new EchoTalkApp();
        // Replace the real initDB with our mock
        vi.spyOn(app.dataService, 'initDB').mockResolvedValue(mockDb);
        dataService = app.dataService;
        (dataService as any).app.db = mockDb; // Manually assign the mock db
    });

    /**
     * @description Tests the database initialization failure path.
     * It verifies that if indexedDB.open() fails, the promise is rejected.
     */
    it('should reject promise if database initialization fails', async () => {
        // This test requires re-mocking initDB to simulate a failure.
        const error = new Error("DB Error");
        const mockOpen = {
            onerror: (e: any) => {}, // This will be set by the initDB implementation
        };
        vi.spyOn(window.indexedDB, 'open').mockImplementation(() => {
            // Simulate the error event firing
            setTimeout(() => mockOpen.onerror({ target: { error } }), 0);
            return mockOpen as any;
        });

        // We expect the promise to be rejected with the specific error message.
        await expect(new EchoTalkApp().dataService.initDB()).rejects.toBe("Database error");
    });

    /**
     * @description Tests saving a recording.
     * It ensures that when saveRecording is called, it correctly starts a transaction
     * and calls the 'add' method on the 'recordings' object store with the correct data.
     */
    it('should save a recording to the database correctly', async () => {
        const testBlob = new Blob(['audio data'], { type: 'audio/ogg' });
        app.currentPhrase = 'test phrase';
        app.lang = 'en-US';

        await dataService.saveRecording(testBlob);

        // Verify that a read-write transaction was opened on the 'recordings' store.
        expect(mockDb.transaction).toHaveBeenCalledWith(['recordings'], 'readwrite');
        // Verify that the 'add' method was called on the store.
        expect(mockRecordingsStore.add).toHaveBeenCalled();
        // Check if the first argument passed to 'add' contains the correct sentence.
        const savedRecord = mockRecordingsStore.add.mock.calls[0][0];
        expect(savedRecord.sentence).toBe('test phrase');
        expect(savedRecord.audio).toBe(testBlob);
    });

    /**
     * @description Tests the displayPractices method when no practices are available.
     * It checks if the correct "no practices recorded yet" message is displayed.
     */
    it('should display a "no practices" message when the database is empty', async () => {
        // Mock the getAll request to return an empty array.
        const request = { result: [] as Practice[], onsuccess: () => {} };
        mockPracticesStore.getAll.mockReturnValue(request);

        // Trigger the method
        const displayPromise = dataService.displayPractices();
        // Manually trigger the onsuccess callback for the mock request
        request.onsuccess();
        await displayPromise;

        // Check if the UI is updated with the placeholder text.
        expect($('#practicesList').html()).toContain('No practices recorded yet');
    });

    /**
     * @description Tests the display of practices when there are multiple languages.
     * It ensures that the practices are grouped by language and displayed inside an accordion UI.
     */
    it('should group practices by language into an accordion if more than one language exists', async () => {
        const practices: Practice[] = [
            { sentence: 'English sentence', lang: 'en-US', count: 1, practiceHistory: [new Date()] },
            { sentence: 'Dutch sentence', lang: 'nl-NL', count: 1, practiceHistory: [new Date()] }
        ];
        const request = { result: practices, onsuccess: () => {} };
        mockPracticesStore.getAll.mockReturnValue(request);

        const displayPromise = dataService.displayPractices();
        request.onsuccess();
        await displayPromise;

        const practicesList = $('#practicesList');
        // The main container should be an accordion.
        expect(practicesList.find('.accordion').length).toBe(1);
        // There should be two accordion items, one for each language.
        expect(practicesList.find('.accordion-item').length).toBe(2);
        // Check if language names are present.
        expect(practicesList.html()).toContain('English (US) Sentences');
        expect(practicesList.html()).toContain('Dutch (NL) Sentences');
    });

    describe('Streak Calculation (_calculateStreak)', () => {
        /**
         * @description Tests streak calculation with no practice data.
         * The expected result is a streak of 0.
         */
        it('should return 0 for no practices', async () => {
            const streak = await (dataService as any)._calculateStreak([]);
            expect(streak).toBe(0);
        });

        /**
         * @description Tests a simple case where the only practice was today.
         * The expected streak is 1.
         */
        it('should return 1 if the only practice was today', async () => {
            const practices: Practice[] = [{ sentence: 'a', lang: 'en-US', count: 1, practiceHistory: [daysAgo(0)] }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(1);
        });

        /**
         * @description Tests if a practice from yesterday still counts as a 1-day streak.
         */
        it('should return 1 if the only practice was yesterday', async () => {
            const practices: Practice[] = [{ sentence: 'a', lang: 'en-US', count: 1, practiceHistory: [daysAgo(1)] }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(1);
        });

        /**
         * @description Tests a continuous 3-day streak.
         */
        it('should return 3 for practices today, yesterday, and the day before', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 3,
                practiceHistory: [daysAgo(0), daysAgo(1), daysAgo(2)]
            }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(3);
        });

        /**
         * @description Tests a broken streak (a gap of one day).
         * The streak should only count the most recent continuous block, which is just today.
         */
        it('should return 1 if there is a gap in practice (today and 2 days ago)', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 2,
                practiceHistory: [daysAgo(0), daysAgo(2)]
            }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(1);
        });

        /**
         * @description Ensures that multiple practices on the same day don't inflate the streak count.
         */
        it('should correctly calculate streak with multiple practices on the same days', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 4,
                practiceHistory: [daysAgo(0), daysAgo(0), daysAgo(1), daysAgo(1)]
            }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(2);
        });

        /**
         * @description Tests a streak that doesn't include today but is still active from yesterday.
         */
        it('should return 2 for a streak ending yesterday', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 2,
                practiceHistory: [daysAgo(1), daysAgo(2)]
            }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(2);
        });

        /**
         * @description Tests that a streak is considered broken if the last practice was two days ago.
         */
        it('should return 0 for a streak ending two days ago', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 2,
                practiceHistory: [daysAgo(2), daysAgo(3)]
            }];
            const streak = await (dataService as any)._calculateStreak(practices);
            expect(streak).toBe(0);
        });
    });

    describe('Streak Modal Population', () => {
        /**
         * @description Tests the motivational message for a brand new user.
         * It should show a "Welcome!" message.
         */
        it('should show "Welcome!" message for a new user', async () => {
            const request = { result: [] as Practice[], onsuccess: () => {} };
            mockPracticesStore.getAll.mockReturnValue(request);

            const promise = dataService.populateStreakModal();
            request.onsuccess();
            await promise;

            expect($('#myStreakModalLabel').text()).toBe("Welcome!");
            expect($('#streak-motivational-text').text()).toBe("Ready to build your streak? Complete your first practice session today!");
        });

        /**
         * @description Tests the message for a user who has a broken streak but has practiced before.
         * It should show a "Welcome Back!" message.
         */
        it('should show "Welcome Back!" message for a user with a broken streak', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 1,
                practiceHistory: [daysAgo(5)]
            }];
            const request = { result: practices, onsuccess: () => {} };
            mockPracticesStore.getAll.mockReturnValue(request);

            const promise = dataService.populateStreakModal();
            request.onsuccess();
            await promise;

            expect($('#myStreakModalLabel').text()).toBe("Welcome Back!");
        });

        /**
         * @description Tests the message for a user with an active streak.
         * It should show a "Congratulations!" message.
         */
        it('should show "Congratulations!" message for a user with an active streak', async () => {
            const practices: Practice[] = [{
                sentence: 'a',
                lang: 'en-US',
                count: 1,
                practiceHistory: [daysAgo(1)]
            }];
            const request = { result: practices, onsuccess: () => {} };
            mockPracticesStore.getAll.mockReturnValue(request);

            const promise = dataService.populateStreakModal();
            request.onsuccess();
            await promise;

            expect($('#myStreakModalLabel').text()).toBe("Congratulations!");
        });
    });
});