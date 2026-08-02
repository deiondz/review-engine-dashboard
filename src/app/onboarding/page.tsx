import { ensureSession } from "@better-auth-ui/react/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOnboardingProfile } from "@/application/onboarding";
import { Logo } from "@/components/logo";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

export default async function OnboardingPage() {
	const requestHeaders = await headers();
	const session = await ensureSession(getQueryClient(), auth, {
		headers: requestHeaders,
	});
	if (!session) redirect("/auth/sign-in?redirectTo=%2Fonboarding");
	const organizationId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	if (!organizationId) redirect("/");
	const profile = await getOnboardingProfile(organizationId);
	if (profile?.completed) redirect("/");
	const organization = await auth.api.getFullOrganization({
		headers: requestHeaders,
	});

	return (
		<main className="relative flex min-h-svh flex-col bg-muted/25 p-5">
			<div className="mx-auto flex w-full max-w-6xl items-center py-2">
				<Logo alt="Review Engine" className="h-8" />
				<span className="ml-2 font-semibold">Review Engine</span>
			</div>
			<div className="flex flex-1 items-center justify-center py-10">
				<OnboardingFlow
					defaultBusinessName={organization?.name ?? ""}
					defaultEmail={session.user.email}
					profile={profile}
				/>
			</div>
		</main>
	);
}
