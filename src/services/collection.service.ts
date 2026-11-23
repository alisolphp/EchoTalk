import $ from 'jquery';
import { Modal } from 'bootstrap';
import { EchoTalkApp } from '../app';
import {
    QaCollection, ImportError, IMPORT_ERROR_MESSAGES, extractTokenFromHash, isImportHash, fetchCollection,
} from '../utils/dontapply-import';

/** A collection as stored in IndexedDB (store `collections`, keyPath `key`). */
/** Where the empty state sends people; the UTM parameters say which screen the visit came from. */
export const DONTAPPLY_LINK = 'https://dontapply.club/?utm_source=echotalk&utm_medium=app&utm_campaign=qa_collections';

export interface StoredCollection extends QaCollection {
    source: 'dontapply';
    createdAt: Date;
    /** Index of the next question to practice (resume point); 0 = start. */
    progress: number;
}

/** Minimal storage contract so the add-or-find logic can be tested without IndexedDB. */
export interface CollectionStore {
    get(key: string): Promise<StoredCollection | undefined>;
    put(c: StoredCollection): Promise<void>;
    getAll(): Promise<StoredCollection[]>;
    remove(key: string): Promise<void>;
}

/** Adds the collection unless one with the same content key already exists. */
export async function addOrFind(
    store: CollectionStore, incoming: QaCollection,
): Promise<{ collection: StoredCollection; added: boolean }> {
    const existing = await store.get(incoming.key);
    if (existing) return { collection: existing, added: false };
    const collection: StoredCollection = { ...incoming, source: 'dontapply', createdAt: new Date(), progress: 0 };
    await store.put(collection);
    return { collection, added: true };
}

/** IndexedDB-backed store (object store `collections`). */
export class IdbCollectionStore implements CollectionStore {
    constructor(private getDb: () => IDBDatabase) {}

    private run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const req = fn(this.getDb().transaction(['collections'], mode).objectStore('collections'));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    get(key: string) { return this.run('readonly', s => s.get(key) as IDBRequest<StoredCollection | undefined>); }
    async put(c: StoredCollection) { await this.run('readwrite', s => s.put(c)); }
    getAll() { return this.run('readonly', s => s.getAll() as IDBRequest<StoredCollection[]>); }
    async remove(key: string) { await this.run('readwrite', s => s.delete(key)); }
}

/**
 * Practising imported Q and A collections: import via one-time link, the collection list,
 * and the first-to-last practice flow (question on top, answer is the practice text).
 */
export class CollectionService {
    private app: EchoTalkApp;
    private active: StoredCollection | null = null;
    private index = 0;
    private storeOverride: CollectionStore | null = null;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /** Tests can inject an in-memory store. */
    public setStore(store: CollectionStore | null): void {
        this.storeOverride = store;
    }

    private get store(): CollectionStore {
        return this.storeOverride ?? new IdbCollectionStore(() => this.app.db);
    }

    public isActive(): boolean {
        return this.active !== null;
    }

    private pending: { token: string | null } | null = null;

