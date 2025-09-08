// This file extends the String prototype with a new method.
// It should be imported once at the application's entry point for its side effect.

/**
 * A simple hash function to generate a unique ID from a string.
 * This is added as a method to the String prototype.
 */
String.prototype.hashCode = function(): string {
    let hash = 0, i: number, chr: number;
    // Return a default hash for empty strings
    if (this.length === 0) return 'h0';
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        // Convert to a 32-bit integer
        hash |= 0;
    }
    // Return a unique string with a prefix to avoid conflicts
    return 'h' + Math.abs(hash);
};

// This export statement makes the file a module, preventing it from polluting the global scope.
export {};