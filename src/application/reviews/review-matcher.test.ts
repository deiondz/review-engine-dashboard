import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchGoogleReview } from "./review-matcher";

const review = {
	businessId: "business-1",
	reviewerName: "Asha Sharma",
	createdAt: new Date("2026-08-10T10:00:00Z"),
};

describe("matchGoogleReview", () => {
	it("automatically matches one strongly named eligible Campaign", () => {
		const result = matchGoogleReview(review, [
			{
				id: "campaign-1",
				businessId: "business-1",
				customerName: "Asha  Sharma",
				reviewSentAt: new Date("2026-08-02T10:00:00Z"),
			},
		]);

		assert.deepEqual(result, {
			kind: "automatic",
			campaignId: "campaign-1",
			confidence: 1,
			reason: "unique_exact_name",
		});
	});

	it("sends ambiguous candidates to manual review", () => {
		const result = matchGoogleReview(review, [
			{
				id: "campaign-1",
				businessId: "business-1",
				customerName: "Asha Sharma",
				reviewSentAt: new Date("2026-08-02T10:00:00Z"),
			},
			{
				id: "campaign-2",
				businessId: "business-1",
				customerName: "Asha Sharma",
				reviewSentAt: new Date("2026-08-04T10:00:00Z"),
			},
		]);

		assert.equal(result.kind, "manual");
		assert.deepEqual(result.candidateCampaignIds, ["campaign-2", "campaign-1"]);
	});

	it("excludes Campaigns outside the request-to-30-day window", () => {
		const result = matchGoogleReview(review, [
			{
				id: "too-old",
				businessId: "business-1",
				customerName: "Asha Sharma",
				reviewSentAt: new Date("2026-06-01T10:00:00Z"),
			},
			{
				id: "after-review",
				businessId: "business-1",
				customerName: "Asha Sharma",
				reviewSentAt: new Date("2026-08-11T10:00:00Z"),
			},
		]);

		assert.deepEqual(result, { kind: "unmatched", candidateCampaignIds: [] });
	});

	it("queues fuzzy names and ranks a recent tracked click as supporting evidence", () => {
		const result = matchGoogleReview(review, [
			{
				id: "name-only",
				businessId: "business-1",
				customerName: "Asha S.",
				reviewSentAt: new Date("2026-08-05T10:00:00Z"),
			},
			{
				id: "clicked",
				businessId: "business-1",
				customerName: "Customer A",
				reviewSentAt: new Date("2026-08-02T10:00:00Z"),
				firstClickedAt: new Date("2026-08-10T09:00:00Z"),
			},
		]);
		assert.deepEqual(result, {
			kind: "manual",
			candidateCampaignIds: ["name-only", "clicked"],
		});
	});
});
