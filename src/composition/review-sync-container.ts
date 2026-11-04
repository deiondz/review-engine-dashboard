import "server-only";
import env from "@/../env.config";
import { syncBusinessReviews } from "@/application/reviews/review-sync";
import {
	completeCampaign,
	ensureReviewIndexes,
	getGoogleConnection,
	listConnectedBusinessIds,
	loadEligibleCampaigns,
	recordSync,
	upsertGoogleReview,
} from "@/infrastructure/database/mongo/mongo-review-store";
import {
	collectScrapedReviews,
	createGoogleReviewsScraperApi,
} from "@/infrastructure/google/google-reviews-scraper-client";

export async function runReviewSync(businessId: string) {
	return syncBusinessReviews(
		{ businessId, now: new Date() },
		{
			loadConnection: async (id) => {
				const connection = await getGoogleConnection(id);
				if (!connection?.mapsUrl || !connection.locationId) return null;
				return {
					locationId: String(connection.locationId),
					mapsUrl: String(connection.mapsUrl),
				};
			},
			listGoogleReviews: async (connection) => {
				if (!connection.mapsUrl)
					throw new Error("Google Maps location is not configured");
				const result = await collectScrapedReviews(
					{ mapsUrl: connection.mapsUrl },
					createGoogleReviewsScraperApi({
						baseUrl: env.GOOGLE_REVIEWS_SCRAPER_URL,
						apiKey: env.GOOGLE_REVIEWS_SCRAPER_API_KEY,
					}),
				);
				return result.reviews;
			},
			loadEligibleCampaigns,
			upsertReview: upsertGoogleReview,
			completeCampaign: (campaignId, googleReviewId, at) =>
				completeCampaign(campaignId, googleReviewId, at, businessId),
			markSyncSucceeded: (id, at) => recordSync(id, { success: true, at }),
			markSyncFailed: (id, at, reason) =>
				recordSync(id, { success: false, at, reason }),
		},
	);
}

export async function runAllReviewSyncs() {
	await ensureReviewIndexes();
	const businessIds = await listConnectedBusinessIds();
	const results = await Promise.allSettled(
		businessIds.map((businessId) => runReviewSync(businessId)),
	);
	return {
		businesses: businessIds.length,
		succeeded: results.filter((result) => result.status === "fulfilled").length,
		failed: results.filter((result) => result.status === "rejected").length,
	};
}
