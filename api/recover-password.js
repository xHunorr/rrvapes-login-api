export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://rrvapes.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    console.log("🔍 Incoming email:", email);

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
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
      }
    );

    const text = await response.text();
    console.log("🧾 Shopify raw response:", text);

    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ success: false, message: "Shopify returned invalid JSON" });
    }

    // ❗ Ha a Shopify top-level hibát dob (pl. Not Found)
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: data.errors[0].message || "Shopify error"
      });
    }

    const userErrors = data?.data?.customerRecover?.userErrors;
    if (Array.isArray(userErrors) && userErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: userErrors[0].message
      });
    }

    // ✅ Ha idáig eljutott → Shopify ELFOGADTA a kérést és elküldi az emailt
    return res.status(200).json({ success: true, message: "Password recovery email sent" });

  } catch (error) {
    console.error("❌ Recover error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
