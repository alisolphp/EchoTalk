/**
 * Setup file for Vitest.
 * This file mocks browser-specific APIs (like MediaRecorder, SpeechRecognition, etc.)
 * to allow unit testing in a Node environment without actual browser support.
 */


import { beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// 1. Load HTML content to inject before each test
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// 2. Global setup before each test
beforeEach(() => {
    // Inject HTML structure into jsdom
    document.body.innerHTML = html;

    // --- START: Mocking browser APIs ---

    // Mock for SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text = '') => {
        return {
            text,
            lang: '',
            rate: 1,
            onend: null,
        };
    });

    // Mock for speechSynthesis
    window.speechSynthesis = {
        speak: vi.fn(utterance => {
            // Directly trigger onend to avoid interference with fake timers
            if (utterance.onend) {
                utterance.onend();
            }
        }),
        cancel: vi.fn(),
    } as any;

    // Mock for Audio to prevent actual resource loading
    global.Audio = vi.fn().mockImplementation(() => ({
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        playbackRate: 1,
        src: '',
        load: vi.fn(),
    })) as any;

    // Mock for MediaRecorder
    window.MediaRecorder = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        state: 'inactive',
        ondataavailable: vi.fn(),
        onstop: vi.fn(),
    }));

    // Mock for navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
        value: {
            getUserMedia: vi.fn().mockResolvedValue({
                getTracks: () => [{ stop: vi.fn() }],
            }),
        },
        writable: true
    });

    // Full mock for indexedDB
    Object.defineProperty(window, 'indexedDB', {
        value: {
            open: vi.fn().mockImplementation(() => {
                const request: any = {};
                setTimeout(() => {
                    request.result = {
                        objectStoreNames: {
                            contains: vi.fn().mockReturnValue(false)
                        },
                        createObjectStore: vi.fn().mockReturnValue({
                            createIndex: vi.fn()
                        }),
                        transaction: () => ({
                            objectStore: () => ({
                                add: vi.fn(),
                            }),
                        }),
                    };
                    if (request.onsuccess) {
                        request.onsuccess({ target: request });
                    }
                }, 0);
                return request;
            })
        },
        writable: true
    });

    // --- END: Mocking browser APIs ---
});

// 3. Cleanup after each test
afterEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Restore real timers
    vi.useRealTimers();
});