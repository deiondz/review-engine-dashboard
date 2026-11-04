import { NextResponse } from "next/server";
import env from "@/../env.config";
import { runAllReviewSyncs } from "@/composition/review-sync-container";

export async function POST(request: Request) {
	if (
		!env.REVIEW_SYNC_SECRET ||
		request.headers.get("authorization") !== `Bearer ${env.REVIEW_SYNC_SECRET}`
	)
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	const result = await runAllReviewSyncs();
	return NextResponse.json(result, { status: result.failed ? 503 : 200 });
}
