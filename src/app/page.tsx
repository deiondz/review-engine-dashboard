import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOnboardingProfile } from "@/application/onboarding";
import { AppShell } from "@/components/app-shell/app-shell";
import { OrganizationSwitcher } from "@/components/auth/organization/organization-switcher";
import { PipelineDashboard } from "@/components/dashboard/pipeline-dashboard";
import { Card } from "@/components/ui/card";
import { getPipelineReadService } from "@/composition/pipeline-container";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

export default async function Home() {
	const requestHeaders = await headers();
	const queryClient = getQueryClient();

	const session = await ensureSession(queryClient, auth, {
		headers: requestHeaders,
	});

	if (!session) {
		redirect("/auth/sign-in?redirectTo=%2F");
	}
	const businessId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	if (businessId) {
		const onboarding = await getOnboardingProfile(businessId);
		if (!onboarding?.completed) redirect("/onboarding");
	}
	const snapshot = businessId
		? await getPipelineReadService().getSnapshot(businessId)
		: null;

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AppShell session={session}>
				{snapshot ? (
					<PipelineDashboard data={snapshot} />
				) : (
					<main className="m-auto w-full max-w-xl p-6">
						<Card className="items-center p-8 text-center">
							<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xl">
								1
							</div>
							<h1 className="font-semibold text-2xl">
								Set up your organization
							</h1>
							<p className="mt-2 max-w-md text-muted-foreground">
								Create an organization for your business, or choose one you
								already belong to. Its data—including campaigns, replies,
								messages, and WhatsApp sessions—stays isolated from every other
								organization.
							</p>
							<div className="mt-6 rounded-xl border bg-muted/40 p-2">
								<OrganizationSwitcher hidePersonal hideSettings />
							</div>
							<p className="mt-4 text-muted-foreground text-xs">
								You can switch organizations later from the selector in the
								sidebar.
							</p>
						</Card>
					</main>
				)}
			</AppShell>
		</HydrationBoundary>
	);
}
