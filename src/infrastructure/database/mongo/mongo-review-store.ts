import "server-only";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import env from "@/../env.config";
import type { ReviewMatchResult } from "@/application/reviews/review-matcher";
import {
	classifyReviewSentiment,
	type ReviewSentiment,
} from "@/application/reviews/review-sentiment";
import type { GoogleReviewInput } from "@/application/reviews/review-sync";
import { connectDatabase } from "@/composition/database-container";

const db = async () => {
	await connectDatabase();
	return mongoose.connection.getClient().db(env.REVIEWS_DATABASE_NAME);
};

export async function ensureReviewIndexes() {
	const database = await db();
	await Promise.all([
		database
			.collection("google_reviews")
			.createIndex(
				{ businessId: 1, googleReviewId: 1 },
				{ unique: true, name: "one_google_review_per_business" },
			),
		database.collection("google_reviews").createIndex(
			{ businessId: 1, matchedCampaignId: 1 },
			{
				unique: true,
				name: "one_confirmed_review_per_campaign",
				partialFilterExpression: {
					matchedCampaignId: { $type: "string" },
					matchState: "confirmed",
				},
			},
		),
		database
			.collection("review_clicks")
			.createIndex(
				{ expiresAt: 1 },
				{ expireAfterSeconds: 0, name: "expire_review_clicks" },
			),
	]);
}

export async function getGoogleConnection(businessId: string) {
	return (await db())
		.collection("google_business_connections")
		.findOne({ businessId });
}

export async function listConnectedBusinessIds() {
	return (await db())
		.collection("google_business_connections")
		.find({ mapsUrl: { $type: "string" }, locationId: { $type: "string" } })
		.project({ businessId: 1 })
		.toArray()
		.then((rows) => rows.map((row) => String(row.businessId)));
}

export async function createTrackedReviewLink(
	campaignId: string,
	baseUrl: string,
) {
	const token = randomBytes(24).toString("base64url");
	const trackedReviewUrl = new URL(
		`/api/reviews/click/${token}`,
		baseUrl,
	).toString();
	const result = await (await db()).collection("campaigns").updateOne(
		{ id: campaignId },
		{
			$set: {
				review_click_token: token,
				tracked_review_url: trackedReviewUrl,
				updated_at: new Date(),
			},
		},
	);
	if (!result.matchedCount) throw new Error("Campaign not found");
	return trackedReviewUrl;
}

export async function recordReviewClick(token: string, userAgentClass: string) {
	const database = await db();
	const campaigns = database.collection("campaigns");
	const campaign = await campaigns.findOne({ review_click_token: token });
	if (!campaign?.review_url) return null;
	const now = new Date();
	await Promise.all([
		database.collection("review_clicks").insertOne({
			campaignId: campaign.id,
			businessId: campaign.business_id ?? campaign.businessId,
			clickedAt: now,
			userAgentClass,
			expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
		}),
		campaigns.updateOne(
			{ _id: campaign._id },
			{
				$set: { first_clicked_at: campaign.first_clicked_at ?? now },
				$inc: { click_count: 1 },
			},
		),
	]);
	return String(campaign.review_url);
}

export async function saveGoogleConnection(
	input: Record<string, unknown> & { businessId: string },
) {
	const now = new Date();
	await (await db())
		.collection("google_business_connections")
		.updateOne(
			{ businessId: input.businessId },
			{ $set: { ...input, updatedAt: now }, $setOnInsert: { createdAt: now } },
			{ upsert: true },
		);
}

export async function listReviews(
	businessId: string,
): Promise<Array<Record<string, unknown>>> {
	const database = await db();
	const reviews = await database
		.collection("google_reviews")
		.find({ businessId })
		.sort({ createdAt: -1 })
		.toArray();
	const campaignIds = [
		...new Set(
			reviews
				.flatMap((review) => [
					review.matchedCampaignId,
					...(Array.isArray(review.candidateCampaignIds)
						? review.candidateCampaignIds
						: []),
				])
				.filter(Boolean)
				.map(String),
		),
	];
	const campaigns = campaignIds.length
		? await database
				.collection("campaigns")
				.find({ id: { $in: campaignIds } })
				.toArray()
		: [];
	const byId = new Map(
		campaigns.map((campaign) => [String(campaign.id), campaign]),
	);
	return reviews
		.map(
			(review): Record<string, unknown> => ({
				...review,
				matchedCampaign: review.matchedCampaignId
					? byId.get(String(review.matchedCampaignId))
					: null,
				candidateCampaigns: (Array.isArray(review.candidateCampaignIds)
					? review.candidateCampaignIds
					: []
				)
					.map((id) => byId.get(String(id)))
					.filter(Boolean),
			}),
		)
		.sort((a, b) => {
			const priority = (row: Record<string, unknown>) =>
				row.sentiment === "negative" && row.resolutionState === "unaddressed"
					? 1
					: 0;
			return (
				priority(b) - priority(a) ||
				new Date(String(b.createdAt)).getTime() -
					new Date(String(a.createdAt)).getTime()
			);
		});
}

