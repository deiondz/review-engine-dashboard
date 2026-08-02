import { NextResponse, userAgent } from "next/server";
import { recordReviewClick } from "@/infrastructure/database/mongo/mongo-review-store";

export async function GET(
	request: Request,
	context: { params: Promise<{ token: string }> },
) {
	const { token } = await context.params;
	const agent = userAgent(request);
	const destination = await recordReviewClick(
		token,
		agent.isBot ? "bot" : (agent.device.type ?? "browser"),
	);
	if (!destination)
		return NextResponse.json({ error: "not_found" }, { status: 404 });
	return NextResponse.redirect(destination, 302);
}
