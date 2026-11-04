import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Only the public "anon" key ever reaches the browser. What each person can read or change is decided by
// Row Level Security in the database, not by this client.
export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true },
});
