/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: './',
    root: 'src',
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                // Precache all assets, including the main HTML file and the manifest,
                // to ensure the app shell is always available for an offline-first experience.
                globPatterns: ['**/*.{js,css,mp3,png,json,ico,html,webmanifest}'],

                // Define runtime caching rules for specific request types.
                runtimeCaching: [
                    {
                        // The navigation rule is still useful as a fallback or for pages not precached.
                        urlPattern: ({ request }) => request.mode === 'navigate',
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'pages-cache',
                            expiration: {
                                maxEntries: 3,
                                maxAgeSeconds: 86400 // 1 Day
                            },
                        },
                    },
                ],
            }
        })
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
        include: ['./tests/**/*.test.ts'],
    },
});

