import type { GoogleReviewInput } from "@/application/reviews/review-sync";

type ScraperJobStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

type ScrapedReview = {
	reviewId: string;
	author?: string;
	rating?: number;
	reviewText?: unknown;
	reviewDate?: string;
	rawDate?: string;
	lastModified?: string;
	rawSource?: Record<string, unknown>;
};

export type GoogleReviewsScraperApi = {
	startScrape(input: { mapsUrl: string }): Promise<{ jobId: string }>;
	getJob(jobId: string): Promise<{
		status: ScraperJobStatus;
		errorMessage?: string;
		reviewsCount?: number;
		placeId?: string;
	}>;
	listPlaces(): Promise<Array<{ placeId: string; originalUrl: string }>>;
	listReviews(
		placeId: string,
		offset: number,
		limit: number,
	): Promise<{ total: number; reviews: ScrapedReview[] }>;
};

const scraperRequest = async <T>(
	baseUrl: string,
	apiKey: string,
	path: string,
	fetcher: typeof fetch,
	init?: RequestInit,
): Promise<T> => {
	const headers = new Headers(init?.headers);
	headers.set("x-api-key", apiKey);
	if (init?.body) headers.set("content-type", "application/json");
	const response = await fetcher(
		new URL(path, `${baseUrl.replace(/\/$/, "")}/`),
		{
			...init,
			headers,
		},
	);
	if (!response.ok) {
		const detail = await response.text();
		throw new Error(
			`Review scraper request failed (${response.status})${detail ? `: ${detail}` : ""}`,
		);
	}
	return (await response.json()) as T;
};

export function createGoogleReviewsScraperApi(
	config: { baseUrl: string; apiKey: string },
	fetcher: typeof fetch = fetch,
): GoogleReviewsScraperApi {
	return {
		startScrape: async ({ mapsUrl }) => {
			const body = await scraperRequest<{ job_id: string }>(
				config.baseUrl,
				config.apiKey,
				"scrape",
				fetcher,
				{
					method: "POST",
					body: JSON.stringify({
						url: mapsUrl,
						headless: true,
						sort_by: "newest",
						scrape_mode: "update",
						download_images: false,
						date_filter: { mode: "early_stop" },
					}),
				},
			);
			return { jobId: body.job_id };
		},
		getJob: async (jobId) => {
			const body = await scraperRequest<{
				status: ScraperJobStatus;
				error_message?: string;
				reviews_count?: number;
				place_id?: string;
			}>(
				config.baseUrl,
				config.apiKey,
				`jobs/${encodeURIComponent(jobId)}`,
				fetcher,
			);
			return {
				status: body.status,
				errorMessage: body.error_message,
				reviewsCount: body.reviews_count,
				placeId: body.place_id,
			};
		},
		listPlaces: async () => {
			const body = await scraperRequest<
				Array<{ place_id: string; original_url: string }>
			>(config.baseUrl, config.apiKey, "places", fetcher);
			return body.map((item) => ({
				placeId: item.place_id,
				originalUrl: item.original_url,
			}));
		},
		listReviews: async (placeId, offset, limit) => {
			const query = new URLSearchParams({
				offset: String(offset),
				limit: String(limit),
			});
			const body = await scraperRequest<{
				total: number;
				reviews: Array<
					Record<string, unknown> & {
						review_id: string;
						author?: string;
						rating?: number;
						review_text?: unknown;
						review_date?: string;
						raw_date?: string;
						last_modified?: string;
					}
				>;
			}>(
				config.baseUrl,
				config.apiKey,
				`reviews/${encodeURIComponent(placeId)}?${query}`,
				fetcher,
			);
			return {
				total: body.total,
				reviews: body.reviews.map((item) => ({
					reviewId: item.review_id,
					author: item.author,
					rating: item.rating,
					reviewText: item.review_text,
					reviewDate: item.review_date,
					rawDate: item.raw_date,
					lastModified: item.last_modified,
					rawSource: item,
				})),
			};
		},
	};
}

const reviewText = (value: unknown) => {
	if (typeof value === "string") return value;
	if (Array.isArray(value))
		return value.filter((item) => typeof item === "string").join(" ");
	if (value && typeof value === "object") {
		const translations = Object.values(value).filter(
			(item): item is string =>
				typeof item === "string" && Boolean(item.trim()),
		);
		return translations[0] ?? "";
	}
	return "";
};

const date = (value: string | undefined, fallback?: Date) => {
	const parsed = value ? new Date(value) : fallback;
	if (!parsed || Number.isNaN(parsed.valueOf()))
		throw new Error("Scraper returned a review without a usable date");
	return parsed;
};

export async function collectScrapedReviews(
	input: { mapsUrl: string },
	api: GoogleReviewsScraperApi,
	options: {
		wait?: (milliseconds: number) => Promise<void>;
		pollMilliseconds?: number;
		maxPolls?: number;
		pageSize?: number;
		observedAt?: Date;
	} = {},
): Promise<{ locationId: string; reviews: GoogleReviewInput[] }> {
	const wait =
		options.wait ??
		((milliseconds) =>
			new Promise((resolve) => setTimeout(resolve, milliseconds)));
	const { jobId } = await api.startScrape(input);
	let completed = false;
	let completedPlaceId: string | undefined;
	for (let poll = 0; poll < (options.maxPolls ?? 120); poll += 1) {
		const job = await api.getJob(jobId);
		if (job.status === "completed") {
			completedPlaceId = job.placeId;
			completed = true;
			break;
		}
		if (job.status === "failed" || job.status === "cancelled")
			throw new Error(job.errorMessage || `Scrape ${job.status}`);
		await wait(options.pollMilliseconds ?? 5_000);
	}
	if (!completed) throw new Error("Scrape timed out");

	const places = await api.listPlaces();
	const place = places.find(
		(item) =>
			(completedPlaceId && item.placeId === completedPlaceId) ||
			item.originalUrl === input.mapsUrl,
	);
	if (!place)
		throw new Error(
			"Scraper completed without registering the Google Maps location",
		);

	const pageSize = options.pageSize ?? 250;
	const observedAt = options.observedAt ?? new Date();
	const scraped: ScrapedReview[] = [];
	let total = 0;
	do {
		const page = await api.listReviews(place.placeId, scraped.length, pageSize);
		total = page.total;
		if (!page.reviews.length && scraped.length < total)
			throw new Error("Scraper returned an incomplete review page");
		scraped.push(...page.reviews);
	} while (scraped.length < total);
	if (total <= 0 || scraped.length <= 0)
		throw new Error("Degraded scrape: completed without persisted reviews");

	return {
		locationId: place.placeId,
		reviews: scraped.map((item) => {
			const createdAt = date(item.reviewDate);
			return {
				id: item.reviewId,
				reviewerName: item.author || "Anonymous",
				stars: Number(item.rating ?? 0),
				text: reviewText(item.reviewText),
				createdAt,
				updatedAt: date(item.lastModified, createdAt),
				observedAt,
				datePrecision: "estimated",
				rawDate: item.rawDate,
				rawSource: item.rawSource,
			};
		}),
	};
}
