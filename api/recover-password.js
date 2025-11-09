export default async function handler(req, res) {
  // --- CORS (rrvapes.com és www.rrvapes.com engedve) ---
  const allowedOrigins = ['https://rrvapes.com', 'https://www.rrvapes.com'];
  const origin = req.headers.origin;
  res.setHeader(
    'Access-Control-Allow-Origin',
    allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    // fontos: STORE**FRONT** endpoint + STORE**FRONT** token!
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07';
    const domain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    if (!domain || !token) {
      return res.status(500).json({ success: false, message: 'Missing Shopify Storefront config' });
    }

    const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

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
    console.log('🧾 Shopify HTTP status:', response.status);
    console.log('🧾 Shopify response raw:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ success: false, message: 'Bad JSON from Shopify' });
    }

    // top-level GraphQL hibák (pl. NOT_FOUND domain/token gondnál)
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || 'Shopify error';
      return res.status(400).json({ success: false, message: msg });
    }

    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0].message });
    }

    // Shopify szándékosan nem árulja el, hogy létezett-e az email – siker akkor is „ok”
    return res.status(200).json({ success: true, message: 'Password recovery email sent' });
  } catch (err) {
    console.error('❌ Recover error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
