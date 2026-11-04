"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
	googleMapsLocationId,
	normalizeGoogleMapsLocationUrl,
} from "@/application/reviews/google-maps-location";
import {
	saveGoogleConnection,
	updateReviewByMember,
} from "@/infrastructure/database/mongo/mongo-review-store";
import { auth } from "@/lib/auth";

const reviewActions = [
	"sentiment",
	"resolution",
	"match",
	"reject",
	"undo_match",
] as const;
type ReviewAction = (typeof reviewActions)[number];

async function member() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) throw new Error("Not authenticated");
	const businessId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	if (!businessId) throw new Error("Select an organization first");
	return { businessId, actorId: session.user.id };
}

export async function configureGoogleMapsLocationAction(formData: FormData) {
	const identity = await member();
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	const organization = await auth.api.getFullOrganization({
		headers: requestHeaders,
	});
	const membership = organization?.members.find(
		(item) => item.userId === session?.user.id,
	);
	if (!membership || !["owner", "admin"].includes(membership.role))
		throw new Error(
			"An Organization administrator must configure the Google location",
		);
	const mapsUrl = await normalizeGoogleMapsLocationUrl(
		String(formData.get("mapsUrl") ?? ""),
	);
	await saveGoogleConnection({
		businessId: identity.businessId,
		mapsUrl,
		locationId: googleMapsLocationId(mapsUrl),
		source: "google_maps_scraper",
	});
	revalidatePath("/reviews");
	revalidatePath("/settings/account");
}

export async function updateReviewAction(formData: FormData) {
	const identity = await member();
	const rawAction = String(formData.get("action") ?? "");
	if (!reviewActions.includes(rawAction as ReviewAction))
		throw new Error("Invalid review action");
	await updateReviewByMember({
		...identity,
		googleReviewId: String(formData.get("googleReviewId") ?? ""),
		action: rawAction as ReviewAction,
		value: String(formData.get("value") ?? "") || undefined,
		campaignId: String(formData.get("campaignId") ?? "") || undefined,
		note: String(formData.get("note") ?? "") || undefined,
	});
	revalidatePath("/reviews");
}
