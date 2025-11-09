export default async function handler(req, res) {
  // --- CORS ---
  const ORIGIN = req.headers.origin || '';
  const ALLOW_ORIGINS = ['https://rrvapes.com', 'https://www.rrvapes.com'];
  if (ALLOW_ORIGINS.includes(ORIGIN)) {
    res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // --- Input ---
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  // --- Config (myshopify + Storefront!) ---
  const domain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07';

  if (!domain || !token) {
    return res.status(500).json({ success: false, message: 'Shopify config missing' });
  }

  const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

  try {
    // --- Hívás a Storefront API-ra ---
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation customerRecover($email: String!) {
            customerRecover(email: $email) {
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: { email },
      }),
    });

    const raw = await response.text();
    console.log('🧾 Shopify raw:', raw);

    // Ha nem JSON, az is hiba
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({ success: false, message: 'Invalid response from Shopify' });
    }

    // TOP-LEVEL GraphQL hibák (pl. "Not Found")
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || 'Shopify error';
      return res.status(400).json({ success: false, message: msg });
    }

    // userErrors a customerRecover alatt
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      const msg = userErrors[0]?.message || 'Unknown error';
      return res.status(400).json({ success: false, message: msg });
    }

    // Itt sikeresnek tekintjük – a Shopify biztonságból akkor is 200-at ad,
    // ha az email nem létezik (nem árulja el).
    return res.status(200).json({ success: true, message: 'Password recovery email sent' });
  } catch (err) {
    console.error('❌ Recover error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
