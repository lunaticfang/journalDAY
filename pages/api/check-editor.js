// pages/api/check-editor.js
import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  const DEV_ALLOW_ADMIN = process.env.DEV_ALLOW_ADMIN === 'true';
  if (DEV_ALLOW_ADMIN && process.env.NODE_ENV !== 'production') {
    return res.status(200).json({ isEditor: true, devOverride: true });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '') || null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: userData, error: userErr } = await supabaseServer.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });

    const userId = userData.user.id;
    const { data: profile, error } = await supabaseServer
      .from('profiles')
      .select('is_editor')
      .eq('id', userId)
      .single();

    if (error) return res.status(200).json({ isEditor: false });
    return res.status(200).json({ isEditor: Boolean(profile.is_editor) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
