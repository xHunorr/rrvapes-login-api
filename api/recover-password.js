export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "";
  const allowedOrigins = ["https://rrvapes.com", "https://www.rrvapes.com"];
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    // --- ENV-ek ---
    const storeDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-07";
    const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;

    if (!storeDomain || !storefrontToken) {
      return res.status(500).json({
        success: false,
        message: "Shopify Storefront env hiányzik (domain vagy token)."
      });
    }

    const endpoint = `https://${storeDomain}/api/${apiVersion}/graphql.json`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
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
    console.log("🧾 Shopify HTTP status:", response.status);
    console.log("🧾 Shopify response raw:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, message: "Bad JSON from Shopify" });
    }

    // Top-level GraphQL hibák (pl. Not Found)
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || "Shopify error";
      return res.status(400).json({ success: false, message: msg });
    }

    // Mutáció userErrors
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0].message });
    }

    // Siker (Shopify akkor is 200-at adhat, ha nem árulja el, hogy létezik-e az e-mail)
    return res.status(200).json({ success: true, message: "Password recovery email sent" });
  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