export async function loadEligibleCampaigns(businessId: string) {
	const rows = await (await db())
		.collection("campaigns")
		.find({
			$and: [
				{ $or: [{ businessId }, { business_id: businessId }] },
				{ $or: [{ review_sent: true }, { reviewSent: true }] },
				{ review_left: { $ne: true } },
			],
		})
		.toArray();
	return rows.flatMap((row) => {
		const sent = new Date(String(row.review_sent_at ?? row.reviewSentAt ?? ""));
		if (Number.isNaN(sent.valueOf())) return [];
		return [
			{
				id: String(row.id),
				businessId,
				customerName: String(row.customer_name ?? row.customerName ?? ""),
				reviewSentAt: sent,
				firstClickedAt: row.first_clicked_at
					? new Date(String(row.first_clicked_at))
					: null,
			},
		];
	});
}

export async function upsertGoogleReview(input: {
	businessId: string;
	locationId: string;
	review: GoogleReviewInput;
	match: ReviewMatchResult;
}) {
	const sentiment = await classifyReviewSentiment({
		stars: input.review.stars,
		text: input.review.text,
	});
	const now = new Date();
	const collection = (await db()).collection("google_reviews");
	const existing = await collection.findOne({
		businessId: input.businessId,
		googleReviewId: input.review.id,
	});
	const preserveMemberDecision = existing?.memberMatchDecision === true;
	const preserveSentimentOverride = existing?.sentimentOverridden === true;
	const sentimentFields = preserveSentimentOverride
		? {}
		: {
				sentiment: sentiment.label,
				sentimentConfidence: sentiment.confidence,
				sentimentReason: sentiment.reason,
				sentimentNeedsReview: sentiment.needsReview,
			};
	const matchFields = preserveMemberDecision
		? {}
		: {
				matchState:
					input.match.kind === "automatic" ? "confirmed" : input.match.kind,
				matchedCampaignId:
					input.match.kind === "automatic" ? input.match.campaignId : null,
				candidateCampaignIds:
					input.match.kind === "manual" ? input.match.candidateCampaignIds : [],
				matchConfidence:
					input.match.kind === "automatic" ? input.match.confidence : 0,
			};
	const result = await collection.updateOne(
		{ businessId: input.businessId, googleReviewId: input.review.id },
		{
			$set: {
				locationId: input.locationId,
				reviewerName: input.review.reviewerName,
				stars: input.review.stars,
				text: input.review.text,
				createdAt: input.review.createdAt,
				googleUpdatedAt: input.review.updatedAt,
				observedAt: input.review.observedAt ?? now,
				datePrecision: input.review.datePrecision ?? "exact",
				rawDate: input.review.rawDate ?? null,
				rawSource: input.review.rawSource ?? null,
				...sentimentFields,
				...matchFields,
				updatedAt: now,
			},
			$setOnInsert: {
				businessId: input.businessId,
				googleReviewId: input.review.id,
				resolutionState: "unaddressed",
				audit: [
					{
						action: "ingested",
						at: now,
						actorId: "system",
						sentiment: {
							label: sentiment.label,
							confidence: sentiment.confidence,
							reason: sentiment.reason,
							needsReview: sentiment.needsReview,
						},
					},
				],
			},
		},
		{ upsert: true },
	);
	return {
		inserted: result.upsertedCount === 1,
		automaticMatchAccepted:
			input.match.kind === "automatic" &&
			!preserveMemberDecision &&
			existing?.matchedCampaignId !== input.match.campaignId,
	};
}

