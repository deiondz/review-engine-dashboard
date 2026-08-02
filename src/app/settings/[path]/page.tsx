import { viewPaths } from "@better-auth-ui/core";
import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { Settings } from "@/components/auth/settings/settings";
import { MaxWidthContainer } from "@/components/max-width-container";
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
				</MaxWidthContainer>
			</AppShell>
		</HydrationBoundary>
	);
}
