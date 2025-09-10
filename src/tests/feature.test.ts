// in: Projects\EchoTalk\src\tests\feature.test.ts

import { EchoTalkApp } from '../app';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';
import $ from 'jquery';
import * as prompts from '../services/prompts.service';

describe('Feature & Integration Tests', () => {
    let app: EchoTalkApp;

    beforeEach(async () => {
        // All complex mocks are now in setup.ts, so we don't need them here.
        vi.spyOn($, 'getJSON').mockImplementation((url: string) => {
            if (url.includes('nl-NL')) return Promise.resolve({ "levels": [{ "categories": [{ "sentences": ["Dit is een Nederlandse zin."] }] }] });
            return Promise.resolve({ "levels": [{ "categories": [{ "sentences": ["This is an English sentence."] }] }] });
        });

        app = new EchoTalkApp();
        await app.init();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Feature: Multi-Language - should load new samples when language changes', async () => {
        $('#languageSelect').val('nl-NL').trigger('change');
        // Let promises resolve
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(app.sentence).toBe('Dit is een Nederlandse zin.');
    });

    it('Feature: AI Integration - should generate and copy the correct prompt', async () => {
        const copySpy = vi.spyOn(app.utilService, 'copyTextToClipboard').mockResolvedValue(true);
        app.currentPhrase = 'A sentence to translate';
        app.langGeneral = 'English (US)';
        await app.aiService.handleTranslateWithGpt(document.createElement('button'));
        expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('You are a professional'));
    });
});