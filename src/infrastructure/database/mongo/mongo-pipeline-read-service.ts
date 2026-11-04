import "server-only";
import mongoose from "mongoose";
import QRCode from "qrcode";
import env from "@/../env.config";
import type {
	PipelineReadService,
	PipelineSnapshot,
} from "@/application/ports/outbound/pipeline-read-service";
import { connectDatabase } from "@/composition/database-container";

const plain = (
	documents: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> =>
	documents.map(({ _id, ...document }) => ({
		id: document.id ?? String(_id),
		...document,
	}));

const reviewRecord = (document: Record<string, unknown>) => ({
	...document,
	id: document.id ?? String(document._id),
	businessId: document.businessId ?? document.business_id,
	jobId: document.jobId ?? document.job_id,
	customerId: document.customerId ?? document.customer_id,
	customerName: document.customerName ?? document.customer_name,
	phone: document.phone,
	ownerName: document.ownerName ?? document.owner_name,
	reviewUrl: document.reviewUrl ?? document.review_url,
	completedAt: document.completedAt ?? document.completed_at,
	checkinSent: document.checkinSent ?? document.checkin_sent,
	reviewSent: document.reviewSent ?? document.review_sent,
	reviewLeft: document.reviewLeft ?? document.review_left,
	reviewLeftAt: document.reviewLeftAt ?? document.review_left_at,
	reminderSent: document.reminderSent ?? document.reminder_sent,
	message: document.message,
	sentiment: document.sentiment,
	sentimentReason:
		document.sentimentReason ?? document.sentiment_reason ?? document.reason,
	needsReview: document.needsReview ?? document.needs_review,
	reviewStatus: document.reviewStatus ?? document.review_status,
	receivedAt: document.receivedAt ?? document.received_at,
	updatedAt: document.updatedAt ?? document.updated_at,
});

export class MongoPipelineReadService implements PipelineReadService {
	async getSnapshot(businessId: string): Promise<PipelineSnapshot> {
		await connectDatabase();
		const client = mongoose.connection.getClient();
		const reviews = client.db(env.REVIEWS_DATABASE_NAME);
		const messaging = client.db(env.MESSAGING_DATABASE_NAME);
		const reviewScope = {
			$or: [{ businessId }, { business_id: businessId }],
		};
		const messagingScope = { businessId };
		const [
			campaigns,
			replies,
			messages,
			sessions,
			campaignCount,
			activeCampaigns,
			reviewRequestsSent,
			reviewsPosted,
			replyCount,
			customersReplied,
			positiveReplies,
			needsReview,
			messageCount,
			failedMessages,
		] = await Promise.all([
			reviews
				.collection("campaigns")
				.find(reviewScope)
				.sort({ updatedAt: -1, createdAt: -1 })
				.limit(200)
				.toArray(),
			reviews
				.collection("replies")
				.find(reviewScope)
				.sort({ receivedAt: -1, createdAt: -1 })
				.limit(200)
				.toArray(),
			messaging
				.collection("messaging_messages")
				.find(messagingScope)
				.sort({ createdAt: -1 })
				.limit(200)
				.toArray(),
			messaging
				.collection("messaging_sessions")
				.find(messagingScope)
				.sort({ name: 1 })
				.toArray(),
			reviews.collection("campaigns").countDocuments(reviewScope),
			reviews.collection("campaigns").countDocuments({
				$and: [reviewScope, { review_left: { $ne: true } }],
			}),
			reviews.collection("campaigns").countDocuments({
				$and: [reviewScope, { review_sent: true }],
			}),
			reviews.collection("campaigns").countDocuments({
				$and: [reviewScope, { review_left: true }],
			}),
			reviews.collection("replies").countDocuments(reviewScope),
			reviews.collection("replies").distinct("customer_id", reviewScope),
			reviews
				.collection("replies")
				.countDocuments({ ...reviewScope, sentiment: "positive" }),
			reviews.collection("replies").countDocuments({
				$and: [
					reviewScope,
					{
						$or: [
							{ needs_review: true },
							{ sentiment: "negative", review_status: { $ne: "resolved" } },
						],
					},
				],
			}),
			messaging.collection("messaging_messages").countDocuments(messagingScope),
			messaging
				.collection("messaging_messages")
				.countDocuments({ ...messagingScope, status: "failed" }),
		]);
		const sessionRecords = await Promise.all(
			plain(sessions).map(async (session) => ({
				...session,
				qrCodeDataUrl:
					typeof session.qrCode === "string"
						? await QRCode.toDataURL(session.qrCode)
						: null,
				qrCode: undefined,
			})),
		);
		return {
			metrics: {
				campaigns: campaignCount,
				activeCampaigns,
				reviewRequestsSent,
				reviewsPosted,
				replies: replyCount,
				customersReplied: customersReplied.length,
				positiveReplies,
				needsReview,
				messages: messageCount,
				failedMessages,
			},
			campaigns: campaigns.map(reviewRecord),
			replies: replies.map(reviewRecord),
			messages: plain(messages),
			sessions: sessionRecords,
		};
	}
}
