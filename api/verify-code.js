import { codes } from './send-code';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  const saved = codes.get(email);

  if (!saved) {
    return res.status(400).json({ success: false, message: 'Nincs aktív kód' });
  }

  if (Date.now() > saved.expires) {
    codes.delete(email);
    return res.status(400).json({ success: false, message: 'Lejárt kód' });
  }

  if (saved.code !== code) {
    return res.status(400).json({ success: false, message: 'Hibás kód' });
  }

  // ha jó, töröljük
  codes.delete(email);

  return res.status(200).json({ success: true });
}
