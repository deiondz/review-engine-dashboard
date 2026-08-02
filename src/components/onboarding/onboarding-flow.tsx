"use client";

import { ArrowRight, Check, WhatsappLogo } from "@phosphor-icons/react";
import { useActionState, useEffect, useState } from "react";
import { connectSession } from "@/app/actions/messaging";
import {
	type OnboardingState,
	saveBusinessDetails,
} from "@/app/actions/onboarding";
import type { OnboardingProfile } from "@/application/onboarding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: OnboardingState = { status: "idle", message: "" };

export function OnboardingFlow({
	defaultBusinessName,
	defaultEmail,
	profile,
}: {
	defaultBusinessName: string;
	defaultEmail: string;
	profile: OnboardingProfile | null;
}) {
	const [step, setStep] = useState(profile ? 2 : 1);
	const [state, saveAction, saving] = useActionState(
		saveBusinessDetails,
		initialState,
	);

	useEffect(() => {
		if (state.status === "success") setStep(2);
	}, [state.status]);

	return (
		<div className="w-full max-w-xl">
			<div className="mb-7 text-center">
				<p className="font-medium text-primary text-sm">Quick setup</p>
				<h1 className="mt-2 font-heading font-bold text-3xl tracking-tight">
					Start requesting Google reviews
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Just the essentials. You can change these details later.
				</p>
			</div>

			<div
				className="mb-4 flex items-center gap-3"
				aria-label={`Step ${step} of 2`}
				aria-valuemax={2}
				aria-valuemin={1}
				aria-valuenow={step}
				role="progressbar"
			>
				<div className="h-1.5 flex-1 rounded-full bg-primary" />
				<div
					className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-primary" : "bg-muted"}`}
				/>
				<span className="text-muted-foreground text-xs">{step} of 2</span>
			</div>

			<Card className="p-6 shadow-sm md:p-8">
				{step === 1 ? (
					<BusinessDetailsForm
						action={saveAction}
						defaultBusinessName={profile?.businessName || defaultBusinessName}
						defaultEmail={profile?.contactEmail || defaultEmail}
						profile={profile}
						saving={saving}
						state={state}
					/>
				) : (
					<WhatsAppStep onBack={() => setStep(1)} />
				)}
			</Card>
		</div>
	);
}

function BusinessDetailsForm({
	action,
	defaultBusinessName,
	defaultEmail,
	profile,
	saving,
	state,
}: {
	action: (formData: FormData) => void;
	defaultBusinessName: string;
	defaultEmail: string;
	profile: OnboardingProfile | null;
	saving: boolean;
	state: OnboardingState;
}) {
	return (
		<form action={action} className="space-y-5">
			<div>
				<h2 className="font-semibold text-xl">Your business</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					We’ll use this information in your review requests.
				</p>
			</div>
			<OnboardingField label="Business name" name="businessName">
				<Input
					nativeInput
					name="businessName"
					defaultValue={defaultBusinessName}
					placeholder="Acme Dental"
					required
					minLength={2}
				/>
			</OnboardingField>
			<OnboardingField label="Owner name" name="ownerName">
				<Input
					nativeInput
					name="ownerName"
					defaultValue={profile?.ownerName}
					placeholder="Priya Sharma"
					required
					minLength={2}
					autoComplete="name"
				/>
			</OnboardingField>
			<div className="grid gap-5 sm:grid-cols-2">
				<OnboardingField label="Primary contact email" name="contactEmail">
					<Input
						nativeInput
						name="contactEmail"
						defaultValue={defaultEmail}
						type="email"
						placeholder="owner@business.com"
						required
						autoComplete="email"
					/>
				</OnboardingField>
				<OnboardingField label="Primary contact phone" name="contactPhone">
					<Input
						nativeInput
						name="contactPhone"
						defaultValue={profile?.contactPhone}
						type="tel"
						placeholder="+919876543210"
						pattern="\+[1-9][0-9]{7,14}"
						required
						autoComplete="tel"
					/>
				</OnboardingField>
			</div>
			<OnboardingField
				label="Google review link"
				name="googleReviewUrl"
				description="Paste the direct link customers use to leave a review."
			>
				<Input
					nativeInput
					name="googleReviewUrl"
					defaultValue={profile?.googleReviewUrl}
					type="url"
					placeholder="https://g.page/r/your-business/review"
					required
				/>
			</OnboardingField>
			{state.status === "error" ? (
				<p className="text-destructive text-sm" role="alert">
					{state.message}
				</p>
			) : null}
			<Button className="w-full" size="lg" type="submit" loading={saving}>
				Continue <ArrowRight />
			</Button>
		</form>
	);
}

function OnboardingField({
	label,
	name,
	description,
	children,
}: {
	label: string;
	name: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<Field>
			<FieldLabel htmlFor={name}>{label}</FieldLabel>
			{children}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}

function WhatsAppStep({ onBack }: { onBack: () => void }) {
	return (
		<div className="space-y-6">
			<div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
				<WhatsappLogo size={26} weight="fill" />
			</div>
			<div>
				<h2 className="font-semibold text-xl">Connect WhatsApp</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Connect the number you’ll use to send review requests. A QR code will
					appear on the dashboard for you to scan.
				</p>
			</div>
			<div className="rounded-lg border bg-muted/30 p-4 text-sm">
				<div className="flex gap-3">
					<Check className="mt-0.5 shrink-0 text-primary" />
					<span>Use WhatsApp on your phone to scan the QR code.</span>
				</div>
			</div>
			<form action={connectSession}>
				<input type="hidden" name="name" value="main" />
				<input type="hidden" name="authType" value="qr" />
				<input type="hidden" name="finishOnboarding" value="true" />
				<Button className="w-full" size="lg" type="submit">
					<WhatsappLogo weight="fill" /> Connect WhatsApp
				</Button>
			</form>
			<button
				className="mx-auto block text-muted-foreground text-sm hover:text-foreground"
				type="button"
				onClick={onBack}
			>
				Back to business details
			</button>
		</div>
	);
}
