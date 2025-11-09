export default async function handler(req, res) {
  // --- CORS ---
  const allowedOrigins = [
    'https://rrvapes.com',
    'https://www.rrvapes.com',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // ha nem ismert az origin, inkább ne engedjük
    res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  }
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

  // --- kötelező env-k ellenőrzése ---
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07';
  const storefrontDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
  const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;

  if (!storefrontDomain || !storefrontToken) {
    console.error('Missing Storefront envs', { storefrontDomain: !!storefrontDomain, storefrontToken: !!storefrontToken });
    return res.status(500).json({ success: false, message: 'Server misconfiguration' });
  }

  const endpoint = `https://${storefrontDomain}/api/${apiVersion}/graphql.json`;

  try {
    console.log('🔍 Recover for:', email);
    console.log('🔗 Endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontToken,
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
    console.log('🧾 Shopify raw:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ success: false, message: 'Bad response from Shopify' });
    }

    // 1) top-level GraphQL errors (ilyenkor jött a „Not Found”)
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || 'Shopify error';
      return res.status(400).json({ success: false, message: msg });
    }

    // 2) mutation userErrors
    const userErrors = data?.data?.customerRecover?.userErrors;
    if (Array.isArray(userErrors) && userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0]?.message || 'Request error' });
    }

    // 3) minden oké – fontos: Shopify akkor is "sikerrel" tér vissza, ha az email nem létezik
    return res.status(200).json({ success: true, message: 'Password recovery email sent' });

  } catch (err) {
    console.error('❌ Recover error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
