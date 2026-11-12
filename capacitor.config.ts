import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.voka",
  appName: "Voka",
  webDir: "dist",
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: { launchAutoHide: true }
  }
};

export default config;
