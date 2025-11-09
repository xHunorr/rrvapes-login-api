export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ["https://rrvapes.com", "https://www.rrvapes.com"];
  res.setHeader("Access-Control-Allow-Origin", allowed.includes(origin) ? origin : allowed[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false });

  const { email, locale } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: "Email missing" });

  const selectedLocale = ["hu", "en", "sk"].includes(locale) ? locale : "hu";

  const adminUrl = `https://${process.env.SHOPIFY_ADMIN_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`;
  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const storefrontUrl = `https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`;
  const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;

  try {
    // 1) Customer ID lekérése email alapján
    const searchQuery = `
      {
        customers(query: "email:${email}", first: 1) {
          edges {
            node { id }
          }
        }
      }
    `;

    const searchRes = await fetch(adminUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ query: searchQuery })
    });

    const searchData = await searchRes.json();
    const customerId = searchData?.data?.customers?.edges?.[0]?.node?.id;
    if (!customerId) return res.status(200).json({ success: true });

    // 2) Locale frissítés
    const updateMutation = `
      mutation updateCustomer($id: ID!, $locale: String!) {
        customerUpdate(input: {id: $id, locale: $locale}) {
          customer { id }
          userErrors { message }
        }
      }
    `;

    await fetch(adminUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({
        query: updateMutation,
        variables: { id: customerId, locale: selectedLocale }
      })
    });

    // 3) Reset email indítása
    const recoverMutation = `
      mutation customerRecover($email: String!) {
        customerRecover(email: $email) {
          userErrors { message }
        }
      }
    `;

    await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken
      },
      body: JSON.stringify({ query: recoverMutation, variables: { email } })
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Recover error:", err);
    return res.status(500).json({ success: false });
  }
}
