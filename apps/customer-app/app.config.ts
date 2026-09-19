import type { ExpoConfig } from "expo/config";

const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || "QUENTINHA EXPRES";
const STORE_SLUG = process.env.EXPO_PUBLIC_STORE_SLUG || "quentinha-expres";
const PRIMARY_COLOR = process.env.EXPO_PUBLIC_PRIMARY_COLOR || "#ea580c";
const SECONDARY_COLOR = process.env.EXPO_PUBLIC_SECONDARY_COLOR || "#fff7ed";
const PACKAGE_NAME = process.env.EXPO_PUBLIC_PACKAGE_NAME || "com.quentinhaexpres.app";

const config: ExpoConfig = {
  expo: {
    name: APP_NAME,
    slug: STORE_SLUG,
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: { resizeMode: "contain", backgroundColor: PRIMARY_COLOR },
    ios: { supportsTablet: false, bundleIdentifier: PACKAGE_NAME },
    android: {
      package: PACKAGE_NAME,
      adaptiveIcon: { backgroundColor: PRIMARY_COLOR },
    },
    plugins: ["expo-router"],
    extra: {
      storeSlug: STORE_SLUG,
      primaryColor: PRIMARY_COLOR,
      secondaryColor: SECONDARY_COLOR,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};

export default config;
