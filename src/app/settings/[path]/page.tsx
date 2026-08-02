import { viewPaths } from "@better-auth-ui/core";
import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { configureGoogleMapsLocationAction } from "@/app/actions/reviews";
import { getOnboardingProfile } from "@/application/onboarding";
import { AppShell } from "@/components/app-shell/app-shell";
import { Settings } from "@/components/auth/settings/settings";
import { MaxWidthContainer } from "@/components/max-width-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getGoogleConnection } from "@/infrastructure/database/mongo/mongo-review-store";
import { auth } from "@/lib/auth";
import { organizationPlugin } from "@/lib/auth/organization-plugin";
import { getQueryClient } from "@/lib/query-client";

const validSettingsPaths = [
	...Object.values(viewPaths.settings),
	...Object.values(organizationPlugin().viewPaths.settings ?? {}),
];

export default async function SettingsPage({
	params,
}: {
	params: Promise<{
		path: string;
	}>;
}) {
	const { path } = await params;

	if (!validSettingsPaths.includes(path)) {
		notFound();
	}

	const requestHeaders = await headers();
	const queryClient = getQueryClient();

	const session = await ensureSession(queryClient, auth, {
		headers: requestHeaders,
	});

	if (!session) {
		redirect(
			`/auth/sign-in?redirectTo=${encodeURIComponent(`/settings/${path}`)}`,
		);
	}
	const organizationId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	let mapsUrl = "";
	let canManageLocation = false;
	if (organizationId) {
		const [onboarding, connection, organization] = await Promise.all([
			getOnboardingProfile(organizationId),
			getGoogleConnection(organizationId),
			auth.api.getFullOrganization({ headers: requestHeaders }),
		]);
		if (!onboarding?.completed) redirect("/onboarding");
		mapsUrl = String(connection?.mapsUrl ?? "");
		const membership = organization?.members.find(
			(member) => member.userId === session.user.id,
		);
		canManageLocation = Boolean(
			membership && ["owner", "admin"].includes(membership.role),
		);
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AppShell
				session={session}
				breadcrumbPage={
					path === viewPaths.settings.security
						? "Security"
						: path === organizationPlugin().viewPaths.settings?.organizations
							? "Organizations"
							: "Account"
				}
			>
				<MaxWidthContainer size="narrow" className="md:py-6">
					<Settings path={path} />
					{path === viewPaths.settings.account ? (
						<Card className="mt-6 p-5">
							<h2 className="font-semibold">Google Maps location</h2>
							<p className="text-muted-foreground text-sm">
								This location determines which Google reviews belong to your
								Business.
							</p>
							{canManageLocation ? (
								<form
									action={configureGoogleMapsLocationAction}
									className="mt-3 space-y-3"
								>
									<Input
										defaultValue={mapsUrl}
										name="mapsUrl"
										placeholder="https://maps.google.com/..."
										required
										type="url"
									/>
									<Button type="submit">Update location</Button>
								</form>
							) : (
								<p className="mt-3 break-all text-sm">
									{mapsUrl || "No location configured"}
								</p>
							)}
						</Card>
					) : null}
				</MaxWidthContainer>
			</AppShell>
		</HydrationBoundary>
	);
}
