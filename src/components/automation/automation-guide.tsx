"use client";

import {
	ArrowClockwise,
	CheckCircle,
	FlowArrow,
	WarningCircle,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { useActionState, useCallback, useMemo, useState } from "react";
import {
	markFeedbackResolved,
	markReviewCompleted,
	type ReviewSubmissionState,
	retryMessage,
	sendManualReminder,
	submitCompletedJob,
} from "@/app/actions/messaging";
import type { AutomationHealth } from "@/application/automation-health";
import type { PipelineSnapshot } from "@/application/ports/outbound/pipeline-read-service";
import {
	InteriorButton,
	InteriorDropdown,
	InteriorModal,
	InteriorSubmitButton,
} from "@/components/interior/interior-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { useNeedsReviewToast } from "@/hooks/use-needs-review-toast";
import { CossDateTimeField } from "./coss-date-time-field";

const initialState: ReviewSubmissionState = { status: "idle", message: "" };
const text = (value: unknown, fallback = "—") =>
	typeof value === "string" && value ? value : fallback;
const yes = (value: unknown) => value === true;
const waiting = (value: unknown) => {
	const date = new Date(String(value ?? ""));
	return Number.isNaN(date.valueOf())
		? "—"
		: formatDistanceToNow(date, { addSuffix: true });
};
const unresolved = (reply: Record<string, unknown>) =>
	yes(reply.needsReview) ||
	(text(reply.sentiment) === "negative" && reply.reviewStatus !== "resolved");

type CampaignState =
	| "needs_review"
	| "completed"
	| "awaiting_review"
	| "active";

function campaignState(
	campaign: Record<string, unknown>,
	attentionCustomers: Set<string>,
): CampaignState {
	if (attentionCustomers.has(text(campaign.id, ""))) return "needs_review";
	if (yes(campaign.reviewLeft)) return "completed";
	if (yes(campaign.reviewSent)) return "awaiting_review";
	return "active";
}

function currentStep(campaign: Record<string, unknown>) {
	if (yes(campaign.reviewLeft)) return "Google review posted";
	if (yes(campaign.reminderSent)) return "Reminder sent";
	if (yes(campaign.reviewSent)) return "Waiting for Google review";
	if (yes(campaign.checkinSent)) return "Waiting for customer feedback";
	return "Check-in scheduled";
}

export function AutomationGuide({
	businessId,
	data,
	health,
}: {
	businessId: string | null;
	data: PipelineSnapshot | null;
	health: AutomationHealth;
}) {
	const { isRefreshing: isManualRefreshing, refresh } = useLiveRefresh(3000);
	const [state, action] = useActionState(submitCompletedJob, initialState);
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState("all");
	const [selectedCampaign, setSelectedCampaign] = useState<Record<
		string,
		unknown
	> | null>(null);
	const closeCampaign = useCallback(() => setSelectedCampaign(null), []);
	const campaigns = data?.campaigns ?? [];
	const replies = data?.replies ?? [];
	useNeedsReviewToast(replies);

	const attentionReplies = replies.filter(unresolved);
	const attentionCustomers = new Set(
		attentionReplies.map((reply) => text(reply.customerId, "")),
	);
	const filteredCampaigns = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return campaigns.filter((campaign) => {
			const state = campaignState(campaign, attentionCustomers);
			const matchesStatus = status === "all" || state === status;
			const matchesQuery =
				!needle ||
				[
					text(campaign.customerName),
					text(campaign.phone),
					text(campaign.jobId),
				]
					.join(" ")
					.toLowerCase()
					.includes(needle);
			return matchesStatus && matchesQuery;
		});
	}, [attentionCustomers, campaigns, query, status]);
	const campaignPagination = usePagination(filteredCampaigns, 10);

	const metrics = data?.metrics;
	const conversion = metrics?.reviewRequestsSent
		? Math.round((metrics.reviewsPosted / metrics.reviewRequestsSent) * 100)
		: 0;

	return (
		<main className="flex flex-1 flex-col gap-7 p-4 md:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="mb-2 flex items-center gap-2 text-primary">
						<FlowArrow size={20} weight="duotone" />
						<span className="font-medium text-sm">Review operations</span>
					</div>
					<h1 className="font-heading font-bold text-2xl tracking-tight">
						Google review campaigns
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						See what needs attention and move customers through the review
						funnel.
					</p>
				</div>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								aria-label="Refresh data"
								loading={isManualRefreshing}
								onClick={refresh}
								size="icon-lg"
								type="button"
							/>
						}
					>
						<ArrowClockwise
							className={
								isManualRefreshing ? "motion-safe:animate-spin" : undefined
							}
							weight="bold"
						/>
					</TooltipTrigger>
					<TooltipPopup side="bottom">
						{isManualRefreshing ? "Refreshing data…" : "Refresh data"}
					</TooltipPopup>
				</Tooltip>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				<Metric
					label="Active campaigns"
					value={metrics?.activeCampaigns ?? 0}
					tone="info"
				/>
				<Metric
					label="Requests sent"
					value={metrics?.reviewRequestsSent ?? 0}
				/>
				<Metric
					label="Reviews posted"
					value={metrics?.reviewsPosted ?? 0}
					tone="success"
				/>
				<Metric
					label="Needs follow-up"
					value={metrics?.needsReview ?? 0}
					tone="danger"
				/>
				<Metric label="Conversion" value={`${conversion}%`} tone="success" />
			</div>

			<div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
				<Funnel metrics={metrics} />
				<AutomationHealthCard health={health} sessions={data?.sessions ?? []} />
			</div>

			<div className="grid items-start gap-5 xl:grid-cols-[minmax(17rem,32%)_1fr]">
				<Card className="p-5 shadow-none">
					<h2 className="font-heading font-bold text-lg">Start a campaign</h2>
					<p className="mb-5 text-muted-foreground text-sm">
						Completion time defaults to now and can be adjusted if needed.
					</p>
					{businessId ? (
						<form action={action} className="space-y-4">
							<CossInputField
								label="Customer name"
								name="customerName"
								placeholder="e.g. Deion Williams"
								description="Used to personalize WhatsApp messages."
							/>
							<CossInputField
								label="Customer phone"
								name="phone"
								type="tel"
								placeholder="e.g. +919876543210"
								pattern="\\+[1-9][0-9]{7,14}"
								title="Use international format, for example +919876543210"
								description="Include the country code, for example +91 or +974."
							/>
							<CossInputField
								label="Owner name"
								name="ownerName"
								placeholder="e.g. Praveen"
								description="Shown as the sender in the customer check-in."
							/>
							<CossInputField
								label="Google review URL"
								name="reviewUrl"
								type="url"
								placeholder="e.g. https://g.page/r/your-business/review"
								description="The exact Google review link appended to requests."
							/>
							<CossDateTimeField name="completedAt" />
							{state.status !== "idle" ? (
								<div
									className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${state.status === "success" ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700" : "border-destructive/25 bg-destructive/5 text-destructive"}`}
								>
									{state.status === "success" ? (
										<CheckCircle size={18} weight="fill" />
									) : (
										<WarningCircle size={18} weight="fill" />
									)}
									<span>
										{state.message}
										{state.jobId ? (
											<span className="mt-0.5 block font-mono text-xs">
												{state.jobId}
											</span>
										) : null}
									</span>
								</div>
							) : null}
							<InteriorSubmitButton
								className="w-full"
								pendingLabel="Starting campaign…"
							>
								Start campaign
							</InteriorSubmitButton>
						</form>
					) : (
						<p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
							Select an organization from the sidebar first.
						</p>
					)}
				</Card>

				<Card className="overflow-visible shadow-none">
					<div className="border-b bg-muted/20 p-5">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
							<div>
								<h2 className="font-heading font-bold text-lg">
									Campaign tracking
								</h2>
								<p className="text-muted-foreground text-sm">
									Current state and next action for every customer.
								</p>
							</div>
							<div className="grid gap-2 sm:grid-cols-[minmax(13rem,1fr)_11rem]">
								<Input
									nativeInput
									type="search"
									value={query}
									onChange={(event) => {
										setQuery(event.target.value);
										campaignPagination.setPage(1);
									}}
									placeholder="Search customer, phone, job…"
								/>
								<InteriorDropdown
									name="campaignStatus"
									label="Status"
									value={status}
									onChange={(value) => {
										setStatus(value);
										campaignPagination.setPage(1);
									}}
									items={[
										{ value: "all", label: "All" },
										{ value: "active", label: "Active" },
										{ value: "awaiting_review", label: "Awaiting review" },
										{ value: "needs_review", label: "Needs review" },
										{ value: "completed", label: "Completed" },
									]}
								/>
							</div>
						</div>
					</div>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Customer</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Current step</TableHead>
									<TableHead>Last activity</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{campaignPagination.pageItems.map((campaign) => {
									const campaignStatus = campaignState(
										campaign,
										attentionCustomers,
									);
									return (
										<TableRow
											key={text(campaign.id)}
											className="hover:bg-muted/30"
										>
											<TableCell>
												<p className="font-medium">
													{text(campaign.customerName)}
												</p>
												<p className="text-muted-foreground text-xs">
													{text(campaign.phone)}
												</p>
											</TableCell>
											<TableCell>
												<StatusBadge status={campaignStatus} />
											</TableCell>
											<TableCell>
												<p className="text-sm">{currentStep(campaign)}</p>
												<p className="max-w-40 truncate font-mono text-muted-foreground text-xs">
													{text(campaign.jobId)}
												</p>
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{waiting(campaign.updatedAt ?? campaign.completedAt)}
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-2">
													<InteriorButton
														size="sm"
														type="button"
														onClick={() => setSelectedCampaign(campaign)}
													>
														Open
													</InteriorButton>
													<a
														className="inline-flex h-9 items-center rounded-[9px] border border-foreground bg-foreground px-3.5 text-background text-xs hover:bg-foreground/85"
														href={`tel:${text(campaign.phone, "")}`}
													>
														Call
													</a>
													{!yes(campaign.reviewLeft) ? (
														<form action={markReviewCompleted}>
															<input
																type="hidden"
																name="campaignId"
																value={text(campaign.id, "")}
															/>
															<InteriorSubmitButton
																variant="default"
																pendingLabel="Saving…"
															>
																Mark complete
															</InteriorSubmitButton>
														</form>
													) : null}
												</div>
											</TableCell>
										</TableRow>
									);
								})}
								{filteredCampaigns.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="h-32 text-center text-muted-foreground"
										>
											<p className="font-medium text-foreground">
												No matching campaigns
											</p>
											<p className="mt-1 text-sm">
												Complete a job and launch your first campaign, or adjust
												the filters.
											</p>
										</TableCell>
									</TableRow>
								) : null}
							</TableBody>
						</Table>
					</div>
					<DataPagination
						page={campaignPagination.page}
						pageSize={campaignPagination.pageSize}
						totalItems={filteredCampaigns.length}
						onPageChange={campaignPagination.setPage}
						onPageSizeChange={campaignPagination.setPageSize}
					/>
				</Card>
			</div>

			<section className="space-y-4">
				<div>
					<h2 className="font-heading font-bold text-xl">
						Customer conversations
					</h2>
					<p className="text-muted-foreground text-sm">
						Feedback context, sentiment reason, and items needing a human
						response.
					</p>
				</div>
				{attentionReplies.length > 0 ? (
					<Card className="border-destructive/30 bg-destructive/[0.03] p-5 shadow-none">
						<div className="mb-4 flex items-center justify-between">
							<div>
								<h3 className="font-semibold text-destructive">
									Attention needed
								</h3>
								<p className="text-muted-foreground text-sm">
									{attentionReplies.length} customer{" "}
									{attentionReplies.length === 1
										? "conversation requires"
										: "conversations require"}{" "}
									follow-up.
								</p>
							</div>
							<Badge variant="destructive">{attentionReplies.length}</Badge>
						</div>
						<div className="grid gap-3 lg:grid-cols-2">
							{attentionReplies.map((reply) => (
								<ReplyCard key={text(reply.id)} reply={reply} actionable />
							))}
						</div>
					</Card>
				) : null}
				<div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
					{replies
						.filter((reply) => !unresolved(reply))
						.map((reply) => (
							<ReplyCard key={text(reply.id)} reply={reply} />
						))}
				</div>
				{replies.length === 0 ? (
					<Card className="p-10 text-center">
						<p className="font-medium">No customer conversations yet</p>
						<p className="mt-1 text-muted-foreground text-sm">
							Replies will appear here as soon as customers respond.
						</p>
					</Card>
				) : null}
			</section>

			<CampaignDetailModal
				campaign={selectedCampaign}
				replies={replies}
				messages={data?.messages ?? []}
				onClose={closeCampaign}
			/>
		</main>
	);
}

