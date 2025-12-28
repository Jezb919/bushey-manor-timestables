import { createClient } from "@supabase/supabase-js";

// Works on Vercel + locally
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  // eslint-disable-next-line no-console
  console.error("Missing Supabase URL env var (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)");
}

if (!SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error("Missing Supabase Service Role env var (SUPABASE_SERVICE_ROLE_KEY)");
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Also export default (so BOTH import styles work)
export default supabaseAdmin;
