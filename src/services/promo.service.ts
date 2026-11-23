/**
 * Small, dismissible promo blocks shown before practice starts and at the end of a session.
 * All texts and links live in PROMO_CONTENT so they can be edited in one place.
 */

export const PROMO_CONTENT = {
    dontApply: {
        text: 'Looking for visa-sponsored or international remote jobs?',
        linkText: 'Visit dontapply.club',
        href: 'https://dontapply.club/?utm_source=echotalk&utm_medium=app&utm_campaign=practice_promo',
    },
    podcast: {
        text: 'We also have a multilingual podcast; use it to strengthen your listening.',
        linkText: 'Open the Telegram channel',
        href: 'https://t.me/AceInterviews',
    },
    dismissLabel: 'Dismiss this message',
    regionLabel: 'Sponsored links',
} as const;

/** sessionStorage key: a dismissed block stays hidden until the browser session ends. */
export const PROMO_DISMISS_KEY = 'echotalk_promo_dismissed';

export type PromoPlacement = 'pre' | 'end';

function isDismissed(): boolean {
    try {
        return sessionStorage.getItem(PROMO_DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

function rememberDismissal(): void {
    try {
        sessionStorage.setItem(PROMO_DISMISS_KEY, '1');
    } catch {
        // Storage may be unavailable (private mode); blocks then reappear on the next render.
    }
}

function buildLine(text: string, linkText: string, href: string): HTMLParagraphElement {
    const p = document.createElement('p');
    p.className = 'mb-1';
    p.appendChild(document.createTextNode(text + ' '));
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = linkText;
    p.appendChild(a);
    return p;
}

/** Builds one promo block element (both promo lines plus a dismiss button). */
export function buildPromoBlock(placement: PromoPlacement): HTMLElement {
    const box = document.createElement('aside');
    box.className = 'promo-block rounded px-3 py-2 mt-3 d-flex align-items-start gap-2';
    box.setAttribute('data-promo', placement);
    box.setAttribute('aria-label', PROMO_CONTENT.regionLabel);
    box.setAttribute('dir', 'auto');

    const body = document.createElement('div');
    body.className = 'flex-grow-1';
    body.appendChild(buildLine(PROMO_CONTENT.dontApply.text, PROMO_CONTENT.dontApply.linkText, PROMO_CONTENT.dontApply.href));
    body.appendChild(buildLine(PROMO_CONTENT.podcast.text, PROMO_CONTENT.podcast.linkText, PROMO_CONTENT.podcast.href));

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn-close flex-shrink-0';
    close.setAttribute('aria-label', PROMO_CONTENT.dismissLabel);
    close.addEventListener('click', () => {
        rememberDismissal();
        document.querySelectorAll('.promo-block').forEach(el => el.remove());
        // The focused button is gone: move focus to the main action next to the block.
        const next = document.getElementById(placement === 'pre' ? 'startBtn' : 'restartPracticeBtn');
        next?.focus();
    });

    box.appendChild(body);
    box.appendChild(close);
    return box;
}

/**
 * Renders the promo block into the container unless the user dismissed it this session.
 * Replaces any previous block in the container, so it is safe to call repeatedly.
 */
export function renderPromo(container: Element | null, placement: PromoPlacement): void {
    if (!container) return;
    container.querySelectorAll('.promo-block').forEach(el => el.remove());
    if (isDismissed()) return;
    container.appendChild(buildPromoBlock(placement));
}
