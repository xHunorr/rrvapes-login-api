// api/register.js
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
    // 🆕 Shopify customerCreate
    const createResp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({
        query: `
          mutation customerCreate($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              customer { id email }
              customerUserErrors { field message }
            }
          }
        `,
        variables: {
          input: { email, password }
        }
      })
    });

    const createData = await createResp.json();
    const createErrors = createData?.data?.customerCreate?.customerUserErrors || [];

    if (createErrors.length > 0) {
      return res.status(400).json({ error: createErrors[0].message || "Regisztráció sikertelen." });
    }

    // ✅ Ha létrejött a fiók, automatikusan kérünk hozzá accessToken-t
    const tokenResp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
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
        variables: {
          input: { email, password }
        }
      })
    });

    const tokenData = await tokenResp.json();
    const tokenErrors = tokenData?.data?.customerAccessTokenCreate?.customerUserErrors || [];
    const token = tokenData?.data?.customerAccessTokenCreate?.customerAccessToken?.accessToken;

    if (!token) {
      return res.status(500).json({ error: tokenErrors[0]?.message || "Token generálás sikertelen a regisztráció után." });
    }

    return res.status(200).json({
      success: true,
      token
    });

  } catch (err) {
    console.error("Register API error:", err);
    return res.status(500).json({ error: "Szerverhiba történt." });
  }
}
