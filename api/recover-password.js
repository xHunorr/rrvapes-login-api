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
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email, locale } = req.body || {};

  // ---- 1) Email formátum ellenőrzés (kliens hack ellen is) ----
  const isValidEmail = typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  if (!isValidEmail) {
    // Nem hívjuk a Shopify-t => nem számolja próbálkozásnak
    return res.status(422).json({
      success: false,
      message: "Please enter a valid email address."
    });
  }

  const selectedLocale = ["hu", "en", "sk"].includes(locale) ? locale : "hu";

  // ---- ENV ----
  const storefrontDomain = process.env.SHOPIFY_STOREFRONT_DOMAIN; // pl. kmkqnw-ev.myshopify.com
  const adminDomain = process.env.SHOPIFY_ADMIN_DOMAIN;           // pl. kmkqnw-ev.myshopify.com
  const version = process.env.SHOPIFY_API_VERSION || "2024-07";
  const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storefrontDomain || !storefrontToken || !adminDomain || !adminToken) {
    return res.status(500).json({ success: false, message: "Shop config missing" });
  }

  const adminUrl = `https://${adminDomain}/admin/api/${version}/graphql.json`;
  const storefrontUrl = `https://${storefrontDomain}/api/${version}/graphql.json`;

  try {
    // ---- 2) Customer ID lekérése email alapján (Admin API) ----
    const findQuery = `
      {
        customers(query: "email:${email}", first: 1) {
          edges { node { id } }
        }
      }
    `;

    const findRes = await fetch(adminUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ query: findQuery })
    });

    const findData = await findRes.json();
    const customerId = findData?.data?.customers?.edges?.[0]?.node?.id;

    // Biztonság: ha nincs ilyen fiók, akkor is "sikeres" választ adunk
    if (!customerId) {
      return res.status(200).json({ success: true, message: "Password recovery email sent" });
    }

    // ---- 3) Nyelv frissítése a customer profilra (Admin API) ----
    const updateMutation = `
      mutation updateCustomer($id: ID!, $locale: String!) {
        customerUpdate(input: { id: $id, locale: $locale }) {
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

    // ---- 4) Password reset email kiküldése (Storefront API) ----
    const recoverMutation = `
      mutation customerRecover($email: String!) {
        customerRecover(email: $email) {
          userErrors { message }
        }
      }
    `;

    const response = await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify({ query: recoverMutation, variables: { email: email.trim() } }),
    });

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

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
