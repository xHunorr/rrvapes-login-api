import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// memória storage
export const codes = new Map();

export default async function handler(req, res) {
  // ✅ CORS – MINDEN kérésre
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ PRELIGHT KÉRÉS KEZELÉS
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, locale } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // ✅ kód generálás
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    codes.set(email, {
      code,
      expires: Date.now() + 10 * 60 * 1000
    });

    // nyelvi szövegek
    let subject = 'Password reset code';
    let title = 'Password reset code';
    let text = 'Use the code below:';
    let footer = 'This code is valid for 10 minutes.';

    if (locale === 'hu') {
      subject = 'Jelszó visszaállító kód';
      title = 'Jelszó visszaállító kód';
      text = 'Használd az alábbi biztonsági kódot:';
      footer = 'A kód 10 percig érvényes.';
    }

    if (locale === 'sk') {
      subject = 'Kód na obnovenie hesla';
      title = 'Kód na obnovenie hesla';
      text = 'Použi nasledujúci bezpečnostný kód:';
      footer = 'Tento kód je platný 10 minút.';
    }

    // ✅ EMAIL KÜLDÉS
    await resend.emails.send({
      from: 'RR Vapes <no-reply@rrvapes.com>',
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; background:#f7f8fa; padding:40px; text-align:center;">
          <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;">
            <img src="https://rrvapes.com/cdn/shop/files/rr-logo.png" width="120" style="margin-bottom:20px;" />

            <h2 style="margin-bottom:10px;">${title}</h2>
            <p style="color:#666;margin-bottom:20px;">${text}</p>

            <div style="font-size:32px;letter-spacing:6px;font-weight:bold;margin:20px 0;">
              ${code}
            </div>

            <p style="color:#999;font-size:13px;">${footer}</p>
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('SEND ERROR:', err);
    return res.status(500).json({ error: 'Email send failed' });
  }
}
