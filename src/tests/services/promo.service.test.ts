import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderPromo, PROMO_CONTENT, PROMO_DISMISS_KEY } from '../../services/promo.service';

const DONTAPPLY_URL = 'https://dontapply.club/?utm_source=echotalk&utm_medium=app&utm_campaign=practice_promo';
const TELEGRAM_URL = 'https://t.me/AceInterviews';

describe('promo blocks', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.body.innerHTML = '<div id="promoPre"></div><div id="session-complete-container"></div>';
    });

    it.each([['promoPre', 'pre'], ['session-complete-container', 'end']] as const)(
        'renders in #%s with exact links and safe attributes',
        (id, placement) => {
            renderPromo(document.getElementById(id), placement);
            const block = document.querySelector(`[data-promo="${placement}"]`)!;
            expect(block).not.toBeNull();
            const links = Array.from(block.querySelectorAll('a'));
            expect(links.map(a => a.getAttribute('href'))).toEqual([DONTAPPLY_URL, TELEGRAM_URL]);
            links.forEach(a => {
                expect(a.target).toBe('_blank');
                expect(a.rel).toContain('noopener');
            });
            expect(block.textContent).toContain('Looking for visa-sponsored or international remote jobs?');
            expect(block.textContent).toContain('We also have a multilingual podcast; use it to strengthen your listening.');
            expect(block.getAttribute('dir')).toBe('auto');
            expect(block.querySelector('button')!.getAttribute('aria-label')).toBe(PROMO_CONTENT.dismissLabel);
        }
    );

    it('does not duplicate the block when rendered twice', () => {
        const el = document.getElementById('promoPre');
        renderPromo(el, 'pre');
        renderPromo(el, 'pre');
        expect(el!.querySelectorAll('.promo-block')).toHaveLength(1);
    });

    it('dismiss removes all blocks and keeps them hidden for the session', () => {
        renderPromo(document.getElementById('promoPre'), 'pre');
        renderPromo(document.getElementById('session-complete-container'), 'end');
        (document.querySelector('.promo-block button') as HTMLButtonElement).click();
        expect(document.querySelectorAll('.promo-block')).toHaveLength(0);
        expect(sessionStorage.getItem(PROMO_DISMISS_KEY)).toBe('1');
        renderPromo(document.getElementById('promoPre'), 'pre');
        expect(document.querySelectorAll('.promo-block')).toHaveLength(0);
    });

    it('moves focus to the main action after dismissing', () => {
        document.body.innerHTML = '<div id="promoPre"></div><button id="startBtn"></button><div id="session-complete-container"></div><button id="restartPracticeBtn"></button>';
        renderPromo(document.getElementById('promoPre'), 'pre');
        (document.querySelector('.promo-block button') as HTMLButtonElement).click();
        expect(document.activeElement?.id).toBe('startBtn');

        sessionStorage.clear();
        renderPromo(document.getElementById('session-complete-container'), 'end');
        (document.querySelector('.promo-block button') as HTMLButtonElement).click();
        expect(document.activeElement?.id).toBe('restartPracticeBtn');
    });

    it('still renders and dismisses when sessionStorage throws', () => {
        const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        try {
            renderPromo(document.getElementById('promoPre'), 'pre');
            expect(document.querySelectorAll('.promo-block')).toHaveLength(1);
            expect(() => (document.querySelector('.promo-block button') as HTMLButtonElement).click()).not.toThrow();
            expect(document.querySelectorAll('.promo-block')).toHaveLength(0);
        } finally {
            getSpy.mockRestore();
            setSpy.mockRestore();
        }
    });

    it('ignores a missing container', () => {
        expect(() => renderPromo(null, 'pre')).not.toThrow();
    });
});
