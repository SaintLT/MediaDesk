// MediaDesk — public-signup Edge Function.
// Public self-registration is limited to @allsaintsnairobi.org addresses.
// The server always creates the profile as normal_user; the client cannot choose a role.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_DOMAIN = "@allsaintsnairobi.org";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REDIRECT = "https://media-desk-five.vercel.app/login";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const departmentId = String(body.department_id ?? "");
  const password = String(body.password ?? "");

  if (fullName.length < 2 || fullName.length > 120) return fail("Enter your full name (2–120 characters).");
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
  if (!email.endsWith(ALLOWED_DOMAIN)) return fail(`Registration is only available to ${ALLOWED_DOMAIN} email addresses.`, 403);
  if (!UUID_RE.test(departmentId)) return fail("Choose a valid department.");
  if (password.length < 10) return fail("Your password must be at least 10 characters.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: department, error: departmentError } = await admin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (departmentError) return fail("Could not validate the selected department.", 500);
  if (!department) return fail("Choose an active department.");

  // Use the public Auth signup endpoint so Supabase sends its normal verification email.
  const publicAuth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signup, error: signupError } = await publicAuth.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: EMAIL_REDIRECT,
      data: { full_name: fullName },
    },
  });

  if (signupError || !signup.user) {
    const message = signupError?.message ?? "Could not start registration.";
    const taken = /already|registered|exists/i.test(message);
    return fail(taken ? "An account with this email already exists. Try signing in or contact an administrator." : message, taken ? 409 : 400);
  }

  // Supabase returns no identities for an already-registered address to reduce account enumeration.
  if (signup.user.identities && signup.user.identities.length === 0) {
    return fail("An account with this email already exists. Try signing in or contact an administrator.", 409);
  }

  // A returned session means email confirmations are disabled. Do not allow public accounts
  // to become usable without verification; remove this newly-created account and report setup issue.
  if (signup.session) {
    await admin.auth.admin.deleteUser(signup.user.id);
    return fail("Email verification is not enabled for this project. Please contact the system administrator.", 503);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: signup.user.id,
    full_name: fullName,
    email,
    department_id: departmentId,
    role: "normal_user",
    is_active: true,
  });

  if (profileError) {
    // Clean up only the Auth user created by this request; never leave an orphan login.
    await admin.auth.admin.deleteUser(signup.user.id);
    return fail("Could not save your account profile. Please try again or contact an administrator.", 500);
  }

  return json({ ok: true, message: "Account created. Check your email to verify your address." });
});
