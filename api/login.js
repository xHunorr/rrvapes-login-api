// api/login.js
export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "";
  const allowList = [
    "https://rrvapes.com",
    "https://www.rrvapes.com",
    "http://localhost:3000"
  ];
  if (origin && allowList.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // ha szigorítani akarod, vedd ki a *-ot, és csak allowList-et engedj
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST metódus engedélyezett." });
  }

  // --- Body parsing (biztonság kedvéért) ---
  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = body ? JSON.parse(body) : {};
    } catch {
      body = {};
    }
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email és jelszó megadása kötelező." });
  }

  try {
    // 🔐 Shopify Storefront: tokenkérés
    const resp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({
        query: `
          mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
            customerAccessTokenCreate(input: $input) {
              customerAccessToken { accessToken expiresAt }
              customerUserErrors { field message }
            }
          }
        `,
        variables: { input: { email, password } }
      })
    });

    const data = await resp.json();
    const errors = data?.data?.customerAccessTokenCreate?.customerUserErrors || [];
    const token = data?.data?.customerAccessTokenCreate?.customerAccessToken?.accessToken;

    if (!token) {
      return res
        .status(401)
        .json({ error: errors[0]?.message || "Hibás e-mail vagy jelszó." });
    }

    
        // LOCALE UPDATE: ITT!!!
    if (locale) {
      try {
        await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN
          },
          body: JSON.stringify({
            query: `
              mutation customerUpdate($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
                customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
                  customer { locale }
                  userErrors { field message }
                }
              }
            `,
            variables: {
              customerAccessToken: token,
              customer: {
                locale: locale.toUpperCase() // "en" → "EN"
              }
            }
          })
        });
      } catch (e) {
        console.error("🔥 Locale update failed:", e);
      }
    }

    
    // Siker
    return res.status(200).json({
      success: true,
      token
    });
  } catch (err) {
    console.error("Login API error:", err);
    return res.status(500).json({ error: "Szerverhiba történt." });
  }
}
