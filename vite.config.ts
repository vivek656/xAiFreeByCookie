import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/v1': {
          target: 'https://console.x.ai',
          changeOrigin: true,
          secure: false,
          onProxyReq: (proxyReq) => {
            // Remove headers that reveal this is a proxied/browser request
            proxyReq.removeHeader('x-forwarded-for');
            proxyReq.removeHeader('x-forwarded-proto');
            proxyReq.removeHeader('x-forwarded-host');
            proxyReq.removeHeader('Sec-Fetch-Dest');
            proxyReq.removeHeader('Sec-Fetch-Mode');
            proxyReq.removeHeader('Sec-Fetch-Site');
            
            // Set all headers exactly as they appear in the working curl
            proxyReq.setHeader('Origin', 'https://console.x.ai');
            proxyReq.setHeader('Referer', 'http://localhost:5173/');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0');
            proxyReq.setHeader('sec-ch-ua', '"Chromium";v="146", "Not-A.Brand";v="24", "Microsoft Edge";v="146"');
            proxyReq.setHeader('sec-ch-ua-mobile', '?0');
            proxyReq.setHeader('sec-ch-ua-platform', '"Windows"');
            proxyReq.setHeader('Cookie', env.VITE_XAI_COOKIE || '');
            proxyReq.setHeader('baggage', env.VITE_XAI_BAGGAGE || '');
            proxyReq.setHeader('accept', '*/*');
            proxyReq.setHeader('accept-language', 'en-US,en;q=0.9,hi;q=0.8');
          }
        }
      }
    }
  };
})
