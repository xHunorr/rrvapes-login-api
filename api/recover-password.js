// /api/recover-password.js

export default async function handler(req, res) {
  // --- CORS ---
  // Ha több domained van (www. is), add hozzá mindkettőt vagy használj * ideiglenesen tesztre
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const storeDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07';
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    if (!storeDomain || !token) {
      return res.status(500).json({ success: false, message: 'Missing Shopify env vars' });
    }

    const endpoint = `https://${storeDomain}/api/${apiVersion}/graphql.json`;

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

    const text = await response.text();
    console.log('🧾 Shopify HTTP:', response.status);
    console.log('🧾 Shopify raw:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, message: 'Bad JSON from Shopify' });
    }

    // 1) TOP-LEVEL GraphQL errors (pl. "Not Found") → ez volt a piros hiba
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || 'Shopify error';
      return res.status(400).json({ success: false, message: msg });
    }

    // 2) userErrors a mutáció alatt
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0]?.message || 'User error' });
    }

    // Ha idáig eljutottunk: Shopify elfogadta a kérést.
    // (Biztonsági okból akkor is sikerrel tér vissza, ha az email nem létezik.)
    return res.status(200).json({ success: true, message: 'Password recovery email sent' });

  } catch (err) {
    console.error('❌ Recover error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
