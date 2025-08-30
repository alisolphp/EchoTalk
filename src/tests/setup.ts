// Updated code for: Projects\EchoTalk\src\tests\setup.ts
import { beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// 1. خواندن HTML برای بارگذاری در هر تست
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// 2. تنظیمات سراسری قبل از هر تست
beforeEach(() => {
    // بارگذاری ساختار HTML در jsdom
    document.body.innerHTML = html;

    // --- START: Mock کردن API های مرورگر ---

    // Mock برای SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text = '') => {
        return {
            text,
            lang: '',
            rate: 1,
            onend: null,
        };
    });

    // Mock برای speechSynthesis
    window.speechSynthesis = {
        speak: vi.fn(utterance => {
            // فراخوانی مستقیم onend برای جلوگیری از تداخل با تایمرهای ساختگی تست
            if (utterance.onend) {
                utterance.onend();
            }
        }),
        cancel: vi.fn(),
    } as any;

    // Mock برای Audio به منظور جلوگیری از بارگذاری منابع
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
        writable: true
    });

    // Mock کامل برای indexedDB
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

    // --- END: Mock کردن API های مرورگر ---
});

// 3. پاکسازی بعد از هر تست
afterEach(() => {
    // پاک کردن localStorage
    localStorage.clear();
    // بازگرداندن تایمرهای واقعی
    vi.useRealTimers();
});