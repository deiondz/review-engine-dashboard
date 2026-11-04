import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	googleMapsLocationId,
	normalizeGoogleMapsLocationUrl,
} from "./google-maps-location";

describe("normalizeGoogleMapsLocationUrl", () => {
	it("converts a Google review link into the Maps location URL required by the scraper", async () => {
		const result = await normalizeGoogleMapsLocationUrl(
			"https://g.page/r/example/review",
			async () =>
				"https://search.google.com/local/writereview?placeid=ChIJExample123&source=g.page",
		);

		assert.equal(
			result,
			"https://www.google.com/maps/place/?q=place_id%3AChIJExample123",
		);
	});

	it("uses the canonical Google Place ID as the Business location identity", () => {
		assert.equal(
			googleMapsLocationId(
				"https://www.google.com/maps/place/?q=place_id%3AChIJExample123",
			),
			"ChIJExample123",
		);
	});

	it("accepts a full Google Maps place URL when it has no public Place ID", async () => {
		const mapsUrl =
			"https://www.google.com/maps/place/Costa+Homestay/@13.37,74.70,17z/data=!4m8!1s0x3bbcbd7325164447:0x4a2afa7dec8591a8";
		assert.equal(await normalizeGoogleMapsLocationUrl(mapsUrl), mapsUrl);
		assert.match(googleMapsLocationId(mapsUrl), /^maps:/);
	});
});
