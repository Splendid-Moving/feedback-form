// Vercel Serverless Function: email private customer feedback (1-4 stars) to the office via Resend.

const FALLBACK_TO = 'info@splendidmoving.com';
const MAX_MESSAGE = 3000;

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stars(rating) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const rating = Number(body.rating);
        const message = String(body.message || '').trim().slice(0, MAX_MESSAGE);
        const name = String(body.name || '').trim().slice(0, 80);
        const contact = String(body.contact || '').trim().slice(0, 120);

        // Who Make.com said this was, straight from the emailed link. Kept separate from
        // the form fields so attribution survives the customer editing or clearing them.
        const linkName = String(body.linkName || '').trim().slice(0, 80);
        const linkContact = String(body.linkContact || '').trim().slice(0, 120);

        // 'redirect' is the fire-and-forget ping sent when a 5-star customer is handed
        // off to Google. There is no written message on that path.
        const isRedirect = body.kind === 'redirect';

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Invalid rating' });
        }

        if (!isRedirect && message.length < 3) {
            return res.status(400).json({ error: 'Feedback message is required' });
        }

        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const RESEND_FROM = process.env.RESEND_FROM;
        const FEEDBACK_TO = process.env.FEEDBACK_TO || FALLBACK_TO;

        if (!RESEND_API_KEY || !RESEND_FROM) {
            console.error('Missing Resend environment variables');
            return res.status(500).json({
                error: 'Server configuration error',
                details: 'Missing email credentials'
            });
        }

        const submittedAt = new Date().toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            dateStyle: 'full',
            timeStyle: 'short'
        });

        const displayName = name || linkName || 'Anonymous customer';
        const linkIdentity = [linkName, linkContact].filter(Boolean).join(' · ');

        const subject = isRedirect
            ? `5★ — ${displayName} was sent to Google`
            : `${rating}★ feedback from ${displayName}`;

        const text = (isRedirect
            ? [
                'Rated 5 stars and was sent to the Google review page.',
                'Google does not report back, so this is not confirmation a review was posted.',
                '',
                `Customer: ${linkIdentity || '(link had no details)'}`,
                `Sent: ${submittedAt} (PT)`
            ]
            : [
                `Rating: ${rating}/5`,
                `Name: ${name || '(not provided)'}`,
                `Phone/email: ${contact || '(not provided)'}`,
                linkIdentity ? `From the link: ${linkIdentity}` : null,
                `Submitted: ${submittedAt} (PT)`,
                '',
                'Feedback:',
                message
            ]
        ).filter(line => line !== null).join('\n');

        const linkRow = linkIdentity
            ? `<tr><td style="padding:6px 0;color:#64748b">From the link</td><td style="padding:6px 0;color:#475569">${escapeHtml(linkIdentity)}</td></tr>`
            : '';

        const html = (isRedirect ? `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#129d54;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;color:#ffffff;font-size:18px">5&#9733; &mdash; sent to Google</h1>
    <p style="margin:6px 0 0;color:#d3f0e0;font-size:14px">Splendid Moving &middot; private feedback form</p>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <p style="margin:0 0 16px;font-size:28px;letter-spacing:4px;color:#f59e0b">${stars(5)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:6px 0;color:#64748b;width:130px">Customer</td><td style="padding:6px 0"><strong>${escapeHtml(linkIdentity || '(link had no details)')}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Sent</td><td style="padding:6px 0">${escapeHtml(submittedAt)} PT</td></tr>
    </table>
    <div style="margin-top:20px;padding:16px;background:#f8fafc;border-left:4px solid #cbd5e1;border-radius:6px">
      <p style="margin:0;line-height:1.6;color:#475569">They rated the move 5 stars and were handed off to the Google review page. Google doesn't report back, so this isn't confirmation that a review was actually posted.</p>
    </div>
  </div>
</div>` : `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#032449;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;color:#ffffff;font-size:18px">New customer feedback</h1>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:14px">Splendid Moving &middot; private feedback form</p>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <p style="margin:0 0 16px;font-size:28px;letter-spacing:4px;color:#f59e0b">${stars(rating)}
      <span style="font-size:15px;letter-spacing:0;color:#64748b">&nbsp;${rating} out of 5</span>
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:6px 0;color:#64748b;width:130px">Name</td><td style="padding:6px 0"><strong>${escapeHtml(name || '(not provided)')}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Phone / email</td><td style="padding:6px 0"><strong>${escapeHtml(contact || '(not provided)')}</strong></td></tr>
      ${linkRow}
      <tr><td style="padding:6px 0;color:#64748b">Submitted</td><td style="padding:6px 0">${escapeHtml(submittedAt)} PT</td></tr>
    </table>
    <div style="margin-top:20px;padding:16px;background:#f6f9ff;border-left:4px solid #188bf6;border-radius:6px">
      <p style="margin:0;white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</p>
    </div>
  </div>
</div>`).trim();

        const payload = {
            from: RESEND_FROM,
            to: FEEDBACK_TO.split(',').map(addr => addr.trim()).filter(Boolean),
            subject,
            text,
            html
        };

        // Let the office hit "Reply" and land in the customer's inbox when they left an email.
        const replyTo = contact.includes('@') ? contact : (linkContact.includes('@') ? linkContact : '');
        if (replyTo) {
            payload.reply_to = replyTo;
        }

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const resendData = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Resend API error:', resendData);
            return res.status(502).json({
                error: 'Failed to send feedback email',
                details: resendData
            });
        }

        return res.status(200).json({ success: true, id: resendData.id });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
