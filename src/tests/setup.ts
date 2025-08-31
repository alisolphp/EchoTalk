/**
 * Setup file for Vitest.
 * این فایل APIهای مرورگر رو Mock می‌کنه تا بتونیم در محیط Node تست بزنیم.
 */

import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';

// jQuery رو global کنیم
(globalThis as any).$ = $;
(globalThis as any).jQuery = $;

// HTML پروژه
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// 1. خاموش کردن console.error برای جلوگیری از لاگ‌های AggregateError
beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

// 2. Global setup قبل از هر تست
beforeEach(() => {
    document.body.innerHTML = html;

    // Mock کامل getJSON تا هیچوقت XHR واقعی اجرا نشه
    ($.getJSON as any) = vi.fn(() => Promise.resolve({
        sentences: ['dummy one', 'dummy two'],
    }));

    // --- Mock APIهای مرورگر ---

    // Mock برای SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text = '') => {
        return { text, lang: '', rate: 1, onend: null };
    });

    // Mock برای speechSynthesis
    window.speechSynthesis = {
        speak: vi.fn((utterance) => {
            if (utterance.onend) utterance.onend();
        }),
        cancel: vi.fn(),
    } as any;

    // Mock برای Audio
    global.Audio = vi.fn().mockImplementation(() => ({
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        playbackRate: 1,
        src: '',
        load: vi.fn(),
    })) as any;

    // Mock برای MediaRecorder
    window.MediaRecorder = vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        state: 'inactive',
        ondataavailable: vi.fn(),
        onstop: vi.fn(),
    }));

    // Mock برای navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
        value: {
            getUserMedia: vi.fn().mockResolvedValue({
                getTracks: () => [{ stop: vi.fn() }],
            }),
        },
        writable: true,
    });

    // Mock کامل indexedDB
    Object.defineProperty(window, 'indexedDB', {
        value: {
            open: vi.fn().mockImplementation(() => {
                const request: any = {};
                setTimeout(() => {
                    request.result = {
                        objectStoreNames: {
                            contains: vi.fn().mockReturnValue(false),
                        },
                        createObjectStore: vi.fn().mockReturnValue({
                            createIndex: vi.fn(),
                        }),
                        transaction: () => ({
                            objectStore: () => ({ add: vi.fn() }),
                        }),
                    };
                    if (request.onsuccess) {
                        request.onsuccess({ target: request });
                    }
                }, 0);
                return request;
            }),
        },
        writable: true,
    });
});

// 3. Cleanup بعد از هر تست
afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
});
