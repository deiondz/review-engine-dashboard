# Google Review Submission Detection

## Goal

Determine whether the customer for a Campaign submitted a Google Review, stop reminders safely, and give Organization members a clear view of negative reviews that may need manual recovery.

## Ownership

- The Review Dashboard owns Business-to-location mapping, scraper-backed review synchronization, click tracking, matching, sentiment, resolution state, and audit history.
- n8n owns Campaign timing, reminder orchestration, and production workflow failure routing.
- The Messaging Service remains responsible only for WhatsApp delivery.

Each Business maps to exactly one Google Business Profile location.

## Review synchronization

An Organization administrator configures a Google Maps or Google review URL for a Business during onboarding and may update it later under Account Settings. The Dashboard resolves short review links to a stable Place ID. A pinned, self-hosted Google Reviews Scraper Pro service performs a newest-first synchronization every 15 minutes. The Dashboard deduplicates records by the scraper's stable review ID, retains the complete review history returned by the scraper, and displays it on the Reviews page. The 30-day window applies only to Campaign matching.

The scraper is an explicitly accepted MVP dependency. It uses browser automation against public Google Maps pages, so completeness is not guaranteed and relative review timestamps are estimates. The Dashboard stores the raw relative label, estimated timestamp, and observation time. CAPTCHA, throttling, selector drift, empty persisted results, incomplete pages, and failed jobs make synchronization stale; they must never be treated as evidence that no review was submitted. The deployment pins the unmerged upstream PR #27 commit for its job-level `place_id` and `reviews_count` fixes; the persisted review collection remains the source of truth.

The existing `Google Review Automation - Lifecycle` n8n workflow receives an additional Schedule Trigger branch that calls an authenticated Dashboard synchronization endpoint. A separate n8n workflow is not required. An Error Trigger branch forwards production failures to the existing Critical Incident Triage endpoint.

The Dashboard stores only the Google review ID, location ID, reviewer display name, star rating, review text, Google timestamps, matching state, sentiment results, resolution state, and audit history. It does not store profile photos or unrelated Google account data.

## Tracked review links

Review requests contain an opaque, first-party URL such as `/r/{token}`. The endpoint records a minimal click event and immediately redirects to the Business's Google review URL.

A click is supporting match evidence, never proof of submission. Raw click records contain the Campaign ID, timestamp, and coarse user-agent classification, but no IP address. They expire after 90 days; the Campaign retains only `first_clicked_at` and `click_count` aggregates.

## Matching rules

A Google Review is eligible for a Campaign when it:

1. belongs to the Campaign's Business;
2. was posted after the review request; and
3. was posted within 30 days of the request.

The initial conservative matcher automatically confirms only a unique, strong normalized-name match. A recent tracked click can raise confidence but cannot compensate for a poor name match. Fuzzy names, conflicting evidence, multiple candidates, and unmatched reviews enter a shared manual queue.

Every Organization member may confirm, reject, or undo a Review Match. Each decision records the actor, time, reason when supplied, and previous state.

Confirmation sets the Campaign's `review_left` state and timestamp. Submission remains permanent if the Google Review is later edited or deleted; reminders do not restart.

## Reminder safety

Before n8n sends a reminder, it reloads the Campaign and verifies that:

- no Review Match has been confirmed;
- no reminder has already been sent; and
- the Business completed a successful Google synchronization within the previous hour.

When synchronization is stale or the browser scraper fails, reminders pause and the Dashboard displays a warning. They resume only after synchronization recovers.

The current minute-based waits are testing values. Production restores the node labels' intended delays: six hours before reply evaluation and three days before the reminder check.

## Reviews page

The Organization-scoped Reviews page displays:

- Google review content, stars, reviewer display name, and timestamps;
- matched Campaign and customer contact details when a match exists;
- Review Sentiment and model confidence;
- Match Confidence as a separate value;
- Resolution State;
- optional internal resolution notes; and
- match, sentiment, and resolution audit history.

The default view emphasizes negative, unaddressed reviews. The application does not send recovery outreach; the Business owner contacts the reviewer manually outside the system.

Sarvam classifies written reviews using both text and star rating. Reviews without text use 1-2 stars as negative, 3 as neutral, and 4-5 as positive. Strong rating/text contradictions are flagged for review. Any Organization member may override a sentiment classification, while the original model result remains in the audit history.

Resolution State values are `unaddressed`, `contacted`, `in_conversation`, `resolved`, and `closed`.

## Operational invariants

- A click never completes a Campaign.
- One Google Review can match at most one Campaign.
- One Campaign can have at most one confirmed Google Review.
- Matching and sentiment confidence are never represented by the same field.
- A stale Google synchronization prevents reminders.
- Manual decisions and reversals are auditable.

## Deployment configuration

The Dashboard container requires:

- `GOOGLE_REVIEWS_SCRAPER_URL`, normally `http://google-reviews-scraper:8000` on the shared Docker network;
- `GOOGLE_REVIEWS_SCRAPER_API_KEY` when the internal scraper API has authentication enabled;
- `REVIEW_SYNC_SECRET`, a random value of at least 24 characters shared with the n8n environment; and
- `SARVAM_API_KEY` for model classification. If it is temporarily unavailable, deterministic rating/text rules remain active.

The existing n8n lifecycle contains `Scrape Google Reviews Every 15 Minutes`, `Import Scraped Google Reviews`, and `Create Tracked Review Link` nodes. Keep review synchronization disabled until the Dashboard and n8n containers share `REVIEW_SYNC_SECRET` and the scraper health probe succeeds. The stale-sync condition on `Review Left?` stops the reminder when `review_left` is true or `google_sync_fresh_until` is missing/expired.
