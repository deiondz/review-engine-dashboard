export type OrganizationCreatedRouter = {
	replace: (href: string) => void;
};

export function goToOrganizationOnboarding(
	router: OrganizationCreatedRouter,
	organizationId: string,
	activateOrganization: (organizationId: string) => Promise<void>,
): Promise<void> {
	return activateOrganization(organizationId).then(() => {
		router.replace("/onboarding");
	});
}
