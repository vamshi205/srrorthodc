// api/send-email.js - Vercel Serverless Function for Resend Emails

export default async function handler(req, res) {
  // CORS Headers for cross-origin or iframe dispatch
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Retrieve Resend API Key from Vercel Environment Variables
  const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      message: 'RESEND_API_KEY environment variable is not configured in Vercel. Please add RESEND_API_KEY in Vercel Project Settings -> Environment Variables.'
    });
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { to, subject, text, body, attachments, from, cc, reply_to } = bodyData;

    if (!to) {
      return res.status(400).json({ message: 'Recipient email ("to") is required.' });
    }

    const payload = {
      from: from || process.env.VITE_EMAIL_FROM || 'Sri Raja Rajeshwari Ortho Plus <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      reply_to: reply_to || undefined,
      subject: subject || 'Document from Sri Raja Rajeshwari Ortho Plus',
      text: text || body || '',
      attachments: attachments && Array.isArray(attachments) ? attachments : undefined
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend API returned error:', data);
      return res.status(resendRes.status).json({
        message: data.message || (data.name ? `${data.name}: ${data.message}` : 'Resend API error'),
        error: data
      });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('Serverless Resend Function Error:', error);
    return res.status(500).json({ message: error.message || 'Failed to dispatch email via Vercel serverless function' });
  }
}
