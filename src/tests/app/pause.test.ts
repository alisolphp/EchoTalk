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
        expect($('#pauseResumeBtn').attr('aria-pressed')).toBe('true');
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
        expect($('#pauseResumeBtn').attr('aria-pressed')).toBe('false');
        vi.advanceTimersByTime(2999);
        expect(cb).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('a modal closing or the tab becoming visible does not resume a manual pause', () => {
        app.uiService.setupPracticeUI();
        app.toggleUserPause();
        app.resumeAutoSkip(); // what the modal-hidden / visibility handlers call
        expect(app.autoSkipIsPaused).toBe(true);
        expect(app.autoSkipUserPaused).toBe(true);
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
});
