import { readFileSync } from "node:fs";

const createOrganization = readFileSync(
	"src/components/auth/organization/create-organization-dialog.tsx",
	"utf8",
);
const inviteMember = readFileSync(
	"src/components/auth/organization/invite-member-dialog.tsx",
	"utf8",
);

const checks = [
	[
		"create organization uses one padded content column",
		createOrganization.includes('className="space-y-5 px-6 py-6"') &&
			createOrganization.includes('className="border-t px-6 py-4"'),
	],
	[
		"invite member uses one padded content column",
		inviteMember.includes('className="space-y-5 px-6 py-6"') &&
			inviteMember.includes('className="border-t px-6 py-4"'),
	],
	[
		"organization modal actions use Coss variants",
		createOrganization.includes('variant="outline"') &&
			inviteMember.includes('variant="outline"') &&
			createOrganization.includes("loading={isCreating}") &&
			inviteMember.includes("loading={isInviting}"),
	],
];

let failed = false;
for (const [label, passed] of checks) {
	console.log(`${passed ? "PASS" : "FAIL"}: ${label}`);
	failed ||= !passed;
}

if (failed) process.exit(1);
