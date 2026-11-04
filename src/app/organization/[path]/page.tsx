import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getOnboardingProfile } from "@/application/onboarding";
import { AppShell } from "@/components/app-shell/app-shell";
import { Organization } from "@/components/auth/organization/organization";
import { MaxWidthContainer } from "@/components/max-width-container";
import { auth } from "@/lib/auth";
import { organizationPlugin } from "@/lib/auth/organization-plugin";
import { getQueryClient } from "@/lib/query-client";

const validOrganizationPaths = Object.values(
	organizationPlugin().viewPaths.organization,
);

export default async function OrganizationPage({
	params,
}: {
	params: Promise<{ path: string }>;
}) {
	const { path } = await params;

	if (!validOrganizationPaths.includes(path)) {
		notFound();
	}

	const queryClient = getQueryClient();
	const session = await ensureSession(queryClient, auth, {
		headers: await headers(),
	});

	if (!session) {
		redirect(
			`/auth/sign-in?redirectTo=${encodeURIComponent(`/organization/${path}`)}`,
		);
	}
	const organizationId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	if (organizationId) {
		const onboarding = await getOnboardingProfile(organizationId);
		if (!onboarding?.completed) redirect("/onboarding");
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AppShell session={session} breadcrumbPage="Organization settings">
				<MaxWidthContainer size="narrow" className="md:py-6">
					<Organization path={path} />
				</MaxWidthContainer>
			</AppShell>
		</HydrationBoundary>
	);
}
