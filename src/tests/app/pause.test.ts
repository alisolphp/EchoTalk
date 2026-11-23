import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import $ from 'jquery';
import { EchoTalkApp } from '../../app';

describe('Auto-skip pause and resume button', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        vi.useFakeTimers();
        (globalThis as any).speechSynthesis = { speaking: false, paused: false, pause: vi.fn(), resume: vi.fn(), cancel: vi.fn() };
        app = new EchoTalkApp();
        app.practiceMode = 'auto-skip';
        app.area = 'Practice';
    });
    afterEach(() => { vi.useRealTimers(); });

    it('is shown only in auto-skip mode', () => {
        app.uiService.setupPracticeUI();
        expect($('#pauseResumeBtn').hasClass('d-none')).toBe(false);
        app.practiceMode = 'skip';
        app.uiService.setupPracticeUI();
        expect($('#pauseResumeBtn').hasClass('d-none')).toBe(true);
        app.practiceMode = 'check';
        app.uiService.setupPracticeUI();
        expect($('#pauseResumeBtn').hasClass('d-none')).toBe(true);
    });

    it('pauses: stops the countdown timer, freezes the animation and updates the label', () => {
        const cb = vi.fn();
        app.autoSkipTimerCallback = cb;
        app.autoSkipWaitTime = 4000;
        app.autoSkipStartTime = Date.now();
        app.autoSkipTimer = setTimeout(cb, 4000) as any;
        app.uiService.setupPracticeUI();

        vi.advanceTimersByTime(1000);
        app.toggleUserPause();

        expect(app.autoSkipUserPaused).toBe(true);
        expect(app.autoSkipIsPaused).toBe(true);
        expect(app.autoSkipRemainingTime).toBe(3000);
        expect($('#pauseResumeBtn').text()).toContain('Resume');
        expect($('#pauseStatus').text()).toBe('Paused');
        expect($('#checkBtn').css('animation-play-state')).toBe('paused');

        vi.advanceTimersByTime(60000);
        expect(cb).not.toHaveBeenCalled();
    });

    it('resumes: restarts the timer with the remaining time', () => {
        const cb = vi.fn();
        app.autoSkipTimerCallback = cb;
        app.autoSkipWaitTime = 4000;
        app.autoSkipStartTime = Date.now();
        app.autoSkipTimer = setTimeout(cb, 4000) as any;
        app.uiService.setupPracticeUI();

        vi.advanceTimersByTime(1000);
        app.toggleUserPause();
        vi.advanceTimersByTime(10000);
        app.toggleUserPause();

        expect(app.autoSkipUserPaused).toBe(false);
        expect(app.autoSkipIsPaused).toBe(false);
        expect($('#pauseResumeBtn').text()).toContain('Pause');
        expect($('#pauseStatus').text()).toBe('');
        vi.advanceTimersByTime(2999);
        expect(cb).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('pausing while speaking pauses speech synthesis; resuming resumes it', () => {
        (globalThis as any).speechSynthesis.speaking = true;
        app.uiService.setupPracticeUI();
        app.toggleUserPause();
        expect(speechSynthesis.pause).toHaveBeenCalled();
        (globalThis as any).speechSynthesis.paused = true;
        app.toggleUserPause();
        expect(speechSynthesis.resume).toHaveBeenCalled();
    });

    it('the word modal closing and the tab becoming visible do not undo a manual pause (real events)', () => {
        (app as any).bindEvents();
        app.uiService.setupPracticeUI();
        app.toggleUserPause();
        const modal = document.getElementById('wordActionsModal')!;
        modal.dispatchEvent(new Event('hidden.bs.modal', { bubbles: true }));
        const original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        try {
            document.dispatchEvent(new Event('visibilitychange'));
        } finally {
            delete (document as any).visibilityState;
            if (original) Object.defineProperty(Document.prototype, 'visibilityState', original);
        }
        expect(app.autoSkipIsPaused).toBe(true);
        expect(app.autoSkipUserPaused).toBe(true);
    });

    it('restart, reset and finish undo the frozen animation and paused speech', async () => {
        app.uiService.setupPracticeUI();
        app.toggleUserPause();
        expect($('#checkBtn').css('animation-play-state')).toBe('paused');
        (globalThis as any).speechSynthesis.paused = true;

        app.uiService.setupPracticeUI(); // restart path
        expect($('#checkBtn').css('animation-play-state')).toBe('running');
        expect(speechSynthesis.resume).toHaveBeenCalled();

        (speechSynthesis.resume as any).mockClear();
        app.toggleUserPause();
        (globalThis as any).speechSynthesis.paused = true;
        await app.resetWithoutReload();
        expect($('#checkBtn').css('animation-play-state')).toBe('running');
        expect(speechSynthesis.resume).toHaveBeenCalled();

        app.practiceMode = 'auto-skip';
        app.area = 'Practice';
        app.toggleUserPause();
        vi.spyOn(app.practiceService as any, 'recordPracticeCompletion').mockResolvedValue({ newStreak: 1, oldStreak: 1 });
        vi.spyOn(app, 'releaseWakeLock').mockResolvedValue();
        vi.spyOn(app.audioService, 'playSound').mockImplementation(() => {});
        vi.spyOn(app.audioService, 'speak').mockImplementation(() => {});
        await app.practiceService.finishSession();
        expect(app.autoSkipUserPaused).toBe(false);
        expect($('#pauseResumeBtn').text()).toContain('Pause');
        expect($('#checkBtn').css('animation-play-state')).toBe('running');
    });

    it('does nothing outside auto-skip practice', () => {
        app.practiceMode = 'skip';
        app.toggleUserPause();
        expect(app.autoSkipUserPaused).toBe(false);
        expect(app.autoSkipIsPaused).toBe(false);
    });

    it('is cleared when the practice UI is set up again and on reset', async () => {
        app.uiService.setupPracticeUI();
        app.toggleUserPause();
        app.uiService.setupPracticeUI();
        expect(app.autoSkipUserPaused).toBe(false);
        expect(app.autoSkipIsPaused).toBe(false);
        expect($('#pauseResumeBtn').text()).toContain('Pause');

        app.toggleUserPause();
        await app.resetWithoutReload();
        expect(app.autoSkipUserPaused).toBe(false);
        expect(app.autoSkipIsPaused).toBe(false);
    });

    it('the button click is wired to the toggle', () => {
        (app as any).bindEvents();
        app.uiService.setupPracticeUI();
        $('#pauseResumeBtn').trigger('click');
        expect(app.autoSkipUserPaused).toBe(true);
    });

    it('manual pause releases the wake lock and pauses the recorder; resume re-requests and resumes', () => {
        const release = vi.spyOn(app, 'releaseWakeLock').mockResolvedValue();
        const request = vi.spyOn(app, 'requestWakeLock').mockResolvedValue();
        const rec = { state: 'recording', pause: vi.fn(() => { rec.state = 'paused'; }), resume: vi.fn(() => { rec.state = 'recording'; }) };
        (app.audioService as any).mediaRecorder = rec;
        app.uiService.setupPracticeUI();

        app.toggleUserPause();
        expect(release).toHaveBeenCalledTimes(1);
        expect(rec.pause).toHaveBeenCalledTimes(1);
        expect(rec.state).toBe('paused');

        app.toggleUserPause();
        expect(request).toHaveBeenCalledTimes(1);
        expect(rec.resume).toHaveBeenCalledTimes(1);
        expect(rec.state).toBe('recording');
    });

    it('a recorder left paused is resumed when the pause state is cleared (so it can stop and save normally)', () => {
        const rec = { state: 'recording', pause: vi.fn(() => { rec.state = 'paused'; }), resume: vi.fn(() => { rec.state = 'recording'; }) };
        (app.audioService as any).mediaRecorder = rec;
        vi.spyOn(app, 'releaseWakeLock').mockResolvedValue();
        app.uiService.setupPracticeUI();
        app.toggleUserPause();
        app.clearPauseState();
        expect(rec.state).toBe('recording');
    });

    it('the pause button has no stale aria-pressed attribute', () => {
        expect(document.getElementById('pauseResumeBtn')!.hasAttribute('aria-pressed')).toBe(false);
    });
});
