import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

describe('index.html structure', () => {
    it('has balanced div and anchor tags (a merge once dropped closing tags)', () => {
        expect((html.match(/<div\b/g) || []).length).toBe((html.match(/<\/div>/g) || []).length);
        expect((html.match(/<a\b/g) || []).length).toBe((html.match(/<\/a>/g) || []).length);
        expect((html.match(/<button\b/g) || []).length).toBe((html.match(/<\/button>/g) || []).length);
    });

    it('has unique element ids', () => {
        const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g)).map(m => m[1]);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes).toEqual([]);
    });
});
