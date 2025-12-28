// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

// Uses the Service Role key (server-side only) for admin API routes.
// IMPORTANT: Do NOT put the service role key in NEXT_PUBLIC_ vars.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceRoleKey) {
  throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export default supabaseAdmin;
