# Splendid Moving — Feedback Form

A one-page feedback funnel. The customer rates the move from 1 to 5 stars:

- **5 stars** → redirected to the Splendid Moving Google Reviews page to post publicly.
- **1–4 stars** → shown a private form; the message is emailed straight to the office.

Light, minimal theme — no logo, brand fonts (Space Grotesk / Plus Jakarta Sans)
and brand blue carried over from [splendidmoving.com](https://splendidmoving.com).

## Layout

```
index.html               The page (all four screens live here)
styles/styles.css        Brand tokens + page styles (self-contained)
scripts/feedback.js      Star logic and the 5-star / 1-4 star split
api/submit-feedback.js   Vercel serverless function that sends the email via Resend
assets/images/           Favicon
```

## Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. On Vercel, add the same three variables under **Project → Settings → Environment Variables**:

   | Variable | What it is |
   | --- | --- |
   | `RESEND_API_KEY` | Resend API key |
   | `RESEND_FROM` | Verified sending address, e.g. `reports@mail.splendidmoving.com` |
   | `FEEDBACK_TO` | Who receives the feedback. Comma-separated for several people. Defaults to `info@splendidmoving.com`. |

`.env` is gitignored and never committed.

## Running locally

```bash
npm run dev     # vercel dev — needed for the /api route to work
```

Then open http://localhost:3000. Submitting a 1–4 star rating sends a real email, so test with `FEEDBACK_TO` pointed at your own address first.

`npm start` serves the static page on port 8000, but the email endpoint will not work.

## Tracked links

The thank-you email (sent from Make.com) links here with the customer's details attached:

```
https://feedback.splendidmoving.com/?n={{encodeURL(6.firstName)}}&amp;c={{encodeURL(6.email)}}
```

`n` prefills the name box, `c` prefills the phone/email box, and both are sent to the office
with the feedback so it's clear which move it refers to. The query string is wiped from the
address bar as soon as it's read, so the customer's email isn't left on screen or leaked to
Google in the referrer.

Both values are also sent as `linkName` / `linkContact` separately from the form fields, so
attribution survives the customer clearing the prefilled boxes. Links without any parameters
still work exactly as before.

A 5-star rating never submits the form, so the page pings `/api/submit-feedback` with
`kind: 'redirect'` just before handing off to Google. That sends a short "sent to Google"
notice - not confirmation that a review was posted, which Google never reports back.

## Notes

- The page is set to `noindex` and `robots.txt` disallows crawling — it's a link you hand to customers, not a page for Google.
- Spam is filtered with a hidden honeypot field plus a rule that anything submitted in under 3 seconds is dropped.
- Google review link lives at the top of `scripts/feedback.js` as `GOOGLE_REVIEW_URL`.
