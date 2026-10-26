import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 프로젝트가 OneDrive 폴더 안에 있어서 파일 변경 알림이 가끔 누락된다 → 옛 코드를 계속 서빙.
    // 폴링으로 직접 확인하게 한다. OneDrive 밖으로 옮기면 지워도 된다.
    watch: { usePolling: true, interval: 300 },
  },
})
