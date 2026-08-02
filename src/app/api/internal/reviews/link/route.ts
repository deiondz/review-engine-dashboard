import { NextResponse } from "next/server";
import env from "@/../env.config";
import { createTrackedReviewLink } from "@/infrastructure/database/mongo/mongo-review-store";

export async function POST(request: Request) {
	if (
		!env.REVIEW_SYNC_SECRET ||
		request.headers.get("authorization") !== `Bearer ${env.REVIEW_SYNC_SECRET}`
	)
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	const body = (await request.json()) as { campaignId?: string };
	if (!body.campaignId)
		return NextResponse.json({ error: "campaign_required" }, { status: 400 });
	try {
		const base = env.BETTER_AUTH_URL ?? "http://review-engine-dashboard:3002";
		return NextResponse.json({
			trackedReviewUrl: await createTrackedReviewLink(body.campaignId, base),
		});
	} catch {
		return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
	}
}
