export default async function handler(req, res) {
  // ✅ CORS beállítások
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Preflight (OPTIONS) kérés kezelése
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ✅ Csak POST engedélyezett
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    // ✅ Shopify Storefront API hívás
    const response = await fetch(`https://${process.env.SHOPIFY_DOMAIN}/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN,
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

    const data = await response.json();

    // ✅ Shopify válasz elemzése
    const errors = data?.data?.customerRecover?.userErrors;

    if (errors && errors.length > 0) {
      console.warn("Shopify user error:", errors);
      return res.status(400).json({ success: false, message: errors[0].message });
    }

    console.log("✅ Password recovery email sent to:", email);
    return res.status(200).json({ success: true, message: "Password recovery email sent" });

  } catch (error) {
    console.error("❌ Recover error:", error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
