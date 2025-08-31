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

beforeEach(() => {
    vi.useRealTimers(); // Required for setTimeout-based callbacks

    document.body.innerHTML = html; // Reset DOM to initial state

    // Stub $.getJSON to avoid real network requests
    ($.getJSON as any) = vi.fn(() =>
        Promise.resolve({
            sentences: ['dummy one', 'dummy two'],
        })
    );

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
});

afterEach(() => {
    localStorage.clear(); // Reset localStorage between tests
    vi.useRealTimers();
    vi.restoreAllMocks(); // Restore all mocked functions
});
