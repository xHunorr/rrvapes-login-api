import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ FONTOS: Map nem jó Vercelen – globálisan elveszik cold startnál
// De most működjön stabilan
export const codes = global.codes || new Map();
global.codes = codes;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Teszteléshez: GET-et ne dobjon 500-at
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: "API is alive" });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;

  // Ha Vercel nem parse-olta
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { email, locale } = body || {};

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  codes.set(email, {
    code,
    expires: Date.now() + 10 * 60 * 1000
  });

  let subject = 'Password reset code';
  let title = 'Password reset code';
  let text = 'Use the code below:';

  if (locale === 'hu') {
    subject = 'Jelszó visszaállító kód';
    title = 'Jelszó visszaállító kód';
    text = 'Használd az alábbi kódot:';
  } else if (locale === 'sk') {
    subject = 'Kód na obnovenie hesla';
    title = 'Kód na obnovenie hesla';
    text = 'Použi nasledujúci kód:';
  }

  try {
    await resend.emails.send({
      from: 'RR Vapes <no-reply@rrvapes.com>',
      to: email,
      subject,
      html: `
        <div style="font-family: Arial; text-align: center; padding: 30px;">
          <h2>${title}</h2>
          <p>${text}</p>
          <div style="font-size: 32px; letter-spacing: 6px; font-weight: bold; margin: 20px 0;">
            ${code}
          </div>
          <p>10 percig érvényes.</p>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('RESEND ERROR:', err);
    return res.status(500).json({ error: 'Email send failed' });
  }
}
