// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  // 이 아랫줄을 추가해서, 모든 파일 경로를 상대 경로로 지정해줍니다.
  // Lovable AI와 같은 복잡한 환경에서 파일이 길을 잃지 않게 해주는 가장 중요한 설정입니다!
  base: "./", 
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
