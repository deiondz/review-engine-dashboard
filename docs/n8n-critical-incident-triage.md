# Critical Incident Triage

The n8n workflow **Review Engine — Critical Incident Triage** accepts incidents
from the Review Engine, n8n, and the WhatsApp Messaging Service. It emails only
critical incidents through ZeptoMail and acknowledges every valid request.

## Endpoint

The published production endpoint is:

```text
POST https://n8n.deiondz.com/webhook/3ab7f22a-fa6c-4de1-bad7-48a88a63aabb/internal/review-engine/triage
Content-Type: application/json
<header and value from the n8n "WhatsApp Incoming Webhook" credential>
```

The header credential is required. Do not put it in the JSON body or logs.

## Required configuration

The **Send Mail** node uses the installed **Zoho Zeptomail** node with the
`Zoho ZeptoMail account` OAuth credential and the `workspace` mail agent.
Define these n8n variables:

- `ZEPTOMAIL_FROM_EMAIL`: a sender address verified in ZeptoMail
- `ZEPTOMAIL_FROM_NAME`: display name, for example `Review Engine Alerts`
- `TRIAGE_ALERT_EMAIL`: operator email that receives alerts
- `TRIAGE_ALERT_NAME`: operator display name

These values are configured, and the critical delivery path has been verified.

## Incident interface

`source` and `title` are required. The body must be no larger than 128 KiB.

```json
{
  "incidentId": "inc_01J...",
  "source": "whatsapp-messaging",
  "title": "Outbound WhatsApp delivery stopped",
  "severity": "critical",
  "category": "outage",
  "environment": "production",
  "occurredAt": "2026-08-02T09:20:00.000Z",
  "businessId": "business_123",
  "workflowId": "workflow_456",
  "executionId": "execution_789",
  "requestId": "request_abc",
  "operation": "send-review-request",
  "retryExhausted": true,
  "customerImpact": "all_customers_blocked",
  "error": {
    "name": "UpstreamUnavailableError",
    "message": "WhatsApp provider returned HTTP 503",
    "code": "WHATSAPP_UPSTREAM_UNAVAILABLE",
    "statusCode": 503,
    "stack": "optional stack trace"
  },
  "context": {
    "campaignId": "campaign_123",
    "attempt": 3
  }
}
```

Allowed sources are `review-engine`, `n8n`, and `whatsapp-messaging`.

An incident triggers email when any of these are true:

- Severity is `critical`, `fatal`, `p0`, or `p1`.
- Category is `security`, `data_loss`, or `outage`.
- Customer impact is `all_customers_blocked` or `data_integrity_at_risk`.
- Retries are exhausted and the status code is 500 or greater.

Likely credentials and authorization values are redacted before email delivery.
Callers must still avoid sending customer message contents or unnecessary personal
data in `context`.

## Responses

- `202 { "accepted": true, "alerted": true, "incidentId": "..." }`: critical alert sent.
- `202 { "accepted": true, "alerted": false, "incidentId": "...", "severity": "..." }`: valid noncritical incident; no email sent.
- `400 { "accepted": false, "errors": ["..."] }`: invalid incident.

Callers should use a stable `incidentId`, set a short request timeout, and retry
network failures with bounded exponential backoff. A non-2xx result does not prove
that no email was sent, so retries must preserve the same incident ID.

## n8n workflow

- Workflow ID: `osmFNjENSHhz77AO`
- Workflow URL: <https://n8n.deiondz.com/workflow/osmFNjENSHhz77AO>
- Webhook path: `internal/review-engine/triage`

The workflow is published. The WhatsApp Messaging Service reports exhausted
message and webhook retries, unhandled server errors, and process-level failures
to this endpoint.
