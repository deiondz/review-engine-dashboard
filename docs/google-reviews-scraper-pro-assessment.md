# Google Reviews Scraper Pro assessment

Assessed 2026-08-02 against repository release `v1.2.3`, commit
[`09bfa621`](https://github.com/georgekhananaev/google-reviews-scraper-pro/tree/09bfa6215cb37edecc777bb40055d100e88ef767).

## Decision

`google-reviews-scraper-pro` is technically usable as an **experimental, replaceable ingestion adapter**, but it should not be treated as a reliable or policy-safe replacement for the Google Business Profile API.

It can provide the fields needed by the dashboard and can be invoked over HTTP. However, it scrapes Google Maps through browser automation, depends on undocumented DOM structure, does not guarantee a complete result set, and estimates review timestamps from relative text. Google Maps Platform's terms explicitly prohibit scraping and saving user reviews. The repository author also acknowledges that scraping may conflict with Google's terms.

Recommendation: do not make it the sole source of truth for stopping reminders. If business urgency justifies accepting the risk, deploy it behind a narrow `ReviewSource` adapter, run it at a conservative interval, mark scraper timestamps as estimated, retain manual confirmation, and keep email/manual ingestion as a fallback. Obtain legal approval before production use.

## What the repository provides

The project is MIT-licensed, so its code may be used and modified if the copyright and license notice is preserved; the software is provided without warranty. This source-code license does **not** grant rights to Google content or override Google's terms. See the repository's [MIT license](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/LICENSE) and its separate [recommended-usage notice](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/terms-of-usage.md), which warns that scraping may conflict with Google's terms and recommends limiting use to a business's own reviews.

### Runtime and deployment

- Python 3.10+ and Chrome are required. The primary automation dependency is SeleniumBase; FastAPI/Uvicorn provide the HTTP service. MongoDB and S3 are optional. [Project metadata](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/pyproject.toml) and [dependency list](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/requirements.txt).
- This cannot simply be pasted into an n8n Code node. It needs a separately operated Python/Chrome service with persistent SQLite storage, writable directories, browser memory/CPU, outbound access to Google, logs, health checks, and Chrome lifecycle management.
- The service supports up to three concurrent background scrape jobs in-process. Jobs are asynchronous, so an integration must `POST /scrape`, retain the returned job ID, poll `/jobs/{job_id}`, then page through stored reviews. [API implementation](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/api_server.py#L220-L340).
- API keys are stored hashed in SQLite and supplied via `X-API-Key`, but authentication is intentionally disabled when no active key exists. CORS defaults to `*`. Production deployment must create a key and restrict network exposure/CORS. [Authentication implementation](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/api_server.py#L25-L55) and [CORS configuration](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/api_server.py#L170-L190).

### Interface and fields

The HTTP interface exposes:

- `POST /scrape` for a Google Maps URL and scrape options;
- `GET /jobs/{job_id}` for completion/failure state;
- `GET /places` and `GET /places/{place_id}`;
- `GET /reviews/{place_id}?limit=&offset=` and single-review/history endpoints.

These are documented in the repository [README API section](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/README.md#api-server-mode) and implemented by [the review routes](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/api_server.py#L670-L730).

The stored response has the dashboard's core fields: `review_id`, `place_id`, author display name, numeric rating, text, review date, raw date, profile URL/picture, likes, images, owner response, first/last observed timestamps, and change hashes. [Response model](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/api_server.py#L290-L345).

The scraper reads `review_id` directly from Google's undocumented `data-review-id` DOM attribute and uses `(review_id, place_id)` as its SQLite primary key. This is suitable for practical deduplication while that attribute remains present, but Google does not document or guarantee it as a public contract. [DOM extraction](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/models.py#L90-L120) and [database schema](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/review_db.py#L75-L105).

Reviewer identity is only the public display name and profile URL. There is no phone number, email address, or verified identity. Therefore the existing conservative name/time-window matcher and manual queue remain necessary; scraping does not make campaign-to-review matching conclusive.

## Completeness and time accuracy

The API's `limit`/`offset` pagination only pages through the scraper's local SQLite snapshot. It is not upstream Google pagination and says nothing about whether all Google reviews were captured. [Review listing route](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/api_server.py#L670-L695).

Upstream collection repeatedly scrolls the Google Maps review pane. It stops after configured scroll/idle limits, repeated empty batches, a stuck pane, an optional maximum review count, an early-stop threshold, CAPTCHA/rate limiting, browser failure, or parsing errors. Defaults include 50 maximum scroll attempts and 15 idle iterations. Consequently, neither a successful job nor the local `total` proves a complete Google review inventory. [Scrape loop and stop conditions](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/scraper.py#L1437-L1840) and [default configuration](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/config.py#L20-L70).

Google Maps exposes dates such as “2 weeks ago.” The project converts those strings by subtracting a duration from scrape time; it models a month as 30 days and a year as 365 days. Thus `review_date` is an estimate, not Google's exact creation timestamp, and the estimate can shift between scrapes as the displayed relative label changes. [Date conversion](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/utils.py#L260-L310).

For this dashboard that means:

- use scraper observation time as the reliable “first seen” time;
- store the parsed review date as `estimated_review_date` (or record an explicit precision/source flag);
- widen or manually adjudicate boundary matches near the 30-day campaign window;
- never infer “no review submitted” merely because one scrape did not find it;
- only stop reminders automatically on a strong unique match, preserving the current stale-sync safety gate.

## Breakage and operational risk

The implementation locates review cards, tabs, sort controls, text, rating, dates, and owner responses through CSS classes, ARIA labels, positional fallbacks, and multilingual keyword lists. These are undocumented Google Maps UI details. A Google UI/experiment/locale change can silently reduce extraction, select the wrong tab/sort, or return an incomplete set. The code itself includes selector-health telemetry and multiple fallbacks precisely because DOM drift is expected. [Review model selectors](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/models.py#L35-L175) and [navigation's “limited view” bypass](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/scraper.py#L440-L565).

Google can present limited views, CAPTCHA, `/sorry/` rate-limit pages, and other anti-automation responses. The scraper detects some of these, sleeps, and aborts; it does not eliminate the risk. Running from a datacenter IP and every 15 minutes increases the likelihood of throttling or challenges. [Rate-limit handling](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/scraper.py#L1380-L1435) and [loop probes](https://github.com/georgekhananaev/google-reviews-scraper-pro/blob/09bfa6215cb37edecc777bb40055d100e88ef767/modules/scraper.py#L1580-L1630).

Minimum production controls would be a synthetic known-place probe, alerting on empty/degraded sessions and selector hit-rate, conservative scheduling with jitter/backoff, partial-result rejection, explicit per-business freshness, and a kill switch. Never attempt CAPTCHA bypassing, proxy rotation, account farming, or identity concealment.

## Google policy risk

Google's general Terms prohibit automated access that violates machine-readable instructions and state that Google may suspend/terminate access for conduct such as scraping content that does not belong to the user. [Google Terms of Service](https://policies.google.com/terms).

More directly, section 3.2.3(a) of the Google Maps Platform Terms says customers must not export, extract, or scrape Google Maps Content for use outside the services; its examples expressly include copying and saving user reviews. It also prohibits caching except where service-specific terms permit it. The dashboard's intended persistent storage, sentiment analysis, campaign matching, and presentation outside Google Maps fall squarely within the activities this clause describes. [Google Maps Platform Terms, “No Scraping” and “No Caching”](https://cloud.google.com/maps-platform/terms#3.-license).

The repository's MIT license only governs permission to use the scraper source. It does not remove these service/content restrictions. Restricting collection to reviews about the customer's own business may reduce privacy and practical exposure, but it does not create an exception in Google's stated no-scraping clause. This is a product/legal risk decision, not merely an engineering choice.

## Safe integration shape if risk is accepted

Keep Google-specific ingestion behind one dashboard-owned interface:

```text
ReviewSource.sync(business, since) -> SyncResult
  reviews[]
  observedAt
  completeness: unknown | partial
  source: google_maps_scraper
  warnings[]
```

Deploy the scraper as an internal-only container/service. Let n8n trigger the dashboard's existing sync endpoint; the dashboard calls the scraper, polls the job, validates session health, imports normalized reviews idempotently, and then runs the current matching/sentiment pipeline. n8n should not read the scraper database directly.

Replace the OAuth/location configuration with a per-Business Google Maps URL or resolved place ID, but retain the old GBP adapter/schema behind a feature flag so approved API access can be restored without another domain-model rewrite. Run an initial full import, then newest-first incremental runs no more often than operationally necessary; a 30–60 minute interval with jitter is safer than 15 minutes, with a slower reconciliation job.

Acceptance criteria for a limited trial:

1. A pinned container image successfully scrapes the actual Business location in headless production infrastructure.
2. A known recent review appears with stable `review_id`, correct author/rating/text, and an explicitly estimated date.
3. Repeated runs are idempotent and do not produce false “new review” events as relative dates change.
4. Empty, degraded, CAPTCHA/rate-limit, sort-unconfirmed, and partial sessions never refresh `google_sync_fresh_until`.
5. A scraper outage pauses reminders and leaves manual entry/email ingestion available.
6. Legal/product owners explicitly accept Google's no-scraping policy risk.
