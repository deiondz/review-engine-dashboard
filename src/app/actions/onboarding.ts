"use server";

import { headers } from "next/headers";
import { saveOnboardingProfile } from "@/application/onboarding";
import { auth } from "@/lib/auth";

export type OnboardingState = {
	status: "idle" | "success" | "error";
	message: string;
};

async function activeOrganizationId() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) throw new Error("Sign in to continue");
	const organizationId = (
		session.session as typeof session.session & {
			activeOrganizationId?: string | null;
		}
	).activeOrganizationId;
	if (!organizationId) throw new Error("Select an organization first");
	return organizationId;
}

export async function saveBusinessDetails(
	_previous: OnboardingState,
	formData: FormData,
): Promise<OnboardingState> {
	try {
		const organizationId = await activeOrganizationId();
		const businessName = String(formData.get("businessName") ?? "").trim();
		const ownerName = String(formData.get("ownerName") ?? "").trim();
		const contactEmail = String(formData.get("contactEmail") ?? "").trim();
		const contactPhone = String(formData.get("contactPhone") ?? "").trim();
		const googleReviewUrl = String(
			formData.get("googleReviewUrl") ?? "",
		).trim();

		if (businessName.length < 2) throw new Error("Enter your business name");
		if (ownerName.length < 2) throw new Error("Enter the owner name");
		if (!/^\S+@\S+\.\S+$/.test(contactEmail))
			throw new Error("Enter a valid contact email");
		if (!/^\+[1-9][0-9]{7,14}$/.test(contactPhone))
			throw new Error(
				"Use an international phone number, such as +919876543210",
			);
		let url: URL;
		try {
			url = new URL(googleReviewUrl);
		} catch {
			throw new Error("Enter a valid Google review link");
		}
		if (url.protocol !== "https:")
			throw new Error("Google review link must use HTTPS");

		await saveOnboardingProfile(organizationId, {
			businessName,
			ownerName,
			contactEmail,
			contactPhone,
			googleReviewUrl,
		});
		return { status: "success", message: "Business details saved" };
	} catch (error) {
		return {
			status: "error",
			message:
				error instanceof Error ? error.message : "Could not save details",
		};
	}
}
