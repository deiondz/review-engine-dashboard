export function reviewProfileUrl(rawSource: Record<string, unknown>) {
	const candidate = String(
		rawSource.profile_url ?? rawSource.author_profile_url ?? "",
	).trim();
	if (!candidate) return null;
	try {
		const url = new URL(candidate);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: null;
	} catch {
		return null;
	}
}
