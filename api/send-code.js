import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ ideiglenes tárolás (később Redisre cseréljük)
const codes = new Map();

export { codes };

export default async function handler(req, res) {

  // ✅ CORS – EZ LEGELSŐ!
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  codes.set(email, {
    code,
    expires: Date.now() + 10 * 60 * 1000
  });

  try {
    await resend.emails.send({
      from: "RR Vapes <no-reply@rrvapes.com>",
      to: email,
      subject: "Jelszó visszaállítási kód",
      html: `
        <div style="font-family:Arial;text-align:center;padding:30px">
          <h2>Jelszó visszaállítási kód</h2>
          <div style="font-size:32px;font-weight:bold;letter-spacing:6px">
            ${code}
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Email send failed' });
  }
}
