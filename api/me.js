// api/me.js
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
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token." });

    // Shopify query
    const resp = await fetch(`https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: `
          query getMe($token: String!) {
            customer(customerAccessToken: $token) {
              id
              firstName
              lastName
              email

              defaultAddress {
                id
              }

              orders(first: 20, reverse: true) {
                edges {
                  node {
                    id
                    name
                    orderNumber
                    processedAt
                    financialStatus
                    fulfillmentStatus
                    totalPriceV2 { amount currencyCode }
                    customerUrl
                    lineItems(first: 20) {
                      edges {
                        node {
                          title
                          quantity
                          originalTotalPrice { amount currencyCode }
                          variant {
                            title
                            image { url }
                            priceV2 { amount currencyCode }
                          }
                        }
                      }
                    }
                  }
                }
              }

              addresses(first: 10) {
                edges {
                  node {
                    id
                    firstName
                    lastName
                    address1
                    address2
                    city
                    zip
                    country
                    phone
                    formatted
                  }
                }
              }
            }
          }
        `,
        variables: { token }
      })
    });

    const data = await resp.json();
    const customer = data?.data?.customer || null;
    if (!customer) return res.status(401).json({ error: "Invalid or expired token." });

    // --- 🔥 FIX: Címek átalakítása ---
    const formattedAddresses = customer.addresses.edges.map(e => {
      const fullId = e.node.id; // gid://shopify/CustomerAddress/xxx
      const shortId = fullId.replace("gid://shopify/CustomerAddress/", "");

      return {
        originalId: fullId,
        id: shortId,

        firstName: e.node.firstName,
        lastName: e.node.lastName,
        address1: e.node.address1,
        address2: e.node.address2,
        city: e.node.city,
        zip: e.node.zip,
        country: e.node.country,
        phone: e.node.phone,
        formatted: e.node.formatted
      };
    });

    // Default address rövid ID formában
    const defaultAddressId = customer.defaultAddress?.id
      ?.replace("gid://shopify/CustomerAddress/", "");

    // Új, frontend-barát customer objektum
    const fixedCustomer = {
      ...customer,
      addresses: formattedAddresses,
      defaultAddressId
    };

    return res.status(200).json({ success: true, customer: fixedCustomer });

  } catch (e) {
    console.error("ME API error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}
