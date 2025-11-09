// /api/recover-password.js
export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "";
  const allowed = ["https://rrvapes.com", "https://www.rrvapes.com"];
  res.setHeader("Access-Control-Allow-Origin", allowed.includes(origin) ? origin : allowed[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { email, locale } = req.body || {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  // ✅ Nyelv map Shopify számára
  const localeMap = { hu: "HU", en: "EN", sk: "SK" };
  const selectedLocale = localeMap[locale] || "HU";

  try {
    //
    // 1️⃣ CUSTOMER LANGUAGE UPDATE (ADMIN API)
    //
    const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const adminUrl = `https://${process.env.SHOPIFY_ADMIN_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`;

    // Lekérjük a customer ID-t email alapján
    const findCustomerQuery = `
      {
        customers(query: "email:\\"${email}\\"", first: 1) {
          edges { node { id } }
        }
      }
    `;

    const findResponse = await fetch(adminUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken
      },
      body: JSON.stringify({ query: findCustomerQuery })
    });

    const findData = await findResponse.json();
    const customerId = findData?.data?.customers?.edges?.[0]?.node?.id;

    // Ha létezik a user → frissítjük a nyelvét
    if (customerId) {
      const updateLocaleMutation = `
        mutation updateCustomer($id: ID!, $languageCode: LanguageCode!) {
          customerUpdate(input: {id: $id, languageCode: $languageCode}) {
            customer { id languageCode }
            userErrors { message }
          }
        }
      `;

      await fetch(adminUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken
        },
        body: JSON.stringify({
          query: updateLocaleMutation,
          variables: { id: customerId, languageCode: selectedLocale }
        })
      });
    }

    //
    // 2️⃣ PASSWORD RESET EMAIL (Storefront API)
    //
    const storeDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN;
    const version = process.env.SHOPIFY_API_VERSION || "2024-07";
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

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
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({ success: false, message: "Bad JSON from Shopify" });
    }

    const userErrors = data?.data?.customerRecover?.userErrors || [];
    if (userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0].message || "Recover error" });
    }

    return res.status(200).json({ success: true, message: "Password recovery email sent" });

  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
