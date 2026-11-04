import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectScrapedReviews,
	createGoogleReviewsScraperApi,
} from "./google-reviews-scraper-client";

describe("collectScrapedReviews", () => {
	it("waits for a completed scrape and returns every normalized review page", async () => {
		let jobReads = 0;
		const result = await collectScrapedReviews(
			{ mapsUrl: "https://www.google.com/maps/place/?q=place_id:test" },
			{
				startScrape: async () => ({ jobId: "job-1" }),
				getJob: async () => ({
					status: ++jobReads === 1 ? "running" : "completed",
					reviewsCount: 2,
					placeId: "place-1",
				}),
				listPlaces: async () => [
					{
						placeId: "place-1",
						originalUrl: "https://www.google.com/maps/place/?q=place_id:test",
					},
				],
				listReviews: async (_placeId, offset) => ({
					total: 2,
					reviews:
						offset === 0
							? [
									{
										reviewId: "review-1",
										author: "Asha Sharma",
										rating: 5,
										reviewText: { en: "Excellent service" },
										reviewDate: "2026-08-01T10:00:00Z",
										rawDate: "a day ago on Google",
										lastModified: "2026-08-01T11:00:00Z",
									},
								]
							: [
									{
										reviewId: "review-2",
										author: "Ravi Kumar",
										rating: 2,
										reviewText: "Late delivery",
										reviewDate: "2026-08-02T10:00:00Z",
										lastModified: "2026-08-02T10:00:00Z",
									},
								],
				}),
			},
			{
				wait: async () => {},
				pageSize: 1,
				observedAt: new Date("2026-08-02T12:00:00Z"),
			},
		);

		assert.equal(jobReads, 2);
		assert.deepEqual(result, {
			locationId: "place-1",
			reviews: [
				{
					id: "review-1",
					reviewerName: "Asha Sharma",
					stars: 5,
					text: "Excellent service",
					createdAt: new Date("2026-08-01T10:00:00Z"),
					updatedAt: new Date("2026-08-01T11:00:00Z"),
					observedAt: new Date("2026-08-02T12:00:00Z"),
					datePrecision: "estimated",
					rawDate: "a day ago on Google",
					rawSource: undefined,
				},
				{
					id: "review-2",
					reviewerName: "Ravi Kumar",
					stars: 2,
					text: "Late delivery",
					createdAt: new Date("2026-08-02T10:00:00Z"),
					updatedAt: new Date("2026-08-02T10:00:00Z"),
					observedAt: new Date("2026-08-02T12:00:00Z"),
					datePrecision: "estimated",
					rawDate: undefined,
					rawSource: undefined,
				},
			],
		});
	});

	it("rejects a completed job that has no persisted reviews", async () => {
		await assert.rejects(
			collectScrapedReviews(
				{ mapsUrl: "https://www.google.com/maps/place/test" },
				{
					startScrape: async () => ({ jobId: "job-degraded" }),
					getJob: async () => ({ status: "completed" }),
					listPlaces: async () => [
						{
							placeId: "place-1",
							originalUrl: "https://www.google.com/maps/place/test",
						},
					],
					listReviews: async () => ({ total: 0, reviews: [] }),
				},
				{ wait: async () => {} },
			),
			/degraded scrape/i,
		);
	});
});

describe("createGoogleReviewsScraperApi", () => {
	it("preserves every field from each review endpoint row", async () => {
		const endpointRow = {
			review_id: "review-raw",
			author: "Asha",
			rating: 5,
			review_text: { en: "Excellent" },
			review_date: "2026-08-01T10:00:00Z",
			profile_url: "https://www.google.com/maps/contrib/example",
			likes: 3,
			custom_params: { source: "debug" },
		};
		const api = createGoogleReviewsScraperApi(
			{ baseUrl: "http://scraper:8000", apiKey: "secret" },
			async () =>
				new Response(JSON.stringify({ total: 1, reviews: [endpointRow] })),
		);

		const result = await api.listReviews("place-1", 0, 250);
		assert.deepEqual(result.reviews[0].rawSource, endpointRow);
	});

	it("authenticates and translates the scraper REST representation", async () => {
		const requests: Array<{ url: string; apiKey: string | null }> = [];
		const fetcher: typeof fetch = async (input, init) => {
			const url = String(input);
			requests.push({
				url,
				apiKey: new Headers(init?.headers).get("x-api-key"),
			});
			return new Response(
				JSON.stringify(
					url.endsWith("/scrape")
						? { job_id: "job-7" }
						: {
								job_id: "job-7",
								status: "failed",
								error_message: "captcha",
								reviews_count: 0,
								place_id: "place-7",
							},
				),
				{ status: url.endsWith("/scrape") ? 202 : 200 },
			);
		};
		const api = createGoogleReviewsScraperApi(
			{ baseUrl: "http://scraper:8000", apiKey: "secret" },
			fetcher,
		);

		assert.deepEqual(
			await api.startScrape({
				mapsUrl: "https://www.google.com/maps/place/test",
			}),
			{ jobId: "job-7" },
		);
		assert.deepEqual(await api.getJob("job-7"), {
			status: "failed",
			errorMessage: "captcha",
			reviewsCount: 0,
			placeId: "place-7",
		});
		assert.equal(requests.length, 2);
		assert.ok(requests.every((request) => request.apiKey === "secret"));
	});
});
