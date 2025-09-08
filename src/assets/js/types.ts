// Define the structure for a recording object
export interface Recording {
    sentence: string;
    audio: Blob;
    timestamp: Date;
    lang: string;
}

// Define the structure for a practice entry
export interface Practice {
    sentence: string;
    lang: string;
    count: number;
    lastPracticed: Date;
}

// Define the structure for the new sample data
export interface SentenceCategory {
    name: string;
    sentences: string[];
}

export interface SentenceLevel {
    name: string;
    categories: SentenceCategory[];
}

export interface SampleData {
    levels: SentenceLevel[];
}

// Extend global interfaces to add custom properties
declare global {
    interface Window {
        // Stores all recordings grouped by sentence
        modalRecordings: Record<string, Recording[]>;
        // Stores the PWA install prompt event
        deferredPrompt: any;
        // Allows accessing the app instance from the console for debugging
        app: any;
    }
    interface String {
        // A custom method to generate a hash from a string
        hashCode(): string;
    }
}