function Funnel({
	metrics,
}: {
	metrics: PipelineSnapshot["metrics"] | undefined;
}) {
	const total = Math.max(metrics?.campaigns ?? 0, 1);
	const stages = [
		{
			label: "Campaigns started",
			value: metrics?.campaigns ?? 0,
			color: "bg-blue-500",
		},
		{
			label: "Review requests sent",
			value: metrics?.reviewRequestsSent ?? 0,
			color: "bg-indigo-500",
		},
		{
			label: "Customers replied",
			value: metrics?.customersReplied ?? 0,
			color: "bg-amber-500",
		},
		{
			label: "Reviews posted",
			value: metrics?.reviewsPosted ?? 0,
			color: "bg-emerald-500",
		},
	];
	return (
		<Card className="p-5 shadow-none">
			<h2 className="font-heading font-bold text-lg">Campaign funnel</h2>
			<p className="mb-5 text-muted-foreground text-sm">
				Where customers currently move through the automation.
			</p>
			<div className="space-y-4">
				{stages.map((stage) => (
					<div key={stage.label}>
						<div className="mb-1.5 flex items-center justify-between text-sm">
							<span>{stage.label}</span>
							<span className="font-semibold tabular-nums">{stage.value}</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-muted">
							<div
								className={`h-full rounded-full ${stage.color}`}
								style={{
									width: `${Math.min(100, Math.round((stage.value / total) * 100))}%`,
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</Card>
	);
}

function AutomationHealthCard({
	health,
	sessions,
}: {
	health: AutomationHealth;
	sessions: Array<Record<string, unknown>>;
}) {
	const whatsappHealthy = sessions.some(
		(session) => text(session.state) === "connected",
	);
	const checks = [
		["WhatsApp", whatsappHealthy ? "healthy" : "degraded"],
		["Messaging service", health.messaging],
		["n8n workflows", health.n8n],
		["Reviews database", health.database],
	] as const;
	return (
		<Card className="p-5 shadow-none">
			<h2 className="font-heading font-bold text-lg">Automation health</h2>
			<p className="mb-4 text-muted-foreground text-sm">
				Live checks help separate system issues from customer inactivity.
			</p>
			<div className="space-y-2.5">
				{checks.map(([label, state]) => (
					<div
						key={label}
						className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
					>
						<span className="text-sm">{label}</span>
						<Badge variant={state === "healthy" ? "success" : "warning"}>
							<span className="size-1.5 rounded-full bg-current" />
							{state === "healthy" ? "Healthy" : "Attention"}
						</Badge>
					</div>
				))}
			</div>
			<p className="mt-3 text-muted-foreground text-xs">
				Checked {waiting(health.checkedAt)}
			</p>
		</Card>
	);
}

function CampaignDetailModal({
	campaign,
	replies,
	messages,
	onClose,
}: {
	campaign: Record<string, unknown> | null;
	replies: Array<Record<string, unknown>>;
	messages: Array<Record<string, unknown>>;
	onClose: () => void;
}) {
	if (!campaign)
		return (
			<InteriorModal open={false} onClose={onClose} title="Campaign">
				<span />
			</InteriorModal>
		);
	const campaignReplies = replies.filter(
		(reply) => text(reply.customerId, "") === text(campaign.id, ""),
	);
	const failedMessages = messages.filter(
		(message) =>
			text(message.phone, "") === text(campaign.phone, "") &&
			text(message.status) === "failed",
	);
	const hasAttention = campaignReplies.some(unresolved);
	const timeline = [
		["Job completed", true],
		["Check-in sent", yes(campaign.checkinSent)],
		["Customer replied", campaignReplies.length > 0],
		["Review request sent", yes(campaign.reviewSent)],
		["Reminder sent", yes(campaign.reminderSent)],
		["Google review posted", yes(campaign.reviewLeft)],
	] as const;
	return (
		<InteriorModal
			open
			onClose={onClose}
			title={text(campaign.customerName)}
			description={`${text(campaign.phone)} · ${text(campaign.jobId)}`}
			footer={
				<InteriorButton type="button" onClick={onClose}>
					Close
				</InteriorButton>
			}
		>
			<div className="space-y-5">
				<div>
					<h3 className="mb-3 font-medium text-sm">Automation timeline</h3>
					<ol className="space-y-0">
						{timeline.map(([label, done], index) => (
							<li key={label} className="relative flex gap-3 pb-4 last:pb-0">
								<span
									className={`relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full border text-[10px] ${done ? "border-emerald-500 bg-emerald-500 text-white" : "bg-background text-muted-foreground"}`}
								>
									{done ? "✓" : index + 1}
								</span>
								{index < timeline.length - 1 ? (
									<span className="absolute left-[9px] top-5 h-full w-px bg-border" />
								) : null}
								<div>
									<p
										className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}
									>
										{label}
									</p>
									{done && label === currentStep(campaign) ? (
										<p className="text-muted-foreground text-xs">
											Current step
										</p>
									) : null}
								</div>
							</li>
						))}
					</ol>
				</div>
				<div>
					<h3 className="mb-2 font-medium text-sm">Conversation</h3>
					{campaignReplies.length ? (
						<div className="space-y-2">
							{campaignReplies.map((reply) => (
								<div
									key={text(reply.id)}
									className="rounded-lg bg-muted/50 p-3"
								>
									<div className="mb-1 flex justify-between gap-2">
										<Badge
											variant={
												text(reply.sentiment) === "negative"
													? "destructive"
													: text(reply.sentiment) === "positive"
														? "success"
														: "secondary"
											}
										>
											{text(reply.sentiment, "pending")}
										</Badge>
										<span className="text-muted-foreground text-xs">
											{waiting(reply.receivedAt)}
										</span>
									</div>
									<p className="text-sm">{text(reply.message)}</p>
								</div>
							))}
						</div>
					) : (
						<p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
							No customer reply yet.
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-2 border-t pt-4">
					<a
						className="inline-flex h-11 items-center rounded-[9px] border border-foreground bg-foreground px-4 text-background text-sm hover:bg-foreground/85"
						href={`tel:${text(campaign.phone, "")}`}
					>
						Call customer
					</a>
					{yes(campaign.reviewSent) &&
					!yes(campaign.reviewLeft) &&
					!yes(campaign.reminderSent) &&
					!hasAttention ? (
						<form action={sendManualReminder}>
							<input
								type="hidden"
								name="campaignId"
								value={text(campaign.id, "")}
							/>
							<InteriorSubmitButton pendingLabel="Sending…">
								Send reminder
							</InteriorSubmitButton>
						</form>
					) : null}
					{!yes(campaign.reviewLeft) ? (
						<form action={markReviewCompleted}>
							<input
								type="hidden"
								name="campaignId"
								value={text(campaign.id, "")}
							/>
							<InteriorSubmitButton variant="default" pendingLabel="Saving…">
								Mark complete
							</InteriorSubmitButton>
						</form>
					) : null}
				</div>
				{failedMessages.length > 0 ? (
					<div>
						<h3 className="mb-2 font-medium text-sm">Failed messages</h3>
						<div className="space-y-2">
							{failedMessages.map((message) => (
								<div
									key={text(message.id)}
									className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 p-3"
								>
									<p className="line-clamp-2 text-sm">{text(message.body)}</p>
									<form action={retryMessage}>
										<input
											type="hidden"
											name="messageId"
											value={text(message.id, "")}
										/>
										<InteriorSubmitButton
											variant="danger"
											pendingLabel="Retrying…"
										>
											Retry
										</InteriorSubmitButton>
									</form>
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		</InteriorModal>
	);
}

function Metric({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: number | string;
	tone?: "default" | "info" | "success" | "danger";
}) {
	const colors = {
		default: "text-foreground",
		info: "text-blue-600",
		success: "text-emerald-600",
		danger: "text-destructive",
	};
	return (
		<Card className="p-4 shadow-none">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className={`mt-1 font-semibold text-2xl tabular-nums ${colors[tone]}`}>
				{value}
			</p>
		</Card>
	);
}

function StatusBadge({ status }: { status: CampaignState }) {
	const config = {
		needs_review: { label: "Needs review", variant: "destructive" as const },
		completed: { label: "Completed", variant: "success" as const },
		awaiting_review: { label: "Awaiting review", variant: "warning" as const },
		active: { label: "Active", variant: "info" as const },
	}[status];
	return (
		<Badge variant={config.variant}>
			<span className="size-1.5 rounded-full bg-current" />
			{config.label}
		</Badge>
	);
}

function ReplyCard({
	reply,
	actionable = false,
}: {
	reply: Record<string, unknown>;
	actionable?: boolean;
}) {
	const sentiment = text(reply.sentiment, "pending");
	return (
		<Card className="gap-3 p-4 shadow-none">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-medium">{text(reply.customerName)}</p>
					<p className="text-muted-foreground text-xs">
						{text(reply.phone)} · {waiting(reply.receivedAt)}
					</p>
				</div>
				<Badge
					variant={
						sentiment === "negative"
							? "destructive"
							: sentiment === "positive"
								? "success"
								: "secondary"
					}
				>
					{actionable ? "Needs human reply" : sentiment}
				</Badge>
			</div>
			<blockquote className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
				“{text(reply.message)}”
			</blockquote>
			{text(reply.sentimentReason, "") ? (
				<p className="text-muted-foreground text-xs">
					<span className="font-medium text-foreground">Why:</span>{" "}
					{text(reply.sentimentReason)}
				</p>
			) : null}
			{actionable ? (
				<div className="flex flex-wrap gap-2 border-t pt-3">
					<a
						className="inline-flex h-10 items-center rounded-[9px] border border-foreground bg-foreground px-4 text-background text-xs hover:bg-foreground/85"
						href={`tel:${text(reply.phone, "")}`}
					>
						Call customer
					</a>
					<form action={markFeedbackResolved}>
						<input type="hidden" name="replyId" value={text(reply.id, "")} />
						<InteriorSubmitButton variant="default" pendingLabel="Resolving…">
							<CheckCircle size={14} /> Mark resolved
						</InteriorSubmitButton>
					</form>
				</div>
			) : null}
		</Card>
	);
}

function CossInputField({
	label,
	name,
	type = "text",
	placeholder,
	pattern,
	title,
	description,
}: {
	label: string;
	name: string;
	type?: string;
	placeholder?: string;
	pattern?: string;
	title?: string;
	description?: string;
}) {
	return (
		<Field>
			<FieldLabel htmlFor={name}>{label}</FieldLabel>
			<Input
				nativeInput
				id={name}
				name={name}
				type={type}
				placeholder={placeholder}
				pattern={pattern}
				title={title}
				required
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}
