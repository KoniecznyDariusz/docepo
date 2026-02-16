import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.docentus.docepo',
  appName: 'DocEpo',
  webDir: 'dist/docepo-front/browser',
  server: {
    url: "http://192.168.0.112:3000",
    cleartext: true
  }
};

export default config;
