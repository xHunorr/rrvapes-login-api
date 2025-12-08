export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "";
  const allowed = ["https://rrvapes.com", "https://www.rrvapes.com"];
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, locale } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  // ---- LOCALE MAP → GraphQL LanguageCode ----
  const langMap = { hu: "HU", sk: "SK", en: "EN" };
  const lang = langMap[(locale || "").toLowerCase()] || "HU";

  // ---- LOCALE MAP → Accept-Language HEADER ----
  const localeHeader =
    locale === "en" ? "en-US" :
    locale === "sk" ? "sk-SK" :
    "hu-HU";

  try {
    const endpoint = `https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`;
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
        "Accept-Language": localeHeader   // ← FIXED
      },
      body: JSON.stringify({
        query: `
          mutation customerRecover($email: String!, $lang: LanguageCode!)
          @inContext(language: $lang) {
            customerRecover(email: $email) {
              userErrors { field message }
            }
          }
        `,
        variables: { email, lang },
      }),
    });

    const text = await response.text();
    console.log("🧾 Shopify raw:", text);

    let data;
    try { 
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, message: "Bad JSON from Shopify" });
    }

    // --- Shopify top-level errors ---
    if (Array.isArray(data.errors) && data.errors.length) {
      const first = data.errors[0];
      if (first?.extensions?.code === "THROTTLED") {
        return res.status(429).json({
          success: false,
          message: "Túl sok próbálkozás. Próbáld meg később újra."
        });
      }
      return res.status(400).json({
        success: false,
        message: first?.message || "Shopify error"
      });
    }

    // --- User errors ---
    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({
        success: false,
        message: userErrors[0].message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password recovery email sent"
    });

  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
