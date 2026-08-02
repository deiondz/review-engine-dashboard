const acceptedHosts = new Set([
	"g.page",
	"maps.app.goo.gl",
	"maps.google.com",
	"www.google.com",
	"google.com",
	"search.google.com",
]);

const parseAcceptedUrl = (value: string) => {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("Enter a valid Google Maps or Google review URL");
	}
	if (
		url.protocol !== "https:" ||
		!acceptedHosts.has(url.hostname.toLowerCase())
	)
		throw new Error("Enter a Google Maps or Google review URL");
	return url;
};

const mapsUrlForPlaceId = (placeId: string) => {
	const url = new URL("https://www.google.com/maps/place/");
	url.searchParams.set("q", `place_id:${placeId}`);
	return url.toString();
};

const placeIdFromUrl = (url: URL) => {
	const explicit = url.searchParams.get("placeid");
	if (explicit) return explicit;
	const query = url.searchParams.get("q") ?? "";
	return query.startsWith("place_id:")
		? query.slice("place_id:".length)
		: undefined;
};

export function googleMapsLocationId(mapsUrl: string) {
	const url = parseAcceptedUrl(mapsUrl);
	const placeId = placeIdFromUrl(url);
	if (placeId) return placeId;
	return `maps:${createHash("sha256").update(url.toString()).digest("base64url").slice(0, 22)}`;
}

export async function normalizeGoogleMapsLocationUrl(
	value: string,
	resolveRedirect: (url: string) => Promise<string> = async (url) => {
		const response = await fetch(url, { redirect: "follow" });
		return response.url;
	},
) {
	const input = parseAcceptedUrl(value.trim());
	const needsResolution =
		input.hostname === "g.page" || input.hostname === "maps.app.goo.gl";
	const resolved = needsResolution
		? parseAcceptedUrl(await resolveRedirect(input.toString()))
		: input;
	const placeId = placeIdFromUrl(resolved);
	if (placeId) return mapsUrlForPlaceId(placeId);
	if (
		resolved.hostname.endsWith("google.com") &&
		(resolved.pathname.startsWith("/maps/") ||
			resolved.hostname === "maps.google.com")
	)
		return resolved.toString();
	throw new Error("The URL does not identify a Google Maps location");
}

import { createHash } from "node:crypto";
