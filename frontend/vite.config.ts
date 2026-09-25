import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins: [react(), VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', registerType: 'prompt', injectRegister: false, manifest: { name: 'うつす — 家族の毎日を、そっと。', short_name: 'うつす', lang: 'ja', description: '写真と生活の反応で、離れた家族をつなぐ。', theme_color: '#fefefd', background_color: '#fefefd', display: 'standalone', start_url: '/', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] } })] });
