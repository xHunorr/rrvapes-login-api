const { Resend } = require('resend');

// Itt használjuk a Vercel env változót
const resend = new Resend(process.env.RESEND_API_KEY);

// Egyelőre csak teszt kedvéért generálunk kódot, de NEM tároljuk.
// (A tárolást külön megbeszéljük, mert serverlessben ez trükkösebb.)
module.exports = async (req, res) => {
  // CORS headerek – hogy a https://rrvapes.com-ról jövő kérés menjen
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Csak POST-ot engedünk
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Body beolvasása – Vercel néha stringként, néha objektumként adja
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const email = (body.email || '').trim();
  const locale = (body.locale || 'hu').toLowerCase();

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  // 6 jegyű kód
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Nyelvfüggő szövegek
  let subject;
  let title;
  let text;
  let expiresText;

  switch (locale) {
    case 'en':
      subject = 'Password reset code';
      title = 'Password reset code';
      text = 'Use the security code below to reset your password:';
      expiresText = 'This code is valid for a limited time.';
      break;
    case 'sk':
      subject = 'Kód na obnovenie hesla';
      title = 'Kód na obnovenie hesla';
      text = 'Použite nasledujúci bezpečnostný kód na obnovenie hesla:';
      expiresText = 'Tento kód je platný iba obmedzený čas.';
      break;
    default:
      subject = 'Jelszó visszaállítási kód';
      title = 'Jelszó visszaállítási kód';
      text = 'Használd az alábbi biztonsági kódot a jelszó visszaállításához:';
      expiresText = 'Ez a kód csak korlátozott ideig érvényes.';
      break;
  }

  try {
    await resend.emails.send({
      // FIGYELEM: amíg nem verifikáltad a saját domaint Resend-ben,
      // HASZNÁLD EZT:
      from: 'onboarding@resend.dev',
      // ha már be van állítva a domain, akkor mehet:
      // from: 'RR Vapes <no-reply@rrvapes.com>',
      to: email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;text-align:center;padding:30px;background:#f7f8fa;">
          <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 24px;">
            <h2 style="margin:0 0 16px 0;font-size:24px;color:#111;">${title}</h2>
            <p style="margin:0 0 24px 0;font-size:15px;color:#444;">${text}</p>
            <div style="
              display:inline-block;
              padding:14px 26px;
              margin-bottom:20px;
              border-radius:999px;
              background:#111;
              color:#fff;
              font-size:26px;
              letter-spacing:8px;
              font-weight:700;
              ">
              ${code}
            </div>
            <p style="margin:0;font-size:13px;color:#777;">${expiresText}</p>
          </div>
        </div>
      `
    });

    // Itt most csak visszadobjuk a kódot FELEJTSD EL ÉLESBEN,
    // kizárólag debugra jó (ha látod a response-ban, hogy pl. { success: true, code: "123456" })
    return res.status(200).json({ success: true, code });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Email send failed' });
  }
};
