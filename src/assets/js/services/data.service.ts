import $ from 'jquery';
import { Modal } from 'bootstrap';
import { EchoTalkApp } from '../app';
import { Recording, Practice, SampleData } from '../types';

/**
 * Service for managing all data-related operations, including fetching
 * sample sentences and interacting with the IndexedDB database.
 */
export class DataService {
    private app: EchoTalkApp;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /**
     * Fetches the sample sentences for the current language from a JSON file.
     * @returns A promise that resolves with the sample data.
     */
    public fetchSamples(): Promise<SampleData> {
        return $.getJSON(`./data/sentences/sentences-${this.app.lang}.json`);
    }

    /**
     * Initializes the IndexedDB database.
     * Creates object stores for 'recordings' and 'practices' if they don't exist.
     * @returns A promise that resolves with the database instance.
     */
    public initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EchoTalkDB', 3);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('recordings')) {
                    const store = db.createObjectStore('recordings', { autoIncrement: true });
                    store.createIndex('sentence', 'sentence', { unique: false });
                }
                if (!db.objectStoreNames.contains('practices')) {
                    const store = db.createObjectStore('practices', { keyPath: 'sentence' });
                    store.createIndex('lastPracticed', 'lastPracticed', { unique: false });
                }
            };
            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };
            request.onerror = (event) => {
                console.error("Database error:", (event.target as IDBOpenDBRequest).error);
                reject("Database error");
            };
        });
    }

    /**
     * Saves a user's audio recording (as a Blob) to the 'recordings' object store in IndexedDB.
     * @param blob The audio data Blob to be saved.
     */
    public async saveRecording(blob: Blob): Promise<void> {
        const record: Recording = {
            sentence: this.app.currentPhrase,
            audio: blob,
            timestamp: new Date(),
            lang: this.app.lang
        };
        const transaction = this.app.db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        store.add(record);
    }

    /**
     * Fetches all recordings from IndexedDB, groups them by sentence, sorts them,
     * and renders them into the recordings modal.
     */
    public async displayRecordings(): Promise<void> {
        if (!this.app.db) return;
        const transaction = this.app.db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        const allRecords: Recording[] = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as Recording[]);
            request.onerror = err => reject(err);
        });

        const grouped: Record<string, Recording[]> = {};
        allRecords.forEach(rec => {
            if (!grouped[rec.sentence]) {
                grouped[rec.sentence] = [];
            }
            grouped[rec.sentence].push(rec);
        });
        window.modalRecordings = grouped;

        const $list = $('#recordingsList');
        $list.empty();
        if (Object.keys(grouped).length === 0) {
            $list.html('<p class="text-center text-muted">No recordings found yet. Enable "Record my voice" and start practicing!</p>');
            return;
        }

        const sortedSentences = Object.keys(grouped).sort((a, b) => {
            const lastA = Math.max(...grouped[a].map(r => r.timestamp?.getTime() || 0));
            const lastB = Math.max(...grouped[b].map(r => r.timestamp?.getTime() || 0));
            return lastB - lastA;
        });

        for (const sentence of sortedSentences) {
            const recordings = grouped[sentence].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
            const truncated = this.app.utilService.truncateSentence(sentence);
            const uniqueId = sentence.hashCode();
            const lastRecTime = recordings[0].timestamp;
            const count = recordings.length;
            const sentenceHtml = `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-${uniqueId}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}" aria-expanded="false">
                        <div class="w-100 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
                            <span class="fw-bold mb-1 mb-sm-0">${truncated}</span>
                            <div class="d-flex align-items-center">
                                <span class="badge bg-secondary me-2">${count} recording${count > 1 ? 's' : ''}</span>
                                <small class="text-muted">${lastRecTime.toLocaleString()}</small>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#recordingsList" data-sentence="${sentence.replace(/"/g, '&quot;')}">
                    <div class="accordion-body">
                        <ul class="list-group">
                            ${recordings.map((rec, index) => `
                                <li class="list-group-item">
                                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                                        <span class="mb-2 mb-md-0">Recording from ${rec.timestamp?.toLocaleString() || 'an old date'}</span>
                                        <div class="row g-2 justify-content-center">
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-success play-bot-audio w-100" data-sentence="${sentence}">
                                                    <i class="bi bi-robot"></i> Play Bot
                                                </button>
                                            </div>
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-primary play-user-audio w-100" data-sentence="${sentence}" data-index="${index}">
                                                    <i class="bi bi-person-fill"></i> Play Mine
                                                </button>
                                            </div>
                                            ${this.app.lang === 'en-US' && this.app.spellCheckerIsAvailable ? `
                                                <div class="col-6 col-md-auto">
                                                    <button class="btn btn-sm btn-info check-accuracy-btn w-100" data-sentence="${sentence}" data-index="${index}" title="Check pronunciation accuracy">
                                                        <i class="bi bi-magic"></i> Fast <span class="text-nowrap">AI Analyze</span>
                                                    </button>
                                                </div>
                                            ` : ''}
                                            <div class="col-6 col-md-auto">
                                                <button class="btn btn-sm btn-warning prepare-for-ai w-100" title="Prepare file and prompt for analysis by AI" data-sentence="${sentence}" data-index="${index}">
                                                    <i class="bi bi-magic"></i> Full <span class="text-nowrap">AI Analyze</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="accuracy-result-container mt-2 border-top pt-2" style="display: none;"></div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>`;
            $list.append(sentenceHtml);
        }
    }

    /**
     * Fetches all practice history from IndexedDB, sorts it by the last practiced date,
     * and displays it in the practices modal.
     */
    public async displayPractices(): Promise<void> {
        const transaction = this.app.db.transaction(['practices'], 'readonly');
        const store = transaction.objectStore('practices');
        const request = store.getAll();

        request.onsuccess = () => {
            const practices: Practice[] = request.result;
            const $practicesList = $('#practicesList');
            $practicesList.empty();

            if (practices.length === 0) {
                $practicesList.html('<p class="text-center text-muted">No practices recorded yet. Start a session to see your progress!</p>');
            } else {
                practices.sort((a, b) => b.lastPracticed.getTime() - a.lastPracticed.getTime());
                practices.forEach(p => {
                    const langName = this.app.languageMap[p.lang] || p.lang;
                    const formattedDate = p.lastPracticed.toLocaleString();

                    const practiceHTML = `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title fw-bold">"${p.sentence}"</h5>
                            <p class="card-text mb-1">
                                <span class="badge bg-primary me-2">${langName}</span>
                                <span class="badge bg-info">Practiced: <strong>${p.count}</strong> time(s)</span>
                            </p>
                            <p class="card-text"><small class="text-muted">Last practiced: ${formattedDate}</small></p>
                        </div>
                    </div>`;
                    $practicesList.append(practiceHTML);
                });
            }

            const practicesModal = new Modal($('#practicesModal')[0]);
            practicesModal.show();
        };

        request.onerror = (event) => {
            console.error('Error fetching practices:', (event.target as IDBRequest).error);
            $('#practicesList').html('<p class="text-center text-danger">Could not load practices.</p>');
        };
    }
}