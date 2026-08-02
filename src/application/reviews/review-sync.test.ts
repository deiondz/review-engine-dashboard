import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncBusinessReviews } from "./review-sync";

describe("syncBusinessReviews", () => {
	it("deduplicates Google reviews and permanently completes an automatic Campaign match", async () => {
		const events: string[] = [];
		const result = await syncBusinessReviews(
			{ businessId: "business-1", now: new Date("2026-08-10T12:00:00Z") },
			{
				loadConnection: async () => ({ accountId: "a", locationId: "l" }),
				listGoogleReviews: async () => [
					{
						id: "google-review-1",
						reviewerName: "Asha Sharma",
						stars: 5,
						text: "Great work",
						createdAt: new Date("2026-08-10T10:00:00Z"),
						updatedAt: new Date("2026-08-10T10:00:00Z"),
					},
				],
				loadEligibleCampaigns: async () => [
					{
						id: "campaign-1",
						businessId: "business-1",
						customerName: "Asha Sharma",
						reviewSentAt: new Date("2026-08-02T10:00:00Z"),
					},
				],
				upsertReview: async () => ({ inserted: true }),
				completeCampaign: async (campaignId) => {
					events.push(campaignId);
				},
				markSyncSucceeded: async () => {
					events.push("synced");
				},
				markSyncFailed: async () => {
					events.push("failed");
				},
			},
		);

		assert.deepEqual(result, { fetched: 1, inserted: 1, automaticMatches: 1 });
		assert.deepEqual(events, ["campaign-1", "synced"]);
	});

	it("retains old Google reviews but does not match them to recent Campaigns", async () => {
		let stored = 0;
		let observedMatch: string | undefined;
		const result = await syncBusinessReviews(
			{ businessId: "business-1", now: new Date("2026-08-10T12:00:00Z") },
			{
				loadConnection: async () => ({ accountId: "a", locationId: "l" }),
				listGoogleReviews: async () => [
					{
						id: "old",
						reviewerName: "Asha",
						stars: 5,
						text: "",
						createdAt: new Date("2026-06-01T10:00:00Z"),
						updatedAt: new Date("2026-06-01T10:00:00Z"),
					},
				],
				loadEligibleCampaigns: async () => [],
				upsertReview: async ({ match }) => {
					stored += 1;
					observedMatch = match.kind;
					return { inserted: true };
				},
				completeCampaign: async () => {},
				markSyncSucceeded: async () => {},
				markSyncFailed: async () => {},
			},
		);
		assert.deepEqual(result, { fetched: 1, inserted: 1, automaticMatches: 0 });
		assert.equal(stored, 1);
		assert.equal(observedMatch, "unmatched");
	});
});
