import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.docentus.docepo',
  appName: 'DocEpo',
  webDir: 'dist/docepo/browser',
  plugins: {
    App: {
      urlScheme: 'pl.docentus.docepo'
    }
  },
  server: {
    // Dla deep linking OAuth callback
    androidScheme: 'https'
  }
};

export default config;
