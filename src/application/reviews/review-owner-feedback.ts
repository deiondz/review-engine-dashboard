export function reviewOwnerFeedback(rawSource: Record<string, unknown>) {
	const responses = rawSource.owner_responses;
	if (!responses || typeof responses !== "object" || Array.isArray(responses))
		return null;
	const localized = responses as Record<string, unknown>;
	const candidates = [localized.en, ...Object.values(localized)];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim())
			return candidate.trim();
		if (
			candidate &&
			typeof candidate === "object" &&
			!Array.isArray(candidate)
		) {
			const text = (candidate as Record<string, unknown>).text;
			if (typeof text === "string" && text.trim()) return text.trim();
		}
	}
	return null;
}
