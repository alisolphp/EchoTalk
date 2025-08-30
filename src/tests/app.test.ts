// Updated code for: Projects\EchoTalk\src\tests\app.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';
// ایمپورت کردن کلاس اصلی برنامه
import { EchoTalkApp } from '../assets/js/app';

// خواندن محتوای فایل HTML برای بارگذاری در jsdom
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

describe('EchoTalkApp', () => {
    let app: EchoTalkApp;

    // این تابع قبل از اجرای هر تست فراخوانی می‌شود
    beforeEach(() => {
        // 1. پاک کردن mock های قبلی باید اولین کار باشد
        vi.clearAllMocks();

        // 2. بارگذاری ساختار HTML در jsdom
        document.body.innerHTML = html;

        // 3. Mock کردن فراخوانی شبکه برای دریافت جملات نمونه
        const mockData = {
            sentences: ["This is a test sentence.", "Another sample for practice."]
        };
        $.getJSON = vi.fn(() => Promise.resolve(mockData)) as any;

        // 4. ساخت یک نمونه جدید از کلاس برنامه
        app = new EchoTalkApp();
    });

    afterEach(() => {
        // پاک کردن localStorage بعد از هر تست
        localStorage.clear();
    });

    // گروه تست برای توابع محاسباتی و خالص
    describe('Utility Functions', () => {
        it('calculateWordSimilarity should return 1 for identical strings', () => {
            const similarity = app.calculateWordSimilarity('hello world', 'hello world');
            expect(similarity).toBe(1);
        });

        it('calculateWordSimilarity should return 0.5 for half-matching strings', () => {
            const similarity = app.calculateWordSimilarity('one two three four', 'one two five six');
            expect(similarity).toBe(0.5);
        });

        it('calculateWordSimilarity should return 0 for completely different strings', () => {
            const similarity = app.calculateWordSimilarity('apple orange', 'banana kiwi');
            expect(similarity).toBe(0);
        });
    });

    // گروه تست برای فرآیند مقداردهی اولیه
    describe('Initialization', () => {
        it('should initialize correctly and fetch sample sentences', async () => {
            await app.init();
            // بررسی می‌کند که آیا یک جمله نمونه در textarea قرار گرفته است یا نه
            const sentenceValue = $('#sentenceInput').val();
            expect(['This is a test sentence.', 'Another sample for practice.']).toContain(sentenceValue);
            // بررسی می‌کند که آیا گزینه‌های تکرار (repetitions) ساخته شده‌اند
            expect($('#repsSelect option').length).toBeGreaterThan(0);
        });

        it('should load state from localStorage if available', async () => {
            // ذخیره مقادیر ساختگی در localStorage
            localStorage.setItem('shadow_sentence', 'Stored sentence from test.');
            localStorage.setItem('shadow_reps', '10');

            await app.init();

            // بررسی می‌کند که آیا مقادیر از localStorage خوانده شده‌اند
            expect($('#sentenceInput').val()).toBe('Stored sentence from test.');
            expect($('#repsSelect').val()).toBe('10');
        });
    });

    // گروه تست برای منطق اصلی تمرین
    describe('Practice Logic', () => {
        it('should switch to practice view when "Start Practice" is clicked', async () => {
            await app.init();
            $('#startBtn').trigger('click');

            // بررسی می‌کند که آیا بخش تنظیمات مخفی و بخش تمرین نمایش داده می‌شود
            expect($('#configArea').hasClass('d-none')).toBe(true);
            expect($('#practiceArea').hasClass('d-none')).toBe(false);
            // بررسی می‌کند که آیا تابع speak برای خواندن اولین عبارت فراخوانی شده است
            expect(speechSynthesis.speak).toHaveBeenCalledOnce();
        });

    });
});