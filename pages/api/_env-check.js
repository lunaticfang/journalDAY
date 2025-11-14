// pages/api/_env-check.js
export default function handler(req, res) {
  res.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    DEV_ALLOW_ADMIN: process.env.DEV_ALLOW_ADMIN ?? null
  });
}
