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
    private lastKnownStreak: number = -1; // Added to track streak changes for animation

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
                    const store =
                        db.createObjectStore('practices', { keyPath: 'sentence' });
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
        } else {
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
                                                    <button class="btn btn-sm btn-success play-bot-audio w-100" data-sentence="${sentence}" data-lang="${rec.lang}">
                                                        <i class="bi bi-robot"></i> Play Bot
                                                    </button>
                                                </div>
                                                <div class="col-6 col-md-auto">
                                                    <button class="btn btn-sm btn-primary play-user-audio w-100" data-sentence="${sentence}" data-index="${index}">
                                                        <i class="bi bi-person-fill"></i> Play Mine
                                                    </button>
                                                </div>
                                                ${rec.lang === 'en-US' && this.app.spellCheckerIsAvailable ?
                    `
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

        const recordingsModal = Modal.getOrCreateInstance($('#recordingsModal')[0]);
        recordingsModal.show();
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
                const groupedByLang: Record<string, Practice[]> = practices.reduce((acc, p) => {
                    (acc[p.lang] = acc[p.lang] || []).push(p);
                    return acc;
                }, {} as Record<string, Practice[]>);
                const languages = Object.keys(groupedByLang);

                if (languages.length > 1) {
                    const accordionId = 'practicesAccordion';
                    let accordionHtml = `<div class="accordion" id="${accordionId}">`;

                    languages.forEach((lang) => {
                        const langName = this.app.languageMap[lang] || lang;
                        const uniqueId = `lang-${lang.replace(/[^a-zA-Z0-9]/g, '')}`;
                        const practicesForLang = groupedByLang[lang];

                        practicesForLang.sort((a, b) => {
                            const lastA = a.practiceHistory && a.practiceHistory.length > 0 ? a.practiceHistory[a.practiceHistory.length - 1].getTime() : 0;
                            const lastB = b.practiceHistory && b.practiceHistory.length > 0 ? b.practiceHistory[b.practiceHistory.length - 1].getTime() : 0;
                            return lastB - lastA;
                        });

                        accordionHtml += `
                            <div class="accordion-item">
                                <h2 class="accordion-header" id="heading-${uniqueId}">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}" aria-expanded="false">
                                        ${langName} Sentences
                                    </button>
                                </h2>
                                <div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                                    <div class="accordion-body">`;
                        practicesForLang.forEach(p => {
                            const lastPracticedDate = p.practiceHistory && p.practiceHistory.length > 0 ? p.practiceHistory[p.practiceHistory.length - 1] : 'Never';
                            const formattedDate = lastPracticedDate !== 'Never' ? lastPracticedDate.toLocaleString() : lastPracticedDate;
                            const truncatedSentence = this.app.utilService.truncateSentence(p.sentence);
                            const sentenceAttr = p.sentence.replace(/"/g, '&quot;');
                            accordionHtml += `
                                <div class="card mb-3">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div class="flex-grow-1 me-3">
                                                <p class="card-title fw-bold mb-1">"${truncatedSentence}"</p>
                                                <p class="card-text mb-1">
                                                    <span class="badge bg-info">Practiced: <strong>${p.count}</strong> time(s)</span>
                                                </p>
                                                <p class="card-text mb-0"><small class="text-muted">Last practiced: ${formattedDate}</small></p>
                                            </div>
                                            <div class="flex-shrink-0">
                                                <button class="btn btn-sm btn-primary practice-this-sentence-btn" data-sentence="${sentenceAttr}" data-lang="${p.lang}" title="Practice this sentence">
                                                    <i class="bi bi-play-circle-fill"></i> <span class="d-none d-sm-inline">Practice</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>`;
                        });

                        accordionHtml += `
                                    </div>
                                </div>
                            </div>`;
                    });

                    accordionHtml += `</div>`;
                    $practicesList.html(accordionHtml);
                } else {
                    practices.sort((a, b) => {
                        const lastA = a.practiceHistory && a.practiceHistory.length > 0 ? a.practiceHistory[a.practiceHistory.length - 1].getTime() : 0;
                        const lastB = b.practiceHistory && b.practiceHistory.length > 0 ? b.practiceHistory[b.practiceHistory.length - 1].getTime() : 0;
                        return lastB - lastA;
                    });
                    practices.forEach(p => {
                        const lastPracticedDate = p.practiceHistory && p.practiceHistory.length > 0 ? p.practiceHistory[p.practiceHistory.length - 1] : 'Never';
                        const formattedDate = lastPracticedDate !== 'Never' ? lastPracticedDate.toLocaleString() : lastPracticedDate;
                        const truncatedSentence = this.app.utilService.truncateSentence(p.sentence);
                        const sentenceAttr = p.sentence.replace(/"/g, '&quot;');
                        const practiceHTML = `
                            <div class="card mb-3">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div class="flex-grow-1 me-3">
                                            <p class="card-title fw-bold mb-1">"${truncatedSentence}"</p>
                                            <p class="card-text mb-1">
                                                <span class="badge bg-info">Practiced: <strong>${p.count}</strong> time(s)</span>
                                            </p>
                                            <p class="card-text mb-0"><small class="text-muted">Last practiced: ${formattedDate}</small></p>
                                        </div>
                                        <div class="flex-shrink-0">
                                            <button class="btn btn-sm btn-primary practice-this-sentence-btn" data-sentence="${sentenceAttr}" data-lang="${p.lang}" title="Practice this sentence">
                                                <i class="bi bi-play-circle-fill"></i> <span class="d-none d-sm-inline">Practice</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                        $practicesList.append(practiceHTML);
                    });
                }
            }

            const practicesModal = Modal.getOrCreateInstance($('#practicesModal')[0]);
            practicesModal.show();
        };

        request.onerror = (event) => {
            console.error('Error fetching practices:', (event.target as IDBRequest).error);
            $('#practicesList').html('<p class="text-center text-danger">Could not load practices.</p>');
        };
    }

    private async _calculateStreak(practices: Practice[]): Promise<number> {
        if (!practices || practices.length === 0) {
            return 0;
        }

        // Combine all practice history dates into a single array
        const allPracticeDates = practices.flatMap(p => p.practiceHistory);

        // Collect all unique practice dates as YYYY-MM-DD strings
        const uniquePracticeDates = new Set(
            allPracticeDates.map(timestamp => {
                const date = new Date(timestamp);
                date.setHours(0, 0, 0, 0);
                return date.toISOString().split('T')[0];
            })
        );

        const sortedDates = Array.from(uniquePracticeDates).sort();

        if (sortedDates.length === 0) {
            return 0;
        }

        let currentStreak = 0;
        let dayToCheck = new Date();
        dayToCheck.setHours(0, 0, 0, 0);

        // Check if the most recent practice was today or yesterday
        const mostRecentPracticeDateStr = sortedDates[sortedDates.length - 1];
        const mostRecentPracticeDate = new Date(mostRecentPracticeDateStr);

        const todayStr = dayToCheck.toISOString().split('T')[0];
        const yesterday = new Date(dayToCheck);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (mostRecentPracticeDateStr === todayStr || mostRecentPracticeDateStr === yesterdayStr) {
            currentStreak = 1;
            dayToCheck = new Date(mostRecentPracticeDate);
            dayToCheck.setDate(dayToCheck.getDate() - 1);

            let i = sortedDates.length - 2;
            while (i >= 0) {
                const dayToCheckStr = dayToCheck.toISOString().split('T')[0];
                if (sortedDates[i] === dayToCheckStr) {
                    currentStreak++;
                    dayToCheck.setDate(dayToCheck.getDate() - 1);
                    i--;
                } else {
                    break;
                }
            }
        }
        return currentStreak;
    }

    public async populateStreakModal(): Promise<void> {
        if (!this.app.db) return;
        const transaction = this.app.db.transaction(['practices'], 'readonly');
        const store = transaction.objectStore('practices');
        const request = store.getAll();

        request.onerror = (event) => {
            console.error('Error fetching practices for streak modal:', (event.target as IDBRequest).error);
        };

        request.onsuccess = async () => {
            const practices: Practice[] = request.result;
            const totalSentences = practices.length;
            const totalPractices = practices.reduce((sum, p) => sum + p.count, 0);

            const currentStreak = await this._calculateStreak(practices);

            const allPracticeDates = practices.flatMap(p => p.practiceHistory || []);
            const practiceDates = new Set(allPracticeDates.map(timestamp => {
                const date = new Date(timestamp);
                date.setHours(0, 0, 0, 0);
                return date.toISOString().split('T')[0];
            }));

            $('#streakDays').text(currentStreak);
            $('#streakDaysHeader').text(currentStreak);
            $('#streakSentences').text(totalSentences);
            $('#streakPractices').text(totalPractices);

            const isFirstVisit = totalSentences === 0 && totalPractices === 0;
            const myStreakModalLabel = $('#myStreakModalLabel');
            const motivationalTextEl = $('#streak-motivational-text');
            if (isFirstVisit) {
                myStreakModalLabel.text("Welcome!");
                motivationalTextEl.text("Ready to build your streak? Complete your first practice session today!");
            } else {
                myStreakModalLabel.text("Congratulations!");
                const messages = [
                    "You're on a roll! Keep up the amazing work.",
                    "Consistency is key. You're doing great!",
                    "Another day, another step towards mastery.",
                    "Look at you go! Your dedication is paying off."
                ];
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                motivationalTextEl.text(randomMessage);
            }

            const calendarContainer = $('#streakCalendar');
            calendarContainer.empty();
            const todayForCalendar = new Date();
            todayForCalendar.setHours(0, 0, 0, 0);
            const daysToShow = [-2, -1, 0, 1, 2];

            const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

            daysToShow.forEach(offset => {
                const date = new Date(todayForCalendar);
                date.setDate(date.getDate() + offset);
                const dateStr = date.toISOString().split('T')[0];

                let dayLabel;
                if (offset === 0) dayLabel = 'Today';
                else if (offset === -1) dayLabel = 'Yesterday';
                else dayLabel = dayFormatter.format(date);

                let circleClass = '';
                let circleContent = '';

                if (offset === 0) {
                    circleClass = 'today';
                }

                if (practiceDates.has(dateStr)) {
                    circleClass += ' bg-success bi bi-check-lg';
                }

                if (offset === 0 && !practiceDates.has(dateStr)) {
                    circleClass += `bg-warning bi bi-fire`;
                }

                const dayHtml = `
                    <div class="day text-center">
                        <div class="d-inline-flex circle ${circleClass}">${circleContent}</div>
                        <div class="day-label">${dayLabel}</div>
                    </div>
                `;
                calendarContainer.append(dayHtml);
            });
        };
    }

    public async updateStreakCounters(): Promise<void> {
        if (!this.app.db) return;

        try {
            const transaction = this.app.db.transaction(['practices'], 'readonly');
            const store = transaction.objectStore('practices');

            const practices: Practice[] = [];
            const request = store.openCursor();

            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor) {
                        practices.push(cursor.value);
                        cursor.continue();
                    } else {
                        this.processStreakCounterUpdate(practices).then(resolve).catch(reject);
                    }
                };

                request.onerror = (event) => {
                    console.error('Error fetching practices for streak counters:', (event.target as IDBRequest).error);
                    reject((event.target as IDBRequest).error);
                };
            });
        } catch (error) {
            console.error('Error in updateStreakCounters:', error);
        }
    }

    private async processStreakCounterUpdate(practices: Practice[]): Promise<void> {
        const currentStreak = await this._calculateStreak(practices);
        const streakNumberEl = $('.day-streak-number');
        const streakParentEl = streakNumberEl.parent();

        streakNumberEl.text(currentStreak).show();

        if (currentStreak !== this.lastKnownStreak && this.lastKnownStreak !== -1) {
            streakParentEl.addClass('streak-parent-updated');
            setTimeout(() => {
                streakParentEl.removeClass('streak-parent-updated');
            }, 500);
        }

        this.lastKnownStreak = currentStreak;
    }
}