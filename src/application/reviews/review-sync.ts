import {
	matchGoogleReview,
	type ReviewMatchCampaign,
} from "@/application/reviews/review-matcher";

export type GoogleReviewInput = {
	id: string;
	reviewerName: string;
	stars: number;
	text: string;
	createdAt: Date;
	updatedAt: Date;
	observedAt?: Date;
	datePrecision?: "exact" | "estimated";
	rawDate?: string;
	rawSource?: Record<string, unknown>;
};

export type ReviewConnection = {
	locationId: string;
	mapsUrl?: string;
};

export type ReviewSyncDependencies = {
	loadConnection(businessId: string): Promise<ReviewConnection | null>;
	listGoogleReviews(connection: ReviewConnection): Promise<GoogleReviewInput[]>;
	loadEligibleCampaigns(businessId: string): Promise<ReviewMatchCampaign[]>;
	upsertReview(input: {
		businessId: string;
		locationId: string;
		review: GoogleReviewInput;
		match: ReturnType<typeof matchGoogleReview>;
	}): Promise<{ inserted: boolean; automaticMatchAccepted?: boolean }>;
	completeCampaign(
		campaignId: string,
		googleReviewId: string,
		at: Date,
	): Promise<void>;
	markSyncSucceeded(businessId: string, at: Date): Promise<void>;
	markSyncFailed(businessId: string, at: Date, reason: string): Promise<void>;
};

export async function syncBusinessReviews(
	input: { businessId: string; now: Date },
	deps: ReviewSyncDependencies,
) {
	try {
		const connection = await deps.loadConnection(input.businessId);
		if (!connection)
			throw new Error("Google Business Profile is not connected");
		const [allReviews, campaigns] = await Promise.all([
			deps.listGoogleReviews(connection),
			deps.loadEligibleCampaigns(input.businessId),
		]);
		let inserted = 0;
		let automaticMatches = 0;
		for (const review of allReviews) {
			const match = matchGoogleReview(
				{
					businessId: input.businessId,
					reviewerName: review.reviewerName,
					createdAt: review.createdAt,
				},
				campaigns,
			);
			const saved = await deps.upsertReview({
				businessId: input.businessId,
				locationId: connection.locationId,
				review,
				match,
			});
			if (saved.inserted) inserted += 1;
			if (
				match.kind === "automatic" &&
				saved.automaticMatchAccepted !== false
			) {
				await deps.completeCampaign(match.campaignId, review.id, input.now);
				automaticMatches += 1;
			}
		}
		await deps.markSyncSucceeded(input.businessId, input.now);
		return { fetched: allReviews.length, inserted, automaticMatches };
	} catch (error) {
		await deps.markSyncFailed(
			input.businessId,
			input.now,
			error instanceof Error
				? error.message
				: "Unknown synchronization failure",
		);
		throw error;
	}
}
