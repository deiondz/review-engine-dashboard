import { existsSync, readFileSync } from "node:fs";

const settingsRoute = readFileSync("src/app/settings/[path]/page.tsx", "utf8");
const organizationRoutePath = "src/app/organization/[path]/page.tsx";
const organizationRoute = existsSync(organizationRoutePath)
	? readFileSync(organizationRoutePath, "utf8")
	: "";

const checks = [
	[
		"settings accepts organization plugin paths",
		settingsRoute.includes("organizationPlugin().viewPaths.settings"),
	],
	[
		"organization management route exists",
		existsSync(organizationRoutePath) &&
			organizationRoute.includes(
				"organizationPlugin().viewPaths.organization",
			) &&
			organizationRoute.includes("<Organization path={path}"),
	],
];

let failed = false;
for (const [label, passed] of checks) {
	console.log(`${passed ? "PASS" : "FAIL"}: ${label}`);
	failed ||= !passed;
}

if (failed) process.exit(1);
