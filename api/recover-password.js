export default async function handler(req, res) {
  // CORS – az oldaladról engedjük
  res.setHeader("Access-Control-Allow-Origin", "https://rrvapes.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-07";
    const endpoint = `https://${process.env.SHOPIFY_STOREFRONT_DOMAIN}/api/${apiVersion}/graphql.json`;

    // csak diagnosztika (nem logolunk tokent)
    console.log("🔗 Hívott endpoint:", endpoint);
    console.log("🔐 Van-e Storefront token:", !!process.env.SHOPIFY_STOREFRONT_TOKEN);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation customerRecover($email: String!) {
            customerRecover(email: $email) {
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: { email },
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

    // HTTP hiba?
    if (!response.ok) {
      const msg = data?.errors?.[0]?.message || response.statusText || "Shopify error";
      return res.status(response.status).json({ success: false, message: msg });
    }

    // GraphQL top-level errors?
    if (Array.isArray(data.errors) && data.errors.length) {
      const msg = data.errors[0]?.message || "Shopify error";
      return res.status(400).json({ success: false, message: msg });
    }

    // userErrors a mutation alatt?
    const userErrors = data?.data?.customerRecover?.userErrors;
    if (userErrors && userErrors.length) {
      return res.status(400).json({ success: false, message: userErrors[0].message });
    }

    // Ha idáig eljutottunk: a request elfogadva. (Shopify akkor is "siker", ha az email nem létezik.)
    return res.status(200).json({ success: true, message: "Password recovery email sent" });
  } catch (err) {
    console.error("❌ Recover error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
