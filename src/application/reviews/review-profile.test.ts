import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewProfileUrl } from "./review-profile";

describe("reviewProfileUrl", () => {
	it("returns the scraper profile URL for a review card", () => {
		assert.equal(
			reviewProfileUrl({
				profile_url: "https://www.google.com/maps/contrib/123/reviews",
			}),
			"https://www.google.com/maps/contrib/123/reviews",
		);
	});

	it("omits missing and unsafe profile URLs", () => {
		assert.equal(reviewProfileUrl({}), null);
		assert.equal(
			reviewProfileUrl({ profile_url: "javascript:alert(1)" }),
			null,
		);
	});
});
