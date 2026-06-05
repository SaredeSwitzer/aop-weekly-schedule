exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { to, toName, subject, htmlContent } = JSON.parse(event.body);

    if (!to || !subject || !htmlContent) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: to, subject, htmlContent' }) };
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'BREVO_API_KEY is not configured in Netlify environment variables' }) };
    }

    console.log(`Sending email to: ${to} | subject: ${subject}`);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender:  { name: 'AOP Shala NYC', email: 'saredeswitzer@gmail.com' },
        replyTo: { email: 'intouchyoga@icloud.com' },
        to:      [{ email: to, name: toName || '' }],
        subject,
        htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Brevo rejected email to ${to}:`, JSON.stringify(data));
      return { statusCode: res.status, headers, body: JSON.stringify({ error: 'Brevo API error', details: data }) };
    }

    console.log(`Brevo accepted email to ${to} | messageId: ${data.messageId}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, messageId: data.messageId }) };
  } catch (e) {
    console.error('send-email function error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
