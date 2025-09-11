/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
const getBuildDate = () => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}${minutes}`;
};

export default defineConfig({
    base: '/EchoTalk/',
    root: 'src',
    publicDir: '../public',
    define: {
        '__APP_BUILD_DATE__': JSON.stringify(getBuildDate())
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',

            manifest: {
                name: 'EchoTalk',
                short_name: 'EchoTalk',
                description: 'An offline browser-based language training app using Shadowing technique with sentence segmentation, audio recording, and user review features.',
                start_url: '.',
                display: 'standalone',
                background_color: '#212529',
                theme_color: '#43b6fd',
                lang: 'en',
                scope: './'
            },

            workbox: {
                globPatterns: ['**/*.{js,css,mp3,png,json,ico,html,webmanifest}'],
                runtimeCaching: [
                    {
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