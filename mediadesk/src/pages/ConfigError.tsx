export default function ConfigError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-lg rounded-2xl border border-charcoal-700 bg-charcoal-900 p-8">
        <h1 className="text-xl font-semibold">MediaDesk is not configured</h1>
        <p className="mt-2 text-sm leading-relaxed text-fog-300">
          The Supabase connection settings are missing. Copy <code className="text-fog-100">.env.example</code> to{" "}
          <code className="text-fog-100">.env.local</code>, fill in <code className="text-fog-100">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-fog-100">VITE_SUPABASE_ANON_KEY</code>, then restart <code className="text-fog-100">npm run dev</code>.
          On Vercel, add the same two variables under Settings, Environment Variables, then redeploy.
        </p>
      </div>
    </main>
  );
}
