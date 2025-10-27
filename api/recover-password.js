export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const response = await fetch(`https://${process.env.SHOPIFY_DOMAIN}/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation customerRecover($email: String!) {
            customerRecover(email: $email) {
              userErrors { field message }
            }
          }
        `,
        variables: { email },
      }),
    });

    const data = await response.json();

    const errors = data?.data?.customerRecover?.userErrors;
    if (errors?.length) {
      return res.status(400).json({ success: false, message: errors[0].message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Recover error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
