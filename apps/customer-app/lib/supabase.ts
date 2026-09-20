import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  storeSlug?: string;
  primaryColor?: string;
  secondaryColor?: string;
} | undefined;

export const STORE_SLUG = extra?.storeSlug || "quentinha-expres";
export const PRIMARY_COLOR = extra?.primaryColor || "#ea580c";
export const SECONDARY_COLOR = extra?.secondaryColor || "#fff7ed";

const supabaseUrl = extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.");
}

function isPublishableSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isPublishableSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createSupabaseFetch(supabaseAnonKey),
  },
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
