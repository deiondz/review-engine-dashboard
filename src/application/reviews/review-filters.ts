export type ReviewFilterValues = {
	query: string;
	rating: string;
	sentiment: string;
	matchState: string;
	resolutionState: string;
};

type FilterableReview = {
	reviewerName?: unknown;
	text?: unknown;
	stars?: unknown;
	sentiment?: unknown;
	matchState?: unknown;
	resolutionState?: unknown;
};

export function filterReviews<T extends FilterableReview>(
	reviews: T[],
	filters: ReviewFilterValues,
) {
	const query = filters.query.trim().toLocaleLowerCase("en");
	return reviews.filter((review) => {
		const searchable =
			`${String(review.reviewerName ?? "")} ${String(review.text ?? "")}`.toLocaleLowerCase(
				"en",
			);
		return (
			(!query || searchable.includes(query)) &&
			(filters.rating === "all" || String(review.stars) === filters.rating) &&
			(filters.sentiment === "all" ||
				String(review.sentiment) === filters.sentiment) &&
			(filters.matchState === "all" ||
				String(review.matchState) === filters.matchState) &&
			(filters.resolutionState === "all" ||
				String(review.resolutionState) === filters.resolutionState)
		);
	});
}
