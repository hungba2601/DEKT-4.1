import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // QUAN TRỌNG: Định nghĩa process.env là object rỗng để tránh lỗi "process is not defined"
    // gây trắng trang khi deploy lên Vercel/Netlify.
    'process.env': {},
  },
});