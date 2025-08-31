import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import $ from 'jquery';
// Import the main application class
import { EchoTalkApp } from '../../assets/js/app';

// Load HTML content to inject into jsdom
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('EchoTalkApp', () => {
    let app: EchoTalkApp;

    // This function runs before each test
    beforeEach(() => {
        // 1. Clear previous mocks first
        vi.clearAllMocks();

        // 2. Inject HTML structure into jsdom
        document.body.innerHTML = html;

        // 3. Ensure mock is applied before app.init()
        $.getJSON = vi.fn(() => Promise.resolve({
            sentences: ["This is a test sentence.", "Another sample for practice."]
        })) as any;

        // 4. Create a new instance of the application class
        app = new EchoTalkApp();
    });

    afterEach(() => {
        // Clear localStorage after each test
        localStorage.clear();
    });

    // Test group for pure utility functions
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

    // Test group for initialization logic
    describe('Initialization', () => {
        it('should initialize correctly and fetch sample sentences', async () => {
            await app.init();
            // Check if a sample sentence is loaded into the textarea
            const sentenceValue = $('#sentenceInput').val();
            expect(['This is a test sentence.', 'Another sample for practice.']).toContain(sentenceValue);
            // Check if repetition options are generated
            expect($('#repsSelect option').length).toBeGreaterThan(0);
        });

        it('should load state from localStorage if available', async () => {
            // Store mock values in localStorage
            localStorage.setItem('shadow_sentence', 'Stored sentence from test.');
            localStorage.setItem('shadow_reps', '10');

            await app.init();

            // Check if values are loaded from localStorage
            expect($('#sentenceInput').val()).toBe('Stored sentence from test.');
            expect($('#repsSelect').val()).toBe('10');
        });
    });

    // Test group for core practice logic
    describe('Practice Logic', () => {
        it('should switch to practice view when "Start Practice" is clicked', async () => {
            await app.init();
            $('#startBtn').trigger('click');

            // Check if config area is hidden and practice area is shown
            expect($('#configArea').hasClass('d-none')).toBe(true);
            expect($('#practiceArea').hasClass('d-none')).toBe(false);
            // Check if speak function is called to read the first sentence
            expect(speechSynthesis.speak).toHaveBeenCalledOnce();
        });
    });
});