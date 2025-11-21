import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// memóriában tároljuk ideiglenesen
const codes = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  // 6 jegyű kód
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // eltároljuk 10 percre
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
        <div style="font-family:Arial,sans-serif;text-align:center;padding:30px;">
          <h2>Jelszó visszaállítási kód</h2>
          <p>Az alábbi kódot használd:</p>
          <div style="font-size:32px;letter-spacing:6px;font-weight:bold;margin:20px 0;">
            ${code}
          </div>
          <p>Ez a kód 10 percig érvényes.</p>
        </div>
      `
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Email send failed' });
  }
}

// exportáljuk, hogy a következő fájl is lássa
export { codes };