    /**
     * First thing at startup, synchronous: if the URL hash carries an import token, remember it and
     * remove it from the address bar at once (before the database, any network call or anything that can fail).
     */
    public captureLaunchToken(): void {
        const hash = window.location.hash;
        if (!isImportHash(hash)) return;
        this.pending = { token: extractTokenFromHash(hash) };
        try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
            // Not fatal: the token is single-use anyway.
        }
    }

    /** Runs the import captured by captureLaunchToken(), once. */
    public async runPendingImport(): Promise<void> {
        const pending = this.pending;
        this.pending = null;
        if (!pending) return;
        if (!pending.token) {
            this.showStatus(IMPORT_ERROR_MESSAGES.bad_token, 'danger');
            return;
        }
        await this.importWithToken(pending.token);
    }

    /** Capture and run in one step (used by tests and callers that do not need the early capture). */
    public async handleLaunchHash(): Promise<void> {
        this.captureLaunchToken();
        await this.runPendingImport();
    }

    /** Fetches the collection with a one-time token, stores it if new, and starts practice from question 1. */
    public async importWithToken(token: string): Promise<void> {
        this.app.uiService.showPracticeSetup();
        this.showStatus('Importing your notes from DontApply...', 'info');
        let incoming: QaCollection;
        try {
            incoming = await fetchCollection(token);
        } catch (e) {
            const code = e instanceof ImportError ? e.code : 'http_error';
            this.showStatus(IMPORT_ERROR_MESSAGES[code], 'danger');
            return;
        }
        let collection: StoredCollection;
        let added: boolean;
        try {
            ({ collection, added } = await addOrFind(this.store, incoming));
        } catch {
            this.showStatus('Could not save the notes on this device.', 'danger');
            return;
        }
        const label = added ? `Added "${collection.title}" to your collections.` : `"${collection.title}" is already in your collections.`;
        if (this.app.area === 'Practice') {
            // The user started their own practice while the import was running: do not take it over.
            this.showStatus(`${label} Open "My Q&A Collections" in For You to practice it.`, 'success');
            return;
        }
        this.showStatus(label, 'success');
        try {
            await this.start(collection, 0);
        } catch (e) {
            console.error('Could not start the collection:', e);
            this.showStatus('The notes were saved, but practice could not start. Open "My Q&A Collections" in For You.', 'warning');
        }
    }

    /** Starts (or restarts) a collection at the given question. */
    public async start(collection: StoredCollection, index: number): Promise<void> {
        this.active = collection;
        await this.startItem(Math.min(Math.max(index, 0), collection.items.length - 1));
    }

    private async startItem(index: number): Promise<void> {
        const c = this.active!;
        this.index = index;
        const item = c.items[index];

        if (c.lang !== this.app.lang && this.app.languageMap[c.lang]) {
            await this.switchLanguage(c.lang);
        }

        $('#sentenceInput').val(item.answer).attr('data-val', item.answer);
        this.renderBanner();
        await this.app.practiceService.startPractice();
    }

    /** Switches the app language the way the language selector does, including the sample sentences. */
    private async switchLanguage(lang: string): Promise<void> {
        this.app.lang = lang;
        this.app.uiService.updateLanguageUI();
        try {
            this.app.samples = await this.app.dataService.fetchSamples();
            this.app.uiService.setupSampleOptions();
        } catch (e) {
            console.error('Could not load sample sentences for the new language:', e);
        }
    }

    private renderBanner(): void {
        const c = this.active;
        if (!c) {
            $('#collectionBanner').addClass('d-none');
            return;
        }
        $('#collectionProgress').text(`${c.title} - question ${this.index + 1} of ${c.items.length}`);
        $('#collectionQuestion').text(c.items[this.index].question);
        $('#collectionBanner').removeClass('d-none');
    }

    /** Adds the Next-question / Finish button to the session-complete screen while a collection is active. */
    public decorateCompletion(): void {
        const c = this.active;
        if (!c) return;
        const isLast = this.index >= c.items.length - 1;
        void this.saveProgress(isLast ? 0 : this.index + 1);

        const $newBtn = $('#session-complete-container .btn-secondary').first();
        const $h2 = $('#session-complete-container h2').first();
        $h2.after($('<p class="text-muted small mb-0"></p>').text(
            isLast ? 'You finished the whole collection.' : `Question ${this.index + 1} of ${c.items.length} done.`));

        const $next = $('<button type="button" class="btn btn-success btn-lg" id="collectionNextBtn"></button>')
            .text(isLast ? 'Finish collection' : 'Next question')
            .on('click', () => (isLast ? this.exit(true) : this.next()));
        $('#restartPracticeBtn').before($next);
        $newBtn.text('Back to setup').attr('onclick', null).on('click', () => this.exit(true));
        $('#collectionNextBtn').trigger('focus');
    }

    /** Advances to the next question; at the end, leaves collection mode. */
    public async next(): Promise<void> {
        const c = this.active;
        if (!c) return;
        if (this.index >= c.items.length - 1) {
            await this.exit(true);
            return;
        }
        if (this.app.autoRestartTimer) {
            clearTimeout(this.app.autoRestartTimer);
            this.app.autoRestartTimer = null;
        }
        await this.startItem(this.index + 1);
    }

    /** Leaves collection mode; optionally returns to the setup screen. */
    public async exit(resetUi: boolean = false): Promise<void> {
        this.active = null;
        this.renderBanner();
        if (resetUi) await this.app.resetWithoutReload();
    }

    /** Clears collection mode without touching the UI (used by resetWithoutReload). */
    public clear(): void {
        this.active = null;
        $('#collectionBanner').addClass('d-none');
        $('#importStatus').addClass('d-none');
    }

    private async saveProgress(progress: number): Promise<void> {
        const c = this.active;
        if (!c) return;
        c.progress = progress;
        try {
            // Do not bring back a collection the user deleted while it was open.
            if (!(await this.store.get(c.key))) return;
            await this.store.put(c);
        } catch {
            // Progress is a convenience; ignore storage errors.
        }
    }

    /** Fills and opens the collections list modal. */
    public async showList(): Promise<void> {
        const $body = $('#collectionsList').empty();
        let all: StoredCollection[] = [];
        try {
            all = await this.store.getAll();
        } catch {
            $body.append($('<p class="text-danger"></p>').text('Could not load your collections.'));
        }
        if (all.length === 0) {
            const $link = $('<a target="_blank" rel="noopener"></a>').attr('href', DONTAPPLY_LINK).text('DontApply');
            $body.append($('<p class="text-muted"></p>')
                .append('No collections yet. In ')
                .append($link)
                .append(', open an interview Q and A note and choose "Study in EchoTalk".'));
        }
        all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).forEach(c => {
            const resume = c.progress > 0 && c.progress < c.items.length;
            const launch = async (from: number) => {
                Modal.getOrCreateInstance($('#collectionsModal')[0]).hide();
                this.app.uiService.showPracticeSetup();
                await this.start(c, from);
            };
            const $row = $('<div class="list-group-item d-flex flex-wrap align-items-center gap-2"></div>');
            $row.append($('<div class="flex-grow-1"></div>')
                .append($('<div class="fw-bold" dir="auto"></div>').text(c.title))
                .append($('<small class="text-muted"></small>').text(
                    `${c.items.length} questions${resume ? ` - next: ${c.progress + 1}` : ''}`)));
            $row.append($('<button type="button" class="btn btn-sm btn-primary"></button>')
                .text(resume ? 'Continue' : 'Start')
                .on('click', () => launch(resume ? c.progress : 0)));
            if (resume) {
                $row.append($('<button type="button" class="btn btn-sm btn-outline-secondary"></button>')
                    .text('From the start').on('click', () => launch(0)));
            }
            $row.append($('<button type="button" class="btn btn-sm btn-outline-danger"></button>')
                .attr('aria-label', `Delete ${c.title}`).text('Delete')
                .on('click', async () => {
                    if (!window.confirm(`Delete "${c.title}" from this device?`)) return;
                    try {
                        if (this.active?.key === c.key) this.clear();
                        await this.store.remove(c.key);
                    } catch (e) {
                        console.error('Could not delete the collection:', e);
                        window.alert('Could not delete the collection. Please try again.');
                    }
                    await this.showList();
                }));
            $body.append($row);
        });
        Modal.getOrCreateInstance($('#collectionsModal')[0]).show();
    }

    /** Shows a dismissible status line near the top of the page (plain text only). */
    public showStatus(message: string, kind: 'info' | 'success' | 'warning' | 'danger'): void {
        const $box = $('#importStatus');
        $('#importStatusClose').off('click').on('click', () => $box.addClass('d-none'));
        $box.removeClass('d-none alert-info alert-success alert-warning alert-danger').addClass(`alert-${kind}`);
        $('#importStatusText').text(message);
    }
}
