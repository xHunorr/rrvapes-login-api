export default async function handler(req, res) {
  // --- CORS (rrvapes.com és www.rrvapes.com engedélyezve) ---
  const origin = req.headers.origin;
  const allowed = new Set(["https://rrvapes.com", "https://www.rrvapes.com"]);
  if (allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  try {
    // --- Storefront API endpoint + token (NEM az Admin!) ---
    const version = process.env.SHOPIFY_API_VERSION || "2024-07";
    const endpoint = `https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/${version}/graphql.json`;
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    console.log("🔍 Recover for:", email);
    console.log("🔍 Hitting:", endpoint);
    console.log("🔍 Has Storefront token:", Boolean(token));

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

    const text = await response.text();
    console.log("🧾 Shopify HTTP status:", response.status);
    console.log("🧾 Shopify response raw:", text);

    // Ha a válasz nem ok, adjuk vissza hibaüzenettel
    if (!response.ok) {
      let parsed;
      try { parsed = JSON.parse(text); } catch {}
      const topMsg = parsed?.errors?.[0]?.message || `HTTP ${response.status}`;
      return res.status(400).json({ success: false, message: topMsg });
    }

    let data;
    try { data = JSON.parse(text); } catch (e) {
      return res.status(502).json({ success: false, message: "Bad JSON from Shopify" });
    }

    // Top-level GraphQL hibák kezelése
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || "Shopify error";
      return res.status(400).json({ success: false, message: msg });
    }

    // Mutáció userErrors kezelése
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0].message });
    }

    // Ha idáig eljutottunk, a Shopify elindította az e-mailt (vagy
    // szándékosan nem árulja el, hogy létezik-e a cím) – ezt sikernek vesszük.
    return res.status(200).json({ success: true, message: "Password recovery email sent" });
  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
