import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { ReviewGrid } from "@/components/reviews/review-grid";
import { Card } from "@/components/ui/card";
import {
	getGoogleConnection,
	listReviews,
} from "@/infrastructure/database/mongo/mongo-review-store";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

export default async function ReviewsPage() {
	const requestHeaders = await headers();
	const queryClient = getQueryClient();
	const session = await ensureSession(queryClient, auth, {
		headers: requestHeaders,
	});
	if (!session) redirect("/auth/sign-in?redirectTo=%2Freviews");
	const businessId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	const connection = businessId ? await getGoogleConnection(businessId) : null;
	const reviews = businessId ? await listReviews(businessId) : [];
	const syncStale =
		connection?.locationId &&
		(!connection.lastSyncSucceededAt ||
			Date.now() - new Date(String(connection.lastSyncSucceededAt)).getTime() >
				60 * 60 * 1000);
	const serializableReviews = JSON.parse(JSON.stringify(reviews)) as Array<
		Record<string, unknown>
	>;

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AppShell session={session} breadcrumbPage="Reviews">
				<main className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
					<div>
						<h1 className="font-heading font-bold text-2xl">Google reviews</h1>
						<p className="text-muted-foreground text-sm">
							{reviews.length} {reviews.length === 1 ? "review" : "reviews"} ·
							Scan feedback, matches, and recovery work.
						</p>
					</div>
					{syncStale ? (
						<Card className="border-destructive p-4">
							<h2 className="font-semibold text-destructive text-sm">
								Google review sync needs attention
							</h2>
							<p className="text-xs">
								Reminders remain paused until synchronization succeeds.
								{connection?.lastSyncError
									? ` ${String(connection.lastSyncError)}`
									: ""}
							</p>
						</Card>
					) : null}
					{reviews.length ? (
						<ReviewGrid reviews={serializableReviews} />
					) : (
						<Card className="p-8 text-center text-muted-foreground">
							No Google reviews have been synchronized yet.
						</Card>
					)}
				</main>
			</AppShell>
		</HydrationBoundary>
	);
}
