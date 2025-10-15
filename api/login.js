export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST metódus engedélyezett." });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email és jelszó megadása kötelező." });
  }

  // 🔐 Itt kapcsolódunk a Shopify Storefront API-hoz
  const resp = await fetch("https://rrvapes.com/api/2024-07/graphql.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN
    },
    body: JSON.stringify({
      query: `
        mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
          customerAccessTokenCreate(input: $input) {
            customerAccessToken {
              accessToken
              expiresAt
            }
            customerUserErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        input: { email, password }
      }
    })
  });

  const data = await resp.json();
  const errors = data?.data?.customerAccessTokenCreate?.customerUserErrors || [];
  const token = data?.data?.customerAccessTokenCreate?.customerAccessToken?.accessToken;

  if (errors.length > 0 || !token) {
    return res.status(401).json({ error: errors[0]?.message || "Hibás e-mail vagy jelszó." });
  }

  return res.status(200).json({
    message: "Sikeres bejelentkezés",
    token
  });
}
