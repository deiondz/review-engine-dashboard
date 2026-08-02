# Review Engine

The Review Engine coordinates customer-review campaigns and exposes their operational state to each authenticated organization.

## Language

**Organization**:
The tenant that owns businesses, messaging sessions, campaigns, and pipeline data. Its Better Auth identifier is the canonical tenant key.
_Avoid_: Workspace, account, tenant ID

**Business**:
The customer-facing identity whose completed jobs initiate review campaigns. A Business belongs to an Organization.
_Avoid_: Account, client

**Messaging Session**:
A durable connection between one Business and one WhatsApp number. A Business may own multiple Messaging Sessions.
_Avoid_: WhatsApp client, connection

**Campaign**:
One customer review lifecycle, beginning with a completed job and ending after a review, reminder, or terminal failure.
_Avoid_: Customer record, workflow run

**Message**:
An inbound or outbound communication recorded by the Messaging Service.
_Avoid_: Notification, event

**Reply**:
An inbound customer Message enriched with sentiment and owner-notification state.
_Avoid_: Response

**Pipeline State**:
The current operational position of a Campaign or Message, used for monitoring and recovery.
_Avoid_: Status flow

**Google Review**:
A review published on the Google Business Profile location mapped to a Business. A Google Review is the only evidence that a review was submitted; opening a tracked link is not submission.
_Avoid_: Review click, customer confirmation

**Review Match**:
The association between one Google Review and one Campaign. A match may be confirmed automatically from strong evidence or manually by an Organization member.
_Avoid_: Review detection

**Match Confidence**:
The system's confidence that a Google Review belongs to a particular Campaign. It is distinct from Review Sentiment.
_Avoid_: Sentiment score

**Review Sentiment**:
The meaning inferred from a Google Review's text and star rating: positive, neutral, or negative. It includes model confidence and may be overridden by an Organization member.
_Avoid_: Match confidence

**Resolution State**:
An Organization member's record of recovery work for a Google Review: unaddressed, contacted, in conversation, resolved, or closed. It does not alter the Google Review or its Review Match.
_Avoid_: Review status, Campaign state
