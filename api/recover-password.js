export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "";
  const allowed = new Set([
    "https://rrvapes.com",
    "https://www.rrvapes.com",
  ]);
  if (allowed.has(origin)) {
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

  // --- input ---
  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const shopDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-07";
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    // Gyors sanity logok (a token értékét nem logoljuk)
    console.log("🔍 customerRecover for:", email);
    console.log("🔍 Storefront domain:", shopDomain);
    console.log("🔍 API version:", apiVersion);
    console.log("🔍 Has Storefront token:", Boolean(token));

    const endpoint = `https://${shopDomain}/api/${apiVersion}/graphql.json`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
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
    console.log("🧾 Shopify response raw:", raw);

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({ success: false, message: "Invalid response from Shopify" });
    }

    // 1) top-level GraphQL errors
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || "Shopify error";
      return res.status(400).json({ success: false, message: msg });
    }

    // 2) userErrors a mutation alatt
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      const msg = userErrors[0]?.message || "Shopify user error";
      return res.status(400).json({ success: false, message: msg });
    }

    // Ha idáig eljutottunk: a Shopify elfogadta a kérést.
    // Biztonsági okból nem mondja meg, létezik-e a cím — de ha létezik, kimegy az email.
    return res.status(200).json({
      success: true,
      message: "Ha létezik a fiók ehhez az e-mailhez, elküldtük a jelszó-visszaállító levelet.",
    });

  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
