import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterReviews } from "./review-filters";

const reviews = [
	{
		googleReviewId: "one",
		reviewerName: "Asha Sharma",
		text: "Wonderful stay",
		stars: 5,
		sentiment: "positive",
		matchState: "confirmed",
		resolutionState: "resolved",
	},
	{
		googleReviewId: "two",
		reviewerName: "Ravi Kumar",
		text: "Room was noisy",
		stars: 2,
		sentiment: "negative",
		matchState: "unmatched",
		resolutionState: "unaddressed",
	},
];

describe("filterReviews", () => {
	it("combines search and compact review facets", () => {
		assert.deepEqual(
			filterReviews(reviews, {
				query: "ravi",
				rating: "2",
				sentiment: "negative",
				matchState: "unmatched",
				resolutionState: "unaddressed",
			}).map((review) => review.googleReviewId),
			["two"],
		);
	});
});
