import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewOwnerFeedback } from "./review-owner-feedback";

describe("reviewOwnerFeedback", () => {
	it("extracts localized owner feedback from the scraper payload", () => {
		assert.equal(
			reviewOwnerFeedback({
				owner_responses: { en: { text: "Thank you for your review" } },
			}),
			"Thank you for your review",
		);
	});

	it("returns no feedback when the owner has not responded", () => {
		assert.equal(reviewOwnerFeedback({ owner_responses: {} }), null);
	});
});
