// api/address-delete.js
export default async function handler(req, res) {
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed." });

  try {
    const { token, addressId } = req.body || {};
    if (!token || !addressId) {
      return res.status(400).json({ error: "Missing token or addressId." });
    }

    const resp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation customerAddressDelete($customerAccessToken: String!, $id: ID!) {
            customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
              deletedCustomerAddressId
              customerUserErrors { field, message }
            }
          }
        `,
        variables: { customerAccessToken: token, id: addressId }
      })
    }).then(r => r.json());

    const errors = resp?.data?.customerAddressDelete?.customerUserErrors || [];
    if (errors.length) {
      return res.status(400).json({ error: errors.map(e => e.message).join(" | ") });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("Address delete error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}
