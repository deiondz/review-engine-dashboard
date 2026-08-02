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
