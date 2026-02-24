import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 깃허브 저장소 이름과 일치해야 합니다.
  base: "/color-risk-lab/", 
  build: {
    // 빌드 결과물이 나올 폴더명을 dist로 고정합니다.
    outDir: 'dist',
    // 자바스크립트/CSS 파일이 엉키지 않게 assets 폴더에 모읍니다.
    assetsDir: 'assets',
  }
})
