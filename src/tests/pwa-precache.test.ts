import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const config = fs.readFileSync(path.resolve(__dirname, '../../vite.config.ts'), 'utf8');

describe('PWA precache', () => {
    it('precaches the icon font, not only scripts and styles', () => {
        const m = /globPatterns:\s*\['\*\*\/\*\.\{([^}]*)\}'\]/.exec(config);
        expect(m).not.toBeNull();
        const exts = m![1].split(',');
        expect(exts).toEqual(expect.arrayContaining(['js', 'css', 'woff2']));
    });
});
