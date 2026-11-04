"use client";

import {
	type OrganizationAuthClient,
	useAuth,
	useAuthPlugin,
	useCreateOrganization,
} from "@better-auth-ui/react";
import { Briefcase } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useEffect, useState } from "react";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { organizationPlugin } from "@/lib/auth/organization-plugin";
import { goToOrganizationOnboarding } from "./organization-created-navigation";
import { SlugField, sanitizeSlug } from "./slug-field";

/** Props for the `CreateOrganizationDialog` component. */
export type CreateOrganizationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CreateOrganizationDialog({
	open,
	onOpenChange,
}: CreateOrganizationDialogProps) {
	const router = useRouter();
	const { authClient, localization } = useAuth();
	const organizationAuthClient = authClient as OrganizationAuthClient;
	const { localization: organizationLocalization } =
		useAuthPlugin(organizationPlugin);

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugEdited, setSlugEdited] = useState(false);
	const [nameError, setNameError] = useState<string>();

	const {
		mutate: createOrganization,
		isPending: isCreating,
		error: createOrganizationError,
	} = useCreateOrganization(organizationAuthClient, {
		onSuccess: async (createdOrganization) => {
			onOpenChange(false);
			await goToOrganizationOnboarding(
				router,
				createdOrganization.id,
				async (organizationId) => {
					const result = await organizationAuthClient.organization.setActive({
						organizationId,
					});
					if (result.error) throw new Error(result.error.message);
				},
			);
		},
	});

	const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (name.trim().length < 2) {
			setNameError("Enter at least 2 characters.");
			return;
		}
		createOrganization({ name, slug });
	};
	const isValid =
		name.trim().length >= 2 &&
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
		slug.length <= 64;

	useEffect(() => {
		if (!open) {
			setSlug("");
			setName("");
			setSlugEdited(false);
			setNameError(undefined);
		}
	}, [open]);

	useEffect(() => {
		if (slugEdited) return;
		setSlug(sanitizeSlug(name));
	}, [name, slugEdited]);

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-md">
				<form onSubmit={handleSubmit} className="flex flex-col">
					<AlertDialogHeader className="px-6 pb-0 pt-6">
						<AlertDialogMedia>
							<Briefcase />
						</AlertDialogMedia>

						<AlertDialogTitle>
							{organizationLocalization.createOrganization}
						</AlertDialogTitle>

						<AlertDialogDescription>
							{organizationLocalization.organizationsDescription}
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="space-y-5 px-6 py-6">
						<Field data-invalid={!!nameError}>
							<Label htmlFor="create-organization-name">
								{organizationLocalization.name}
							</Label>

							<Input
								id="create-organization-name"
								name="name"
								autoFocus
								required
								minLength={2}
								maxLength={100}
								placeholder="Acme Technologies"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									setNameError(undefined);
								}}
								onInvalid={(e) => {
									e.preventDefault();
									setNameError(localization.auth.fieldRequired);
								}}
								aria-invalid={!!nameError}
								aria-describedby="create-organization-name-description"
								disabled={isCreating}
							/>
							<FieldDescription id="create-organization-name-description">
								Use the customer-facing name of your business or team.
							</FieldDescription>

							<FieldError>{nameError}</FieldError>
						</Field>

						<SlugField
							id="create-organization-slug"
							value={slug}
							onChange={(value) => {
								setSlug(value);
								setSlugEdited(true);
							}}
							disabled={isCreating}
						/>
						{createOrganizationError ? (
							<p
								className="text-destructive text-sm"
								role="alert"
								aria-live="polite"
							>
								{createOrganizationError instanceof Error
									? createOrganizationError.message
									: "Could not create the organization. Try a different name or slug."}
							</p>
						) : null}
					</div>

					<AlertDialogFooter className="border-t px-6 py-4">
						<AlertDialogCancel variant="outline" disabled={isCreating}>
							{localization.settings.cancel}
						</AlertDialogCancel>

						<Button type="submit" loading={isCreating} disabled={!isValid}>
							{organizationLocalization.createOrganization}
						</Button>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	);
}
