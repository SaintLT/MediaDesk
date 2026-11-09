// MediaDesk — admin-users Edge Function.
// The ONLY place the service-role key is used. It runs on Supabase's servers (never in the browser) and
// refuses everyone except active administrators. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase; nothing to configure.
//
// POST { action: "create_user", email, full_name, department_id, role, password }
// POST { action: "set_active", user_id, is_active }
// POST { action: "reset_password", user_id, password }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ROLES = ["administrator", "normal_user"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // access is controlled by the bearer token, not by origin
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

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Who is calling? Verify the caller's JWT with Supabase Auth.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return fail("Not signed in.", 401);
  const caller = userData.user;

  // 2. Are they an active administrator? (Checked in the database, not trusted from the client.)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: me } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", caller.id)
    .maybeSingle();
  if (!me || !me.is_active || me.role !== "administrator") {
    return fail("Only administrators can manage accounts.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.");
  }

  switch (body.action) {
    case "create_user": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const departmentId = String(body.department_id ?? "");
      const role = String(body.role ?? "");
      const password = String(body.password ?? "");

      if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
      if (!fullName) return fail("Enter the person's full name.");
      if (!UUID_RE.test(departmentId)) return fail("Choose a department.");
      if (!ROLES.includes(role)) return fail("Choose a valid role.");
      if (password.length < 10) return fail("The temporary password must be at least 10 characters.");

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        const taken = createError?.message?.toLowerCase().includes("already");
        return fail(taken ? "An account with this email already exists." : (createError?.message ?? "Could not create the account."));
      }

      const { error: profileError } = await admin.from("profiles").insert({
        id: created.user.id,
        full_name: fullName,
        email,
        department_id: departmentId,
        role,
        is_active: true,
      });
      if (profileError) {
        // Do not leave a login without a profile behind.
        await admin.auth.admin.deleteUser(created.user.id);
        return fail("Could not save the profile: " + profileError.message);
      }
      return json({ ok: true, user_id: created.user.id });
    }

    case "set_active": {
      const userId = String(body.user_id ?? "");
      const isActive = body.is_active === true;
      if (!UUID_RE.test(userId)) return fail("Invalid user.");
      if (userId === caller.id && !isActive) return fail("You cannot deactivate your own account.");

      const { error: profileError } = await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
      if (profileError) return fail(profileError.message);

      // Also block new sign-ins at the Auth level. Existing sessions are already cut off by RLS.
      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: isActive ? "none" : "876000h",
      });
      if (banError) return fail(banError.message);
      return json({ ok: true });
    }

    case "reset_password": {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (!UUID_RE.test(userId)) return fail("Invalid user.");
      if (password.length < 10) return fail("The password must be at least 10 characters.");
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return fail(error.message);
      return json({ ok: true });
    }

    default:
      return fail("Unknown action.");
  }
});
