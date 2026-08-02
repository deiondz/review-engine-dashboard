export type ReviewSentiment = "positive" | "neutral" | "negative";

export type ReviewSentimentResult = {
	label: ReviewSentiment;
	confidence: number;
	reason: string;
	needsReview: boolean;
};

const negativeWords =
	/\b(?:awful|bad|broken|complaint|dangerous|disappointed|horrible|poor|refund|terrible|unhappy|unresolved|unsafe|worst)\b/i;
const positiveWords =
	/\b(?:affordable|amazing|awesome|beautiful|best|clean|comfortable|delightful|excellent|fantastic|friendly|good|great|helpful|highly recommend(?:ed)?|hygienic|loved?|lovely|neat|nice|perfect|pleasant|recommend(?:ed)?|satisfied|wonderful)\b/i;

export function fallbackReviewSentiment(input: {
	stars: number;
	text: string;
}): ReviewSentimentResult {
	const hasNegativeText = negativeWords.test(input.text);
	const hasPositiveText = positiveWords.test(input.text);
	const ratingLabel: ReviewSentiment | null =
		input.stars <= 0
			? null
			: input.stars <= 2
				? "negative"
				: input.stars === 3
					? "neutral"
					: "positive";
	const textLabel = hasNegativeText
		? "negative"
		: hasPositiveText
			? "positive"
			: null;
	const contradiction =
		textLabel !== null && ratingLabel !== null && textLabel !== ratingLabel;
	const label = textLabel ?? ratingLabel ?? "neutral";
	return {
		label,
		confidence: input.text.trim()
			? contradiction
				? 0.65
				: textLabel
					? 0.8
					: 0.5
			: ratingLabel
				? 0.9
				: 0,
		reason: textLabel
			? ratingLabel
				? "Derived from review wording and star rating"
				: "Derived from review wording; star rating is unavailable"
			: ratingLabel
				? "Derived from star rating because the review has no clear sentiment text"
				: "Insufficient review text and no star rating available",
		needsReview: contradiction || (textLabel === null && ratingLabel === null),
	};
}

export async function classifyReviewSentiment(input: {
	stars: number;
	text: string;
}): Promise<ReviewSentimentResult> {
	const fallback = fallbackReviewSentiment(input);
	if (!input.text.trim()) return fallback;
	const { default: env } = await import("@/../env.config");
	if (!env.SARVAM_API_KEY) return fallback;
	try {
		const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"api-subscription-key": env.SARVAM_API_KEY,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "sarvam-30b",
				temperature: 0,
				max_tokens: 180,
				reasoning_effort: "low",
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content:
							"Classify a Google review. Return JSON with label (positive, neutral, or negative), confidence from 0 to 1, reason, and needsReview. Consider both text and stars. Set needsReview true when they strongly contradict.",
					},
					{ role: "user", content: JSON.stringify(input) },
				],
			}),
		});
		if (!response.ok) return fallback;
		const body = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const parsed = JSON.parse(
			body.choices?.[0]?.message?.content ?? "{}",
		) as Partial<ReviewSentimentResult>;
		if (!["positive", "neutral", "negative"].includes(parsed.label ?? ""))
			return fallback;
		return {
			label: parsed.label as ReviewSentiment,
			confidence: Math.max(
				0,
				Math.min(1, Number(parsed.confidence ?? fallback.confidence)),
			),
			reason: String(parsed.reason ?? fallback.reason).slice(0, 500),
			needsReview: parsed.needsReview === true,
		};
	} catch {
		return fallback;
	}
}
