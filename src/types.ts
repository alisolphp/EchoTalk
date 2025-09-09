/** Defines the structure for a single audio recording stored in IndexedDB. */
export interface Recording {
    sentence: string;
    audio: Blob;
    timestamp: Date;
    lang: string;
}

/** Defines the structure for a practice session record stored in IndexedDB. */
export interface Practice {
    sentence: string;
    lang: string;
    count: number;
    lastPracticed: Date;
}

/** Defines the structure for a category of sentences (e.g., "Interview"). */
export interface SentenceCategory {
    name: string;
    sentences: string[];
}

/** Defines the structure for a difficulty level (e.g., "Intermediate"). */
export interface SentenceLevel {
    name: string;
    categories: SentenceCategory[];
}

/** Defines the root structure for the entire sample sentences data file. */
export interface SampleData {
    levels: SentenceLevel[];
}

// Extends global interfaces to add custom properties to the `Window` and `String` objects.
declare global {
    interface Window {
        /** Stores all recordings from the modal, grouped by sentence, for easy access. */
        modalRecordings: Record<string, Recording[]>;
        /** Stores the PWA install prompt event for deferred invocation. */
        deferredPrompt: any;
        /** Exposes the main app instance on the window for debugging purposes. */
        app: any;
    }
    interface String {
        /** A custom method to generate a simple hash code from a string. */
        hashCode(): string;
    }
}