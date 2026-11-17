# Changelog

## 2026-11-16 — 5-star screen pushes customers through to Google
- Changed: replaced the "Thank you!" + spinner screen shown before the Google redirect with a "One last step" screen: progress bar (our star → Google), a 3-step preview of what to do on Google, and a big "Write my Google review" button. Auto-redirect delay raised from 1.2s to 4s so the screen can be read; the bar runs for the same time. Why: many 5-star customers read "Thank you" as done and left before reaching Google.
- Removed: CSS for the old spinner/fallback-link screen.
- Verified: headless Chrome against a local static server (desktop 1280px, mobile 390px): screen renders correctly on both; auto-redirect reached the Google review URL at ~4.5s after tapping 5 stars; the button navigated immediately. Google and the API were stubbed, so no real email was sent.
- Remaining: watch the 5-star count vs new Google reviews over the next few weeks to see if the gap closes.
