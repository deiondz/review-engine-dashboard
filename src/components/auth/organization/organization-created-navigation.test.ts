import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { goToOrganizationOnboarding } from "./organization-created-navigation";

describe("goToOrganizationOnboarding", () => {
	it("activates the created organization before entering onboarding", async () => {
		const events: string[] = [];
		const replace = (href: string) => events.push(`navigate:${href}`);
		const activate = async (organizationId: string) => {
			events.push(`activate:${organizationId}`);
		};

		await goToOrganizationOnboarding({ replace }, "org-new", activate);

		assert.deepEqual(events, ["activate:org-new", "navigate:/onboarding"]);
	});
});
