// api/customer-update.js
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
    return res.status(405).json({ error: "Only POST allowed." });
  }

  try {
    const { currentEmail, currentPassword, customer } = req.body || {};
    if (!currentEmail || !currentPassword) {
      return res.status(400).json({ error: "Current email and password required." });
    }

    // 1) Token a jelenlegi adatokkal
    const tokenResp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
            customerAccessTokenCreate(input: $input) {
              customerAccessToken { accessToken, expiresAt }
              customerUserErrors { field, message }
            }
          }
        `,
        variables: {
          input: { email: currentEmail, password: currentPassword }
        }
      })
    }).then(r => r.json());

    const tokenErrors = tokenResp?.data?.customerAccessTokenCreate?.customerUserErrors || [];
    const accessToken = tokenResp?.data?.customerAccessTokenCreate?.customerAccessToken?.accessToken;

    if (!accessToken) {
      let msg = tokenErrors.map(e => e.message).join(" | ");
      if (!msg || msg.toLowerCase().includes("unidentified")) {
        msg = "Hibásan adtad meg a jelenlegi jelszót.";
      }
      return res.status(401).json({ error: msg });
    }

    // 2) customerUpdate a friss tokennel
    const updateResp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation customerUpdate($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
            customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
              customer { id, email, firstName, lastName }
              customerUserErrors { field, message }
            }
          }
        `,
        variables: {
          customerAccessToken: accessToken,
          customer
        }
      })
    }).then(r => r.json());

    const updErrs = updateResp?.data?.customerUpdate?.customerUserErrors || [];
    if (updErrs.length) {
      return res.status(400).json({ error: updErrs.map(e => e.message).join(" | ") });
    }

    return res.status(200).json({
      success: true,
      customer: updateResp?.data?.customerUpdate?.customer
    });
  } catch (e) {
    console.error("Customer update API error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}
