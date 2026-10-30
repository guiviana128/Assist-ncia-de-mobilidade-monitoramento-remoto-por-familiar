import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// O painel chama a API em /api/v1 e o Vite repassa para o backend (porta 8080).
// Assim o mesmo endereço funciona no PC e no celular, inclusive em HTTPS (necessário para o AR).
const backend = process.env.AMPARO_BACKEND_URL ?? 'http://localhost:8080';
const proxy: Record<string, ProxyOptions> = {
  '/api': {
    target: backend,
    changeOrigin: true,
    // Para o navegador a chamada é da mesma origem; sem o cabeçalho Origin o CORS do backend não interfere.
    configure: p => p.on('proxyReq', req => req.removeHeader('origin'))
  }
};

// `npm run dev`       -> http://localhost:3000
// `npm run dev:https` -> https://<ip-do-pc>:3000 (abra no Chrome do Android para usar o AR)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'https' ? [react(), basicSsl()] : [react()],
  server: { port: 3000, host: true, proxy },
  preview: { port: 3000, host: true, proxy }
}));
