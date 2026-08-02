"use server";

import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import env from "@/../env.config";
import { connectDatabase } from "@/composition/database-container";
import { auth } from "@/lib/auth";

async function organizationId() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) throw new Error("Not authenticated");
	const id = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	if (!id) throw new Error("Select an organization first");
	return id;
}

async function request(path: string, body: Record<string, unknown>) {
	const response = await fetch(new URL(path, env.MESSAGING_SERVICE_URL), {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.MESSAGING_SERVICE_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
		cache: "no-store",
	});
	if (!response.ok)
		throw new Error(
			`Messaging service rejected the operation (${response.status})`,
		);
	return response.headers.get("content-type")?.includes("application/json")
		? await response.json()
		: null;
}

export type ReviewSubmissionState = {
	status: "idle" | "success" | "error";
	message: string;
	jobId?: string;
};

export async function submitCompletedJob(
	_previous: ReviewSubmissionState,
	formData: FormData,
): Promise<ReviewSubmissionState> {
	try {
		const businessId = await organizationId();
		const jobId = `dashboard-${randomUUID()}`;
		const phone = String(formData.get("phone") ?? "").trim();
		if (!/^\+[1-9][0-9]{7,14}$/.test(phone))
			throw new Error(
				"Use an international phone number such as +919876543210",
			);
		const reviewUrl = String(formData.get("reviewUrl") ?? "").trim();
		let parsedReviewUrl: URL;
		try {
			parsedReviewUrl = new URL(reviewUrl);
		} catch {
			throw new Error("Enter a valid Google review URL");
		}
		if (parsedReviewUrl.protocol !== "https:")
			throw new Error("Google review URL must use HTTPS");
		const completed = new Date(String(formData.get("completedAt") ?? ""));
		if (Number.isNaN(completed.valueOf()))
			throw new Error("Enter a valid completion time");
		await request("/automation/reviews", {
			businessId,
			customerName: String(formData.get("customerName") ?? "").trim(),
			phone,
			ownerName: String(formData.get("ownerName") ?? "").trim(),
			reviewUrl,
			jobId,
			completedAt: completed.toISOString(),
		});
		revalidatePath("/");
		revalidatePath("/automation");
		return {
			status: "success",
			message: "Review workflow accepted",
			jobId,
		};
	} catch (error) {
		return {
			status: "error",
			message:
				error instanceof Error ? error.message : "Could not start workflow",
		};
	}
}

export async function markReviewCompleted(formData: FormData) {
	const businessId = await organizationId();
	const campaignId = String(formData.get("campaignId") ?? "").trim();
	if (!campaignId || campaignId.length > 300)
		throw new Error("Invalid campaign");

	await connectDatabase();
	const reviews = mongoose.connection.getClient().db(env.REVIEWS_DATABASE_NAME);
	const completedAt = new Date();
	const result = await reviews.collection("campaigns").updateOne(
		{
			id: campaignId,
			$or: [{ businessId }, { business_id: businessId }],
		},
		{
			$set: {
				review_left: true,
				review_left_at: completedAt,
				updated_at: completedAt,
			},
		},
	);

	if (result.matchedCount !== 1) throw new Error("Campaign not found");
	revalidatePath("/");
	revalidatePath("/automation");
}

export async function markFeedbackResolved(formData: FormData) {
	const businessId = await organizationId();
	const replyId = String(formData.get("replyId") ?? "").trim();
	if (!replyId || replyId.length > 300) throw new Error("Invalid reply");

	await connectDatabase();
	const reviews = mongoose.connection.getClient().db(env.REVIEWS_DATABASE_NAME);
	const resolvedAt = new Date();
	const result = await reviews.collection("replies").updateOne(
		{
			id: replyId,
			$or: [{ businessId }, { business_id: businessId }],
		},
		{
			$set: {
				needs_review: false,
				review_status: "resolved",
				resolved_at: resolvedAt,
				updated_at: resolvedAt,
			},
		},
	);

	if (result.matchedCount !== 1) throw new Error("Reply not found");
	revalidatePath("/");
	revalidatePath("/automation");
}

export async function sendManualReminder(formData: FormData) {
	const businessId = await organizationId();
	const campaignId = String(formData.get("campaignId") ?? "").trim();
	if (!campaignId || campaignId.length > 300)
		throw new Error("Invalid campaign");

	await connectDatabase();
	const reviews = mongoose.connection.getClient().db(env.REVIEWS_DATABASE_NAME);
	const campaign = await reviews.collection("campaigns").findOne({
		id: campaignId,
		$or: [{ businessId }, { business_id: businessId }],
	});
	if (!campaign) throw new Error("Campaign not found");
	if (campaign.review_left === true)
		throw new Error("Review is already complete");
	if (campaign.reminder_sent === true)
		throw new Error("A reminder has already been sent");
	const needsReview = await reviews.collection("replies").findOne({
		customer_id: campaign.id,
		$or: [
			{ needs_review: true },
			{ sentiment: "negative", review_status: { $ne: "resolved" } },
		],
	});
	if (needsReview) throw new Error("Resolve negative feedback before sending");

	await request("/messages/send", {
		businessId,
		phone: campaign.phone,
		message: `Hi ${campaign.customer_name}, just a friendly reminder—if you have a moment, we'd appreciate your Google review. ${campaign.review_url}`,
		idempotencyKey: `${businessId}:${campaign.job_id}:manual-reminder`,
	});
	const sentAt = new Date();
	await reviews.collection("campaigns").updateOne(
		{ id: campaignId, $or: [{ businessId }, { business_id: businessId }] },
		{
			$set: {
				reminder_sent: true,
				reminder_sent_at: sentAt,
				updated_at: sentAt,
			},
		},
	);
	revalidatePath("/");
	revalidatePath("/automation");
}

export async function connectSession(formData: FormData) {
	const businessId = await organizationId();
	const authType = formData.get("authType") === "pairing" ? "pairing" : "qr";
	const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
	await request("/sessions/connect", {
		businessId,
		name: String(formData.get("name") || "main"),
		authType,
		...(phoneNumber ? { phoneNumber } : {}),
	});
	revalidatePath("/");
}

export async function disconnectSession(formData: FormData) {
	const businessId = await organizationId();
	await request("/sessions/disconnect", {
		businessId,
		sessionId: String(formData.get("sessionId")),
	});
	revalidatePath("/");
}

export async function deleteSession(formData: FormData) {
	const businessId = await organizationId();
	await request("/sessions/delete", {
		businessId,
		sessionId: String(formData.get("sessionId")),
	});
	revalidatePath("/");
}

export async function retryMessage(formData: FormData) {
	const businessId = await organizationId();
	const id = String(formData.get("messageId"));
	await request(`/messages/${encodeURIComponent(id)}/retry`, { businessId });
	revalidatePath("/");
}
