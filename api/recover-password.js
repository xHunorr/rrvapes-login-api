// /api/recover-password.js
export default async function handler(req, res) {
  // --- CORS (engedjük a www-t is) ---
  const origin = req.headers.origin || "";
  const allowed = ["https://rrvapes.com", "https://www.rrvapes.com"];
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // fejlesztésnél kommenteld ki, ha kell
    res.setHeader("Access-Control-Allow-Origin", allowed[0]);
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
  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const storeDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // <-- pl. kmkqnw-ev.myshopify.com
    const version = process.env.SHOPIFY_API_VERSION || "2024-07";
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    if (!storeDomain || !token) {
      return res.status(500).json({ success: false, message: "Shop config missing" });
    }

    const endpoint = `https://${storeDomain}/api/${version}/graphql.json`;

    const gql = `
      mutation customerRecover($email: String!) {
        customerRecover(email: $email) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: gql, variables: { email: email.trim() } }),
    });

    const raw = await response.text();
    console.log("🧾 Shopify raw:", raw);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({ success: false, message: "Bad JSON from Shopify" });
    }

    // 1) top-level GraphQL hibák (pl. NOT_FOUND a rossz domain/token miatt)
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || "Shopify error";
      return res.status(400).json({ success: false, message: msg });
    }

    // 2) userErrors a mutációból
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0].message || "Recover error" });
    }

    // Ha idáig eljutottunk, a Shopify elindította a reset folyamatot.
    return res.status(200).json({ success: true, message: "Password recovery email sent" });
  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
