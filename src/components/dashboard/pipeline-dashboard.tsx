"use client";

import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { useState } from "react";
import {
	connectSession,
	deleteSession,
	disconnectSession,
	retryMessage,
} from "@/app/actions/messaging";
import type { PipelineSnapshot } from "@/application/ports/outbound/pipeline-read-service";
import {
	InteriorButton,
	InteriorDropdown,
	InteriorInput,
	InteriorModal,
	InteriorSubmitButton,
} from "@/components/interior/interior-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { useNeedsReviewToast } from "@/hooks/use-needs-review-toast";

const text = (value: unknown, fallback = "—") =>
	typeof value === "string" && value ? value : fallback;
const when = (value: unknown) => {
	const date = value instanceof Date ? value : new Date(String(value ?? ""));
	return Number.isNaN(date.valueOf())
		? "—"
		: formatDistanceToNow(date, { addSuffix: true });
};
const tone = (status: string) =>
	status === "connected" || status === "sent" || status === "positive"
		? "default"
		: status === "failed" || status === "auth-expired" || status === "negative"
			? "destructive"
			: "secondary";

export function PipelineDashboard({ data }: { data: PipelineSnapshot }) {
	const [connectOpen, setConnectOpen] = useState(false);
	const [authType, setAuthType] = useState("qr");
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const hasPendingSession = data.sessions.some((session) =>
		["connecting", "qr-pending", "pairing-pending", "reconnecting"].includes(
			text(session.state),
		),
	);
	useLiveRefresh(hasPendingSession ? 1500 : 3000);
	useNeedsReviewToast(data.replies);
	const sessionPagination = usePagination(data.sessions, 5);
	const messagePagination = usePagination(data.messages, 10);

	const metrics = [
		["Campaigns", data.metrics.campaigns],
		["Customer replies", data.metrics.replies],
		["Positive replies", data.metrics.positiveReplies],
		["Needs review", data.metrics.needsReview],
		["WhatsApp messages", data.metrics.messages],
		["Failed sends", data.metrics.failedMessages],
	] as const;
	return (
		<main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">
					Review pipeline
				</h1>
				<p className="text-muted-foreground text-sm">
					Live, organization-scoped campaign and WhatsApp operations.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
				{metrics.map(([label, value]) => (
					<Card className="p-5" key={label}>
						<p className="text-muted-foreground text-sm">{label}</p>
						<p className="mt-2 font-semibold text-3xl tabular-nums">{value}</p>
					</Card>
				))}
			</div>

			<section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
				<Card className="overflow-hidden">
					<div className="border-b p-5">
						<h2 className="font-semibold">WhatsApp sessions</h2>
						<p className="text-muted-foreground text-sm">
							Connection health and authentication state.
						</p>
					</div>
					{data.sessions.length ? (
						<div>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Number</TableHead>
										<TableHead>State</TableHead>
										<TableHead>Updated</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{sessionPagination.pageItems.map((session) => {
										const state = text(session.state);
										return (
											<TableRow key={text(session.id)}>
												<TableCell className="font-medium">
													{text(session.name)}
												</TableCell>
												<TableCell>{text(session.phoneNumber)}</TableCell>
												<TableCell>
													<Badge variant={tone(state)}>{state}</Badge>
													{session.pairingCode ? (
														<div className="mt-2 font-mono text-xs">
															Code: {text(session.pairingCode)}
														</div>
													) : null}
													{typeof session.qrCodeDataUrl === "string" ? (
														<Image
															alt="WhatsApp linking QR code"
															className="mt-3 size-36 rounded-lg border bg-white p-2"
															height={144}
															src={session.qrCodeDataUrl}
															unoptimized
															width={144}
														/>
													) : null}
												</TableCell>
												<TableCell>{when(session.updatedAt)}</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<form action={disconnectSession}>
															<input
																name="sessionId"
																type="hidden"
																value={text(session.id)}
															/>
															<InteriorSubmitButton
																pendingLabel="Disconnecting…"
																variant="default"
															>
																Disconnect
															</InteriorSubmitButton>
														</form>
														<InteriorButton
															size="sm"
															type="button"
															variant="danger"
															onClick={() =>
																setDeleteTarget({
																	id: text(session.id),
																	name: text(session.name),
																})
															}
														>
															Delete
														</InteriorButton>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
							<DataPagination
								page={sessionPagination.page}
								pageSize={sessionPagination.pageSize}
								totalItems={data.sessions.length}
								onPageChange={sessionPagination.setPage}
								onPageSizeChange={sessionPagination.setPageSize}
							/>
						</div>
					) : (
						<p className="p-6 text-muted-foreground text-sm">
							No WhatsApp session configured for this organization.
						</p>
					)}
				</Card>
				<Card className="p-5">
					<h2 className="font-semibold">Connect a number</h2>
					<p className="mb-5 text-muted-foreground text-sm">
						Use QR by default, or pairing with an E.164 phone number.
					</p>
					<InteriorButton
						className="w-full"
						type="button"
						variant="primary"
						onClick={() => setConnectOpen(true)}
					>
						Connect WhatsApp
					</InteriorButton>
				</Card>
			</section>

			<InteriorModal
				open={connectOpen}
				onClose={() => setConnectOpen(false)}
				title="Connect WhatsApp"
				description="Create a messaging session using a QR code or phone pairing code."
				panelClassName="min-h-[min(38rem,86vh)]"
			>
				<form
					action={async (formData) => {
						await connectSession(formData);
						setConnectOpen(false);
					}}
					className="space-y-4 pt-1"
				>
					<InteriorInput
						label="Session name"
						name="name"
						placeholder="e.g. Main WhatsApp"
						defaultValue="main"
						description="A recognizable name for this WhatsApp connection."
						required
					/>
					<InteriorDropdown
						name="authType"
						label="Authentication"
						value={authType}
						onChange={setAuthType}
						items={[
							{ value: "qr", label: "QR code", hint: "Recommended" },
							{ value: "pairing", label: "Pairing code" },
						]}
					/>
					{authType === "pairing" ? (
						<InteriorInput
							label="Phone number"
							name="phoneNumber"
							type="tel"
							placeholder="e.g. +919876543210"
							description="Include the country code without spaces."
							required
						/>
					) : null}
					<div className="flex justify-end gap-2 pt-2">
						<InteriorButton type="button" onClick={() => setConnectOpen(false)}>
							Cancel
						</InteriorButton>
						<InteriorSubmitButton pendingLabel="Connecting…">
							Connect WhatsApp
						</InteriorSubmitButton>
					</div>
				</form>
			</InteriorModal>

			<InteriorModal
				open={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				title="Delete WhatsApp session?"
				description={`This permanently removes ${deleteTarget?.name ?? "this session"} and its stored WhatsApp credentials.`}
			>
				<form
					action={async (formData) => {
						await deleteSession(formData);
						setDeleteTarget(null);
					}}
					className="flex justify-end gap-2 pt-2"
				>
					<input
						name="sessionId"
						type="hidden"
						value={deleteTarget?.id ?? ""}
					/>
					<InteriorButton type="button" onClick={() => setDeleteTarget(null)}>
						Cancel
					</InteriorButton>
					<InteriorSubmitButton variant="danger" pendingLabel="Deleting…">
						Delete session
					</InteriorSubmitButton>
				</form>
			</InteriorModal>

			<Card className="overflow-hidden">
				<div className="border-b p-5">
					<h2 className="font-semibold">Recent messages</h2>
					<p className="text-muted-foreground text-sm">
						Incoming and outgoing provider traffic.
					</p>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Direction</TableHead>
							<TableHead>Phone</TableHead>
							<TableHead>Message</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Time</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{messagePagination.pageItems.map((message) => {
							const status = text(message.status);
							return (
								<TableRow key={text(message.id)}>
									<TableCell>{text(message.direction)}</TableCell>
									<TableCell>{text(message.phone)}</TableCell>
									<TableCell className="max-w-md truncate">
										{text(message.body)}
									</TableCell>
									<TableCell>
										<Badge variant={tone(status)}>{status}</Badge>
									</TableCell>
									<TableCell>{when(message.createdAt)}</TableCell>
									<TableCell>
										{status === "failed" ? (
											<form action={retryMessage}>
												<input
													name="messageId"
													type="hidden"
													value={text(message.id)}
												/>
												<InteriorSubmitButton
													pendingLabel="Retrying…"
													variant="default"
												>
													Retry
												</InteriorSubmitButton>
											</form>
										) : null}
									</TableCell>
								</TableRow>
							);
						})}
						{!data.messages.length ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-24 text-center text-muted-foreground"
								>
									No messages yet.
								</TableCell>
							</TableRow>
						) : null}
					</TableBody>
				</Table>
				<DataPagination
					page={messagePagination.page}
					pageSize={messagePagination.pageSize}
					totalItems={data.messages.length}
					onPageChange={messagePagination.setPage}
					onPageSizeChange={messagePagination.setPageSize}
				/>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				<RecordTable
					title="Recent campaigns"
					records={data.campaigns}
					columns={["customerName", "phone", "status", "updatedAt"]}
				/>
				<RecordTable
					title="Recent replies"
					records={data.replies}
					columns={["phone", "message", "sentiment", "receivedAt"]}
				/>
			</div>
		</main>
	);
}

function RecordTable({
	title,
	records,
	columns,
}: {
	title: string;
	records: Array<Record<string, unknown>>;
	columns: string[];
}) {
	const pagination = usePagination(records, 5);
	return (
		<Card className="overflow-hidden">
			<div className="border-b p-5">
				<h2 className="font-semibold">{title}</h2>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((column) => (
							<TableHead key={column}>
								{column.replace(/([A-Z])/g, " $1")}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{pagination.pageItems.map((record) => (
						<TableRow key={text(record.id)}>
							{columns.map((column) => (
								<TableCell className="max-w-52 truncate" key={column}>
									{column.endsWith("At")
										? when(record[column])
										: text(record[column])}
								</TableCell>
							))}
						</TableRow>
					))}
					{!records.length ? (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="h-24 text-center text-muted-foreground"
							>
								No records yet.
							</TableCell>
						</TableRow>
					) : null}
				</TableBody>
			</Table>
			<DataPagination
				page={pagination.page}
				pageSize={pagination.pageSize}
				totalItems={records.length}
				onPageChange={pagination.setPage}
				onPageSizeChange={pagination.setPageSize}
			/>
		</Card>
	);
}
