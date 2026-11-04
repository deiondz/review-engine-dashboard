import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fallbackReviewSentiment } from "./review-sentiment";

describe("fallbackReviewSentiment", () => {
	it("classifies reviews without text from their stars", () => {
		assert.equal(
			fallbackReviewSentiment({ stars: 1, text: "" }).label,
			"negative",
		);
		assert.equal(
			fallbackReviewSentiment({ stars: 3, text: "" }).label,
			"neutral",
		);
		assert.equal(
			fallbackReviewSentiment({ stars: 5, text: "" }).label,
			"positive",
		);
	});

	it("flags a strong rating and text contradiction", () => {
		const result = fallbackReviewSentiment({
			stars: 5,
			text: "Terrible service, the problem is still unresolved.",
		});

		assert.equal(result.label, "negative");
		assert.equal(result.needsReview, true);
	});

	it("does not treat an unavailable zero rating as negative evidence", () => {
		const result = fallbackReviewSentiment({
			stars: 0,
			text: "The room was very neat, clean and organized. We had a pleasant stay.",
		});

		assert.equal(result.label, "positive");
		assert.equal(result.needsReview, false);
	});
});
