import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { email, locale } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    let subject = 'Password reset code';
    let text = 'Use this code:';

    if (locale === 'hu') {
      subject = 'Jelszó visszaállító kód';
      text = 'Használd ezt a kódot:';
    }

    if (locale === 'sk') {
      subject = 'Kód na obnovu hesla';
      text = 'Použi tento kód:';
    }

    await resend.emails.send({
      from: 'RR Vapes <no-reply@rrvapes.com>',
      to: email,
      subject,
      html: `<h2>${text}</h2><div style="font-size:40px">${code}</div>`
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('ERROR:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
