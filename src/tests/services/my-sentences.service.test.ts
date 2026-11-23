import { describe, it, expect, vi, beforeEach } from 'vitest';
import $ from 'jquery';
import { EchoTalkApp } from '../../app';

// Bootstrap's modal transition timers are not needed here and can fire after the DOM is reset.
vi.mock('bootstrap', async (importOriginal) => {
    const original = await importOriginal<typeof import('bootstrap')>();
    const instance = { show: vi.fn(), hide: vi.fn() };
    return { ...original, Modal: { ...(original as any).Modal, getOrCreateInstance: vi.fn(() => instance), getInstance: vi.fn(() => instance) } };
});
import { loadSentences, addSentence, MY_SENTENCES_KEY } from '../../utils/my-sentences';

describe('MySentencesService', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        localStorage.clear();
        app = new EchoTalkApp();
        (app as any).bindEvents();
    });

    it('saves the sentence from the setup page and shows a message', () => {
        $('#sentenceInput').val('  I would like a coffee, please.  ');
        $('#saveSentenceBtn').trigger('click');
        expect(loadSentences().map(s => s.text)).toEqual(['I would like a coffee, please.']);
        expect(loadSentences()[0].lang).toBe(app.lang);
        expect($('#saveSentenceMessage').text()).toBe('Saved to My Sentences.');
    });

    it('explains why saving failed (empty, duplicate)', () => {
        $('#sentenceInput').val('   ');
        $('#saveSentenceBtn').trigger('click');
        expect($('#saveSentenceMessage').text()).toBe('Type a sentence first.');
        $('#sentenceInput').val('Same one');
        $('#saveSentenceBtn').trigger('click');
        $('#saveSentenceBtn').trigger('click');
        expect($('#saveSentenceMessage').text()).toContain('already in your list');
        expect(loadSentences()).toHaveLength(1);
    });

    it('adds from the modal form, lists newest first, and the data survives a new app instance', () => {
        app.mySentencesService.show();
        $('#mySentenceText').val('First sentence');
        $('#mySentenceForm').trigger('submit');
        $('#mySentenceText').val('Second sentence');
        $('#mySentenceForm').trigger('submit');
        expect($('#mySentencesList li').map((_i, el) => $(el).find('div').first().text()).get()).toEqual(['Second sentence', 'First sentence']);
        expect($('#mySentencesCount').text()).toBe('2 saved');

        const reopened = new EchoTalkApp();
        reopened.mySentencesService.render();
        expect($('#mySentencesList li').length).toBe(2);
        expect(localStorage.getItem(MY_SENTENCES_KEY)).toContain('Second sentence');
    });

    it('edits a sentence in place and can cancel', () => {
        addSentence('Old text', 'en-US');
        app.mySentencesService.show();
        $('#mySentencesList .btn-outline-light').first().trigger('click');
        expect($('#mySentenceText').val()).toBe('Old text');
        expect($('#mySentenceSubmit').text()).toBe('Save changes');
        expect($('#mySentenceCancel').hasClass('d-none')).toBe(false);
        $('#mySentenceText').val('New text');
        $('#mySentenceForm').trigger('submit');
        expect(loadSentences().map(s => s.text)).toEqual(['New text']);
        expect($('#mySentenceSubmit').text()).toBe('Add sentence');

        $('#mySentencesList .btn-outline-light').first().trigger('click');
        $('#mySentenceCancel').trigger('click');
        expect($('#mySentenceText').val()).toBe('');
        expect($('#mySentenceCancel').hasClass('d-none')).toBe(true);
    });

    it('deletes only after confirmation', () => {
        addSentence('Keep me', 'en-US');
        app.mySentencesService.show();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        $('#mySentencesList .btn-outline-danger').first().trigger('click');
        expect(loadSentences()).toHaveLength(1);
        confirmSpy.mockReturnValue(true);
        $('#mySentencesList .btn-outline-danger').first().trigger('click');
        expect(loadSentences()).toHaveLength(0);
        expect($('#mySentencesList').text()).toContain('Nothing saved yet');
    });

    it('Practice switches language and starts practice with the saved sentence (real hand-off)', async () => {
        addSentence('Practice this one', 'de-DE');
        app.mySentencesService.show();
        vi.spyOn(app.uiService, 'showPracticeSetup').mockImplementation(() => {});
        vi.spyOn(app.uiService, 'updateLanguageUI').mockImplementation(() => {});
        vi.spyOn(app.uiService, 'setupSampleOptions').mockImplementation(() => {});
        vi.spyOn(app.dataService, 'fetchSamples').mockResolvedValue({ levels: [] } as any);
        const start = vi.spyOn(app.practiceService, 'startPractice').mockResolvedValue();
        $('#mySentencesList .btn-primary').first().trigger('click');
        await new Promise(r => setTimeout(r, 5));
        expect(app.lang).toBe('de-DE');
        expect(app.sentence).toBe('Practice this one');
        expect(app.words).toEqual(['Practice', 'this', 'one']);
        expect($('#sentenceInput').attr('data-val')).toBe('Practice this one');
        expect(start).toHaveBeenCalledTimes(1);
    });

    it('Practice works for an entry with an empty language by using the current one', async () => {
        localStorage.setItem(MY_SENTENCES_KEY, JSON.stringify([{ id: 'a', text: 'No lang', lang: '', createdAt: 1 }]));
        app.mySentencesService.show();
        vi.spyOn(app.uiService, 'showPracticeSetup').mockImplementation(() => {});
        const start = vi.spyOn(app.practiceService, 'startPractice').mockResolvedValue();
        const lang = app.lang;
        $('#mySentencesList .btn-primary').first().trigger('click');
        await new Promise(r => setTimeout(r, 5));
        expect(app.lang).toBe(lang);
        expect(start).toHaveBeenCalled();
    });

    it('focus moves to the text box after deleting', () => {
        addSentence('Delete me', 'en-US');
        app.mySentencesService.show();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const focus = vi.fn();
        $('#mySentenceText').on('focus', focus);
        $('#mySentencesList .btn-outline-danger').first().trigger('click');
        expect(focus).toHaveBeenCalled();
    });

    it('renders stored text as text, never as HTML (even if storage was edited by hand)', () => {
        localStorage.setItem(MY_SENTENCES_KEY, JSON.stringify([
            { id: 'x', text: '<img src=x onerror=window.pwned=1> "quoted"', lang: 'en-US', createdAt: 1 },
        ]));
        app.mySentencesService.show();
        expect($('#mySentencesList img').length).toBe(0);
        expect($('#mySentencesList').text()).toContain('<img src=x onerror=window.pwned=1>');
        expect((window as any).pwned).toBeUndefined();
    });

    it('saving strips angle brackets from what the user typed', () => {
        addSentence('<img src=x onerror=window.pwned=1> hello', 'en-US');
        const [saved] = loadSentences();
        expect(saved.text).not.toMatch(/[<>]/);
    });

    it('buttons have accessible names that include the sentence', () => {
        addSentence('Hello there', 'en-US');
        app.mySentencesService.show();
        expect($('#mySentencesList .btn-primary').attr('aria-label')).toBe('Practice: Hello there');
        expect($('#mySentencesList .btn-outline-danger').attr('aria-label')).toBe('Delete: Hello there');
    });

    it('the "Saved" message clears when the sentence box changes', () => {
        $('#sentenceInput').val('Something new');
        $('#saveSentenceBtn').trigger('click');
        expect($('#saveSentenceMessage').text()).toBe('Saved to My Sentences.');
        $('#sentenceInput').trigger('input');
        expect($('#saveSentenceMessage').text()).toBe('');
    });

    it('startPracticeFrom reports failure when language data cannot be prepared, and My Practices keeps its dialog open', async () => {
        vi.spyOn(app.uiService, 'showPracticeSetup').mockImplementation(() => {});
        vi.spyOn(app.uiService, 'updateLanguageUI').mockImplementation(() => {});
        vi.spyOn(app.uiService, 'setupSampleOptions').mockImplementation(() => { throw new Error('boom'); });
        vi.spyOn(app.dataService, 'fetchSamples').mockResolvedValue({ levels: [] } as any);
        const start = vi.spyOn(app.practiceService, 'startPractice').mockResolvedValue();
        expect(await app.startPracticeFrom('Hello there', 'de-DE')).toBe(false);
        expect(start).not.toHaveBeenCalled();

        const hide = vi.fn();
        const { Modal } = await import('bootstrap');
        (Modal.getInstance as any).mockReturnValue({ hide });
        const btn = $('<button>').data('sentence', 'Hello there').data('lang', 'fr-FR')[0];
        await app.handlePracticeThis(btn);
        expect(hide).not.toHaveBeenCalled();
    });

    it('startPracticeFrom returns true and starts when everything is fine', async () => {
        vi.spyOn(app.uiService, 'showPracticeSetup').mockImplementation(() => {});
        const start = vi.spyOn(app.practiceService, 'startPractice').mockResolvedValue();
        expect(await app.startPracticeFrom('Fine sentence', app.lang)).toBe(true);
        expect(start).toHaveBeenCalledTimes(1);
    });
});
