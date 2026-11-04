export type ReviewMatchCampaign = {
	id: string;
	businessId: string;
	customerName: string;
	reviewSentAt: Date;
	firstClickedAt?: Date | null;
};

export type MatchableGoogleReview = {
	businessId: string;
	reviewerName: string;
	createdAt: Date;
};

export type ReviewMatchResult =
	| {
			kind: "automatic";
			campaignId: string;
			confidence: number;
			reason: "unique_exact_name";
	  }
	| { kind: "manual"; candidateCampaignIds: string[] }
	| { kind: "unmatched"; candidateCampaignIds: [] };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const normalizedName = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase("en")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");

export function matchGoogleReview(
	review: MatchableGoogleReview,
	campaigns: ReviewMatchCampaign[],
): ReviewMatchResult {
	const reviewName = normalizedName(review.reviewerName);
	const eligible = campaigns.filter(
		(campaign) =>
			campaign.businessId === review.businessId &&
			campaign.reviewSentAt <= review.createdAt &&
			review.createdAt.getTime() - campaign.reviewSentAt.getTime() <=
				THIRTY_DAYS_MS,
	);
	const exact = eligible.filter(
		(campaign) => normalizedName(campaign.customerName) === reviewName,
	);

	if (exact.length === 1) {
		return {
			kind: "automatic",
			campaignId: exact[0].id,
			confidence: 1,
			reason: "unique_exact_name",
		};
	}
	if (eligible.length > 0) {
		const reviewTokens = new Set(reviewName.split(" ").filter(Boolean));
		const score = (campaign: ReviewMatchCampaign) => {
			const tokens = normalizedName(campaign.customerName).split(" ");
			const overlap = tokens.filter((token) => reviewTokens.has(token)).length;
			const clickedRecently =
				campaign.firstClickedAt != null &&
				campaign.firstClickedAt <= review.createdAt &&
				review.createdAt.getTime() - campaign.firstClickedAt.getTime() <=
					7 * 24 * 60 * 60 * 1000;
			return (
				overlap * 10 +
				(clickedRecently ? 3 : 0) +
				campaign.reviewSentAt.getTime() / 1e15
			);
		};
		return {
			kind: "manual",
			candidateCampaignIds: [...eligible]
				.sort((a, b) => score(b) - score(a))
				.map(({ id }) => id),
		};
	}
	return { kind: "unmatched", candidateCampaignIds: [] };
}
