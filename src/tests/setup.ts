/**
 * Vitest setup file.
 * Mocks browser APIs to enable testing in Node environment.
 */

import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';

// Expose jQuery globally for modules that rely on global $
(globalThis as any).$ = $;
(globalThis as any).jQuery = $;

// Load static HTML content to reset DOM before each test
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

beforeAll(() => {
    // Silence console.error to reduce noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

// The function is now correctly marked as 'async'
beforeEach(async () => {
    vi.useRealTimers(); // Required for setTimeout-based callbacks

    document.body.innerHTML = html; // Reset DOM to initial state

    // =================================================================
    // START: Mocks for PWA and Browser-specific APIs
    // =================================================================

    // Mock window.matchMedia for PWA display-mode checks
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false, // Default behavior simulates running in a browser tab
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // Mock navigator.serviceWorker for PWA offline functionality
    if (!navigator.serviceWorker) {
        Object.defineProperty(navigator, 'serviceWorker', {
            writable: true,
            value: {
                register: vi.fn().mockImplementation(() => {
                    return Promise.resolve({ scope: 'mock-scope' });
                }),
            },
        });
    }

    // =================================================================
    // END: Mocks for PWA and Browser-specific APIs
    // =================================================================


    // Mock SpeechSynthesisUtterance for TTS functionality
    global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text = '') => ({
        text,
        lang: '',
        rate: 1,
        onend: null,
        onstart: null,
        onboundary: null,
    }));

    // Simulate speechSynthesis.speak with start/end events
    (window as any).speechSynthesis = {
        speak: vi.fn((utterance: any) => {
            if (typeof utterance.onstart === 'function') utterance.onstart();
            if (typeof utterance.onend === 'function') setTimeout(() => utterance.onend(), 0);
        }),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([
            { name: 'Mock Voice English', lang: 'en-US', localService: true, default: true },
            { name: 'Mock Voice Dutch', lang: 'nl-NL', localService: true, default: false }
        ]),
    };

    // Prevent actual audio playback during tests
    global.Audio = vi.fn().mockImplementation(() => ({
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        playbackRate: 1,
        src: '',
        load: vi.fn(),
        onended: null,
    })) as any;

    // Simulate microphone access via getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
        value: {
            getUserMedia: vi.fn().mockResolvedValue({
                getTracks: () => [{ stop: vi.fn() }],
            }),
        },
        writable: true,
    });

    // Mock MediaRecorder for audio recording tests
    (globalThis as any).MediaRecorder = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        state: 'inactive',
        ondataavailable: null,
        onstop: null,
        stream: { getTracks: () => [{ stop: vi.fn() }] },
        mimeType: 'audio/ogg',
    }));
    (globalThis as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(false);

    // Simulate basic indexedDB operations
    Object.defineProperty(window, 'indexedDB', {
        value: {
            open: vi.fn().mockImplementation(() => {
                const request: any = {};
                setTimeout(() => {
                    request.result = {
                        objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
                        createObjectStore: vi.fn().mockReturnValue({ createIndex: vi.fn() }),
                        transaction: () => ({
                            objectStore: () => ({ add: vi.fn() }),
                        }),
                    };
                    if (typeof request.onsuccess === 'function') {
                        request.onsuccess({ target: request });
                    }
                }, 0);
                return request;
            }),
        },
        writable: true,
    });

    // Prevent actual page reloads during tests
    try {
        (global as any).location = { ...(global as any).location, reload: vi.fn() };
    } catch {
        Object.defineProperty(window, 'location', {
            value: { ...(window as any).location, reload: vi.fn() },
            writable: true,
        });
    }

    // Mock URL class and its static methods. This requires an async beforeEach.
    const { URL } = await import('url');
    global.URL = URL as any;
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url');
    global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
    localStorage.clear(); // Reset localStorage between tests
    vi.useRealTimers();
});