export async function completeCampaign(
	campaignId: string,
	googleReviewId: string,
	at: Date,
	businessId?: string,
) {
	const result = await (await db()).collection("campaigns").updateOne(
		{
			id: campaignId,
			$and: [
				...(businessId
					? [{ $or: [{ businessId }, { business_id: businessId }] }]
					: []),
				{
					$or: [
						{ review_left: { $ne: true } },
						{ google_review_id: googleReviewId },
					],
				},
			],
		},
		{
			$set: {
				review_left: true,
				review_left_at: at,
				google_review_id: googleReviewId,
				updated_at: at,
			},
		},
	);
	if (!result.matchedCount)
		throw new Error("Campaign is already matched or outside this Organization");
}

export async function recordSync(
	businessId: string,
	input: { success: boolean; at: Date; reason?: string },
) {
	const database = await db();
	await database.collection("google_business_connections").updateOne(
		{ businessId },
		{
			$set: input.success
				? { lastSyncSucceededAt: input.at, lastSyncError: null }
				: { lastSyncFailedAt: input.at, lastSyncError: input.reason },
		},
	);
	if (!input.success)
		await database
			.collection("campaigns")
			.updateMany(
				{ $or: [{ businessId }, { business_id: businessId }] },
				{ $unset: { google_sync_fresh_until: "" } },
			);
	if (input.success)
		await database.collection("campaigns").updateMany(
			{ $or: [{ businessId }, { business_id: businessId }] },
			{
				$set: {
					google_sync_fresh_until: new Date(
						input.at.getTime() + 60 * 60 * 1000,
					),
				},
			},
		);
}

export async function updateReviewByMember(input: {
	businessId: string;
	googleReviewId: string;
	actorId: string;
	action: "sentiment" | "resolution" | "match" | "reject" | "undo_match";
	value?: string;
	campaignId?: string;
	note?: string;
}) {
	const collection = (await db()).collection("google_reviews");
	const review = await collection.findOne({
		businessId: input.businessId,
		googleReviewId: input.googleReviewId,
	});
	if (!review) throw new Error("Review not found");
	const now = new Date();
	const changes: Record<string, unknown> = { updatedAt: now };
	if (input.action === "sentiment") {
		if (!["positive", "neutral", "negative"].includes(input.value ?? ""))
			throw new Error("Invalid sentiment");
		changes.sentiment = input.value as ReviewSentiment;
		changes.sentimentOverridden = true;
	}
	if (input.action === "resolution") {
		if (
			![
				"unaddressed",
				"contacted",
				"in_conversation",
				"resolved",
				"closed",
			].includes(input.value ?? "")
		)
			throw new Error("Invalid resolution state");
		changes.resolutionState = input.value;
		changes.resolutionNote = input.note?.slice(0, 2000) ?? "";
	}
	if (input.action === "match") {
		if (!input.campaignId) throw new Error("Campaign is required");
		if (
			!Array.isArray(review.candidateCampaignIds) ||
			!review.candidateCampaignIds.map(String).includes(input.campaignId)
		)
			throw new Error("Campaign is not an eligible match candidate");
		changes.matchState = "confirmed";
		changes.matchedCampaignId = input.campaignId;
		changes.memberMatchDecision = true;
		await completeCampaign(
			input.campaignId,
			input.googleReviewId,
			now,
			input.businessId,
		);
	}
	if (input.action === "reject") {
		changes.matchState = "rejected";
		changes.memberMatchDecision = true;
	}
	if (input.action === "undo_match") {
		if (review.matchedCampaignId)
			await (await db()).collection("campaigns").updateOne(
				{
					id: review.matchedCampaignId,
					google_review_id: input.googleReviewId,
				},
				{
					$set: {
						google_review_id: null,
						updated_at: now,
					},
				},
			);
		changes.matchState = "manual";
		changes.matchedCampaignId = null;
		changes.memberMatchDecision = true;
	}
	await collection.updateOne(
		{ businessId: input.businessId, googleReviewId: input.googleReviewId },
		{
			$set: {
				...changes,
				audit: [
					...(Array.isArray(review.audit) ? review.audit : []),
					{
						action: input.action,
						previous: {
							sentiment: review.sentiment,
							resolutionState: review.resolutionState,
							resolutionNote: review.resolutionNote,
							matchState: review.matchState,
							matchedCampaignId: review.matchedCampaignId,
						},
						value: input.value,
						campaignId: input.campaignId,
						note: input.note,
						actorId: input.actorId,
						at: now,
					},
				],
			},
		},
	);
}
