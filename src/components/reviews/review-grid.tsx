"use client";

import {
	ArrowSquareOut,
	Bug,
	CaretDown,
	CaretRight,
	CaretUp,
	ChatCircleText,
	FunnelSimple,
	MagnifyingGlass,
	Star,
	Wrench,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { updateReviewAction } from "@/app/actions/reviews";
import {
	filterReviews,
	type ReviewFilterValues,
} from "@/application/reviews/review-filters";
import { reviewOwnerFeedback } from "@/application/reviews/review-owner-feedback";
import { reviewProfileUrl } from "@/application/reviews/review-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type Review = Record<string, unknown>;

const initialFilters: ReviewFilterValues = {
	query: "",
	rating: "all",
	sentiment: "all",
	matchState: "all",
	resolutionState: "all",
};

const options = {
	rating: [
		["all", "Any star rating"],
		["5", "5-star reviews"],
		["4", "4-star reviews"],
		["3", "3-star reviews"],
		["2", "2-star reviews"],
		["1", "1-star reviews"],
	],
	sentiment: [
		["all", "Any review tone"],
		["positive", "Positive reviews"],
		["neutral", "Neutral reviews"],
		["negative", "Negative reviews"],
	],
	matchState: [
		["all", "Any campaign match"],
		["confirmed", "Matched to campaign"],
		["manual", "Needs manual matching"],
		["unmatched", "No campaign match"],
		["rejected", "Match rejected"],
	],
	resolutionState: [
		["all", "Any follow-up status"],
		["unaddressed", "Not contacted"],
		["contacted", "Contacted"],
		["in_conversation", "In conversation"],
		["resolved", "Resolved"],
		["closed", "Closed"],
	],
} as const;

export function ReviewGrid({ reviews }: { reviews: Review[] }) {
	const [filters, setFilters] = useState(initialFilters);
	const filtered = useMemo(
		() => filterReviews(reviews, filters),
		[reviews, filters],
	);
	const setFilter = (key: keyof ReviewFilterValues, value: string) =>
		setFilters((current) => ({ ...current, [key]: value }));
	const hasActiveFilters = Object.entries(filters).some(
		([key, value]) => initialFilters[key as keyof ReviewFilterValues] !== value,
	);

	return (
		<div className="space-y-4">
			<Card className="gap-3 p-3">
				<div className="flex items-center gap-2 text-sm">
					<FunnelSimple />
					<span className="font-medium">Filter reviews</span>
					<span className="text-muted-foreground">·</span>
					<span className="text-muted-foreground">
						Showing {filtered.length} of {reviews.length}
					</span>
					{hasActiveFilters ? (
						<Button
							className="ml-auto h-7 px-2 text-xs"
							onClick={() => setFilters(initialFilters)}
							type="button"
							variant="ghost"
						>
							Clear
						</Button>
					) : null}
				</div>
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
					<div className="space-y-1 sm:col-span-2 lg:col-span-1">
						<FilterLabel description="Reviewer or review text" label="Search" />
						<div className="relative">
							<MagnifyingGlass className="absolute top-2.5 left-2.5 text-muted-foreground" />
							<Input
								aria-label="Search reviews"
								className="h-9 pl-8"
								onChange={(event) => setFilter("query", event.target.value)}
								placeholder="Type a name or phrase"
								value={filters.query}
							/>
						</div>
					</div>
					<FilterSelect
						description="Google star score"
						label="Rating"
						onChange={(value) => setFilter("rating", value)}
						options={options.rating}
						value={filters.rating}
					/>
					<FilterSelect
						description="Meaning of the review"
						label="Sentiment"
						onChange={(value) => setFilter("sentiment", value)}
						options={options.sentiment}
						value={filters.sentiment}
					/>
					<FilterSelect
						description="Linked customer campaign"
						label="Campaign match"
						onChange={(value) => setFilter("matchState", value)}
						options={options.matchState}
						value={filters.matchState}
					/>
					<FilterSelect
						description="Owner follow-up progress"
						label="Follow-up"
						onChange={(value) => setFilter("resolutionState", value)}
						options={options.resolutionState}
						value={filters.resolutionState}
					/>
				</div>
			</Card>

			{filtered.length ? (
				<div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{filtered.map((review) => (
						<ReviewCard key={String(review.googleReviewId)} review={review} />
					))}
				</div>
			) : (
				<Card className="p-8 text-center text-muted-foreground">
					No reviews match these filters.
				</Card>
			)}
		</div>
	);
}

function FilterSelect({
	description,
	label,
	onChange,
	options: items,
	value,
}: {
	description: string;
	label: string;
	onChange: (value: string) => void;
	options: readonly (readonly [string, string])[];
	value: string;
}) {
	return (
		<div className="min-w-0 space-y-1">
			<FilterLabel description={description} label={label} />
			<Select value={value} onValueChange={(next) => next && onChange(next)}>
				<SelectTrigger aria-label={label} className="h-9 min-h-9 w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map(([itemValue, itemLabel]) => (
						<SelectItem key={itemValue} value={itemValue}>
							{itemLabel}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function FilterLabel({
	description,
	label,
}: {
	description: string;
	label: string;
}) {
	return (
		<div className="flex min-w-0 items-baseline justify-between gap-2 px-0.5">
			<span className="shrink-0 font-medium text-xs">{label}</span>
			<span className="truncate text-[10px] text-muted-foreground">
				{description}
			</span>
		</div>
	);
}

function ReviewCard({ review }: { review: Review }) {
	const [expanded, setExpanded] = useState(false);
	const reviewId = String(review.googleReviewId);
	const stars = Math.max(0, Math.min(5, Number(review.stars)));
	const rawSource = (review.rawSource ?? {}) as Record<string, unknown>;
	const reviewerName = String(review.reviewerName);
	const reviewText = String(review.text ?? "").trim();
	const profilePicture = String(rawSource.profile_picture ?? "");
	const profileUrl = reviewProfileUrl(rawSource);
	const ownerFeedback = reviewOwnerFeedback(rawSource);
	return (
		<Card className="h-full gap-3 p-4">
			<div className="flex min-w-0 items-center gap-2">
				<Avatar className="size-9 border">
					{profilePicture ? <AvatarImage alt="" src={profilePicture} /> : null}
					<AvatarFallback>
						{reviewerName.slice(0, 1).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<h2 className="min-w-0 truncate font-semibold text-sm">
							{reviewerName}
						</h2>
						<Badge
							className="px-1.5 py-0 text-[11px]"
							variant={sentimentBadgeVariant(review.sentiment)}
						>
							{String(review.sentiment)}
						</Badge>
						<Badge
							className="px-1.5 py-0 text-[11px]"
							variant={
								review.matchState === "confirmed" ? "default" : "secondary"
							}
						>
							{String(review.matchState)}
						</Badge>
					</div>
					{stars > 0 ? (
						<div
							aria-label={`${stars} stars`}
							className="flex gap-0.5 text-amber-500"
							role="img"
						>
							{[1, 2, 3, 4, 5].map((position) => (
								<Star
									key={position}
									size={14}
									weight={position <= stars ? "fill" : "regular"}
								/>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-xs">Rating unavailable</p>
					)}
				</div>
			</div>
			{reviewText ? (
				<p
					className={`${expanded ? "whitespace-pre-wrap" : "line-clamp-3"} text-sm`}
				>
					{reviewText}
				</p>
			) : (
				<p className="text-muted-foreground text-sm italic">
					No written review
				</p>
			)}
			{reviewText.length > 140 ? (
				<Button
					className="h-7 w-fit gap-1 px-1 text-xs"
					onClick={() => setExpanded((value) => !value)}
					type="button"
					variant="ghost"
				>
					{expanded ? <CaretUp size={13} /> : <CaretDown size={13} />}
					{expanded ? "Show less" : "Read more"}
				</Button>
			) : null}
			{ownerFeedback ? (
				<details className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">
						<CaretRight size={13} />
						<ChatCircleText size={14} /> Owner response
					</summary>
					<p className="mt-2 whitespace-pre-wrap border-t pt-2 text-muted-foreground leading-relaxed">
						{ownerFeedback}
					</p>
				</details>
			) : null}

			<div className="space-y-2 rounded-md bg-muted/30 p-2">
				<div className="flex min-h-7 items-center justify-between gap-2">
					<p className="text-muted-foreground text-xs">
						{review.datePrecision === "estimated" ? "Approx. " : ""}
						{new Date(String(review.createdAt)).toLocaleDateString()}
					</p>
					{profileUrl ? (
						<Button
							className="h-7 gap-1 px-2 text-xs"
							render={
								<a
									href={profileUrl}
									rel="noopener noreferrer"
									target="_blank"
								/>
							}
							size="xs"
							variant="ghost"
						>
							<ArrowSquareOut size={14} />
							View profile
						</Button>
					) : null}
				</div>
				<details className="border-t pt-2 text-xs">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">
						<CaretRight size={13} />
						<Wrench size={13} /> Actions
					</summary>
					<div className="mt-3">
						<ReviewActions review={review} reviewId={reviewId} />
					</div>
				</details>
				<details className="border-t pt-2 text-xs">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">
						<CaretRight size={13} />
						<Bug size={13} /> Raw scraper data
					</summary>
					<pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 text-[10px] leading-relaxed">
						{JSON.stringify(
							review.rawSource ?? {
								googleReviewId: review.googleReviewId,
								rawDate: review.rawDate,
								observedAt: review.observedAt,
							},
							null,
							2,
						)}
					</pre>
				</details>
			</div>
		</Card>
	);
}

function sentimentBadgeVariant(sentiment: unknown) {
	switch (sentiment) {
		case "positive":
			return "success" as const;
		case "negative":
			return "destructive" as const;
		default:
			return "secondary" as const;
	}
}

function ReviewActions({
	review,
	reviewId,
}: {
	review: Review;
	reviewId: string;
}) {
	return (
		<div className="space-y-3">
			{review.matchedCampaign ? (
				<form
					action={updateReviewAction}
					className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2"
				>
					<span className="truncate">
						Matched to{" "}
						{String(
							(review.matchedCampaign as Record<string, unknown>)
								.customer_name ?? "Campaign",
						)}
						{(review.matchedCampaign as Record<string, unknown>).phone
							? ` · ${String((review.matchedCampaign as Record<string, unknown>).phone)}`
							: ""}
					</span>
					<input name="googleReviewId" type="hidden" value={reviewId} />
					<input name="action" type="hidden" value="undo_match" />
					<Button className="h-7" size="sm" type="submit" variant="ghost">
						Undo
					</Button>
				</form>
			) : null}
			{Array.isArray(review.candidateCampaigns) &&
			review.candidateCampaigns.length ? (
				<div className="space-y-2 rounded-md bg-muted/50 p-2">
					<p className="font-medium">Possible Campaign matches</p>
					<div className="flex flex-wrap gap-1">
						{review.candidateCampaigns.map((candidate) => {
							const campaign = candidate as Record<string, unknown>;
							return (
								<form action={updateReviewAction} key={String(campaign.id)}>
									<input name="googleReviewId" type="hidden" value={reviewId} />
									<input name="action" type="hidden" value="match" />
									<input
										name="campaignId"
										type="hidden"
										value={String(campaign.id)}
									/>
									<Button className="h-7" size="sm" type="submit">
										{String(campaign.customer_name ?? campaign.customerName)}
									</Button>
								</form>
							);
						})}
						<form action={updateReviewAction}>
							<input name="googleReviewId" type="hidden" value={reviewId} />
							<input name="action" type="hidden" value="reject" />
							<Button className="h-7" size="sm" type="submit" variant="outline">
								Reject
							</Button>
						</form>
					</div>
				</div>
			) : null}
			<form action={updateReviewAction} className="flex gap-2">
				<input name="googleReviewId" type="hidden" value={reviewId} />
				<input name="action" type="hidden" value="sentiment" />
				<Select defaultValue={String(review.sentiment)} name="value">
					<SelectTrigger aria-label="Sentiment" className="h-8 min-h-8 flex-1">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options.sentiment.slice(1).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button className="h-8" size="sm" type="submit" variant="outline">
					Override
				</Button>
			</form>
			<form action={updateReviewAction} className="space-y-2">
				<input name="googleReviewId" type="hidden" value={reviewId} />
				<input name="action" type="hidden" value="resolution" />
				<Select defaultValue={String(review.resolutionState)} name="value">
					<SelectTrigger
						aria-label="Recovery state"
						className="h-8 min-h-8 w-full"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options.resolutionState.slice(1).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					className="h-8"
					defaultValue={String(review.resolutionNote ?? "")}
					name="note"
					placeholder="Internal note"
				/>
				<Button
					className="h-8 w-full"
					size="sm"
					type="submit"
					variant="outline"
				>
					Save recovery state
				</Button>
			</form>
		</div>
	);
}
