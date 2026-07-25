import path from 'path'
import { defineConfig } from '@lark-apaas/coding-preset-vite-react'
import type { Plugin } from 'vite'

const staticViewContext = (): Plugin => ({
  name: 'vercel-static-view-context',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const replacements: Record<string, string> = {
        '{{{appAvatar}}}': '/favicon.svg',
        '{{appAvatar}}': '/favicon.svg',
        '{{appName}}': '菌鲜到｜云南野生菌订购登记',
        '{{appDescription}}': '云南野生菌采购登记',
        '{{appId}}': '',
        '{{userId}}': '',
        '{{tenantId}}': '',
        '{{userName}}': '',
        '{{csrfToken}}': '',
        '{{environment}}': 'online',
        '{{basename}}': '/',
      }

      return Object.entries(replacements).reduce(
        (result, [placeholder, value]) => result.replaceAll(placeholder, value),
        html,
      )
    },
  },
})

export default defineConfig({
  plugins: [staticViewContext()],
  css: {
    postcss: {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
    },
  },
})
