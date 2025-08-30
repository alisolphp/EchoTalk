/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: 'src', // ریشه برنامه پوشه 'src' است
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,mp3,png,json}'],
            }
        })
    ],
    test: {
        // حالا که پوشه tests داخل src است، مسیرها بسیار ساده هستند
        globals: true,
        environment: 'jsdom',
        // این مسیرها اکنون نسبت به ریشه ('src') سنجیده می‌شوند
        setupFiles: './tests/setup.ts',
        include: ['./tests/**/*.test.ts'],
    },
});