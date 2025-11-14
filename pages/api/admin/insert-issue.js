// pages/api/admin/insert-issue.js
// Debugging version — safe to run locally. Does NOT print secret values.
import { supabaseServer } from '../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1) sanity flags about env & client
    const envInfo = {
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_public_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      node_env: process.env.NODE_ENV ?? null,
      dev_allow_admin: process.env.DEV_ALLOW_ADMIN ?? null,
    };

    // 2) quick check: ensure supabaseServer exists and has an insert method
    let clientOk = false;
    try {
      clientOk = typeof supabaseServer?.from === 'function';
    } catch (e) {
      clientOk = false;
    }

    // 3) Attempt a test insert using the server client (small, with a distinctive title)
    // We'll insert into 'issues' a test row; it won't stop real rows from being inserted later.
    const debugTitle = `debug-insert-${Date.now()}`;
    const insertPayload = {
      title: debugTitle,
      pdf_path: 'https://example.com/debug.pdf',
      published_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer.from('issues').insert(insertPayload).select().single();

    // 4) Return everything helpful (no secrets)
    return res.status(200).json({
      ok: true,
      envInfo,
      clientOk,
      attempted: insertPayload,
      result: {
        data: data ?? null,
        error: error ? { message: error.message, details: error.details, hint: error.hint, code: error.code, status: error.status } : null
      }
    });
  } catch (err) {
    console.error('Unexpected handler error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
