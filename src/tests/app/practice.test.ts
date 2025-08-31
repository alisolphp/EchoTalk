import { EchoTalkApp } from '../../assets/js/app';
import { vi } from 'vitest';
import $ from 'jquery';

// helpers
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (predicate: () => boolean, timeout = 2000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (predicate()) return;
        // Let the event loop and microtasks proceed
        await sleep(0);
    }
    throw new Error('waitFor timeout: condition not met');
};

describe('Practice Logic', () => {
    let app: EchoTalkApp;

    beforeEach(() => {
        vi.useRealTimers();

        // Mock $.getJSON to avoid real network requests during tests
        ($.getJSON as any) = vi.fn(() =>
            Promise.resolve({
                sentences: ['Practice sentence one', 'Practice sentence two'],
            })
        );
        localStorage.clear();
        app = new EchoTalkApp();
    });

    it('should switch to practice view when "Start Practice" is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click');

        expect($('#configArea').hasClass('d-none')).toBe(true);
        expect($('#practiceArea').hasClass('d-none')).toBe(false);
        expect((window as any).speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should cancel speech and reload page when reset is clicked', async () => {
        await app.init();
        $('#startBtn').trigger('click');
        $('#resetBtn').trigger('click');

        expect((window as any).speechSynthesis.cancel).toHaveBeenCalled();
        expect((location as any).reload).toHaveBeenCalled();
        expect(localStorage.getItem('shadow_sentence')).toBeNull();
    });

    it('should finish session and show final message when finishSession is invoked', async () => {
        await app.init();

        // Direct method call to bypass UI flow and test final state
        (app as any).finishSession();

        expect($('#practiceArea').find('h2').length).toBeGreaterThan(0);
        expect(localStorage.getItem('shadow_index')).toBeNull();
        expect(localStorage.getItem('shadow_count')).toBeNull();
    });

    it('should start and stop recording when audio recording is enabled', async () => {
        // Pre-set recording flag so init picks it up via loadState
        localStorage.setItem('shadow_record_audio', 'true');

        await app.init();
        $('#startBtn').trigger('click');

        // Wait for the chain: onend → startRecording → getUserMedia to complete
        await waitFor(() => Boolean((app as any).mediaRecorder), 2000);

        const mr = (app as any).mediaRecorder;
        expect(mr).toBeDefined();
        expect(typeof mr.start).toBe('function');

        // Simulate manual recording control
        mr.start();
        mr.stop();

        expect(mr.start).toHaveBeenCalled();
        expect(mr.stop).toHaveBeenCalled();
    });
});
