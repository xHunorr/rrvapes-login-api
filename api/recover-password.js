export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "https://rrvapes.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  // --- Env sanity check ---
  const domain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. rrvapes.myshopify.com
  const token  = process.env.SHOPIFY_STOREFRONT_TOKEN;   // Storefront API token (NEM shpat_)

  if (!domain || !token) {
    console.error("❌ Missing envs:", { hasDomain: !!domain, hasToken: !!token });
    return res.status(500).json({ success: false, message: "Server misconfigured (envs missing)" });
  }
  if (!/\.myshopify\.com$/i.test(domain)) {
    console.warn("⚠️ Domain does not look like a myshopify.com domain:", domain);
  }
  if (token.startsWith("shpat_")) {
    console.warn("⚠️ You are using an Admin API token for a Storefront request. This will fail.");
  }

  // --- Input ---
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    // nagyon alap email check, a kliens oldali regex mellé
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }

    // --- Storefront API hívás ---
    const endpoint = `https://${domain}/api/2024-07/graphql.json`;
    const graphql = {
      query: `
        mutation customerRecover($email: String!) {
          customerRecover(email: $email) {
            userErrors { field message }
          }
        }
      `,
      variables: { email }
    };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token
      },
      body: JSON.stringify(graphql)
    });

    const raw = await resp.text();
    console.log("🧾 Shopify response raw:", raw);

    // lehet, hogy 200, de GraphQL errors mező van benne
    let json;
    try { json = JSON.parse(raw); } catch (e) {
      console.error("❌ JSON parse error:", e);
      return res.status(502).json({ success: false, message: "Invalid response from Shopify" });
    }

    // 1) GraphQL szintű hibák (nem userErrors!)
    if (json.errors?.length) {
      const first = json.errors[0];
      // A "NOT_FOUND" tipikusan: rossz domain/token / vagy new accounts módban a mutáció nem elérhető
      if (first.extensions?.code === "NOT_FOUND") {
        return res.status(400).json({
          success: false,
          message: "Shopify endpoint/token mismatch or customer accounts mode unsupported for password reset."
        });
      }
      return res.status(400).json({ success: false, message: first.message || "GraphQL error" });
    }

    // 2) Üzleti hibák (userErrors)
    const userErrors = json?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      const msg = userErrors[0]?.message || "Unknown user error";
      return res.status(400).json({ success: false, message: msg });
    }

    // 3) Siker – Shopify elküldi az emailt (létező címnél)
    return res.status(200).json({ success: true, message: "Recovery email triggered" });

  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
