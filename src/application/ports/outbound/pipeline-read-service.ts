export interface PipelineSnapshot {
	metrics: {
		campaigns: number;
		activeCampaigns: number;
		reviewRequestsSent: number;
		reviewsPosted: number;
		replies: number;
		customersReplied: number;
		positiveReplies: number;
		needsReview: number;
		messages: number;
		failedMessages: number;
	};
	campaigns: Array<Record<string, unknown>>;
	replies: Array<Record<string, unknown>>;
	messages: Array<Record<string, unknown>>;
	sessions: Array<Record<string, unknown>>;
}

export interface PipelineReadService {
	getSnapshot(businessId: string): Promise<PipelineSnapshot>;
}
