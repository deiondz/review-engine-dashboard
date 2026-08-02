import "server-only";

import mongoose from "mongoose";
import env from "@/../env.config";
import { connectDatabase } from "@/composition/database-container";

export type OnboardingProfile = {
	businessName: string;
	ownerName: string;
	contactEmail: string;
	contactPhone: string;
	googleReviewUrl: string;
	completed: boolean;
};

const collection = async () => {
	await connectDatabase();
	return mongoose.connection
		.getClient()
		.db(env.REVIEWS_DATABASE_NAME)
		.collection("organization_onboarding");
};

export async function getOnboardingProfile(
	organizationId: string,
): Promise<OnboardingProfile | null> {
	const profile = await (await collection()).findOne({ organizationId });
	if (!profile) return null;
	return {
		businessName: String(profile.businessName ?? ""),
		ownerName: String(profile.ownerName ?? ""),
		contactEmail: String(profile.contactEmail ?? ""),
		contactPhone: String(profile.contactPhone ?? ""),
		googleReviewUrl: String(profile.googleReviewUrl ?? ""),
		completed: profile.completed === true,
	};
}

export async function saveOnboardingProfile(
	organizationId: string,
	profile: Omit<OnboardingProfile, "completed">,
) {
	const now = new Date();
	await (await collection()).updateOne(
		{ organizationId },
		{
			$set: { ...profile, updatedAt: now },
			$setOnInsert: { organizationId, completed: false, createdAt: now },
		},
		{ upsert: true },
	);
}

export async function completeOnboarding(organizationId: string) {
	await (await collection()).updateOne(
		{ organizationId },
		{
			$set: { completed: true, completedAt: new Date(), updatedAt: new Date() },
		},
	);
}
