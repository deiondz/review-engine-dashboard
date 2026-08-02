import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAutomationHealth } from "@/application/automation-health";
import { AppShell } from "@/components/app-shell/app-shell";
import { AutomationGuide } from "@/components/automation/automation-guide";
import { getPipelineReadService } from "@/composition/pipeline-container";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

export default async function AutomationPage() {
	const requestHeaders = await headers();
	const queryClient = getQueryClient();
	const session = await ensureSession(queryClient, auth, {
		headers: requestHeaders,
	});
	if (!session) redirect("/auth/sign-in?redirectTo=%2Fautomation");

	const businessId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	const [snapshot, automationHealth] = await Promise.all([
		businessId ? getPipelineReadService().getSnapshot(businessId) : null,
		getAutomationHealth(),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AppShell session={session} breadcrumbPage="Automation">
				<AutomationGuide
					businessId={businessId ?? null}
					data={snapshot}
					health={automationHealth}
				/>
			</AppShell>
		</HydrationBoundary>
	);
}
