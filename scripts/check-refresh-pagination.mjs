import { readFileSync } from "node:fs";

const dashboard = readFileSync(
	"src/components/automation/automation-guide.tsx",
	"utf8",
);
const pagination = readFileSync(
	"src/components/ui/data-pagination.tsx",
	"utf8",
);

const checks = [
	[
		"refresh animation is scoped to a manual refresh",
		dashboard.includes("isManualRefreshing") &&
			dashboard.includes("motion-safe:animate-spin"),
	],
	[
		"refresh uses an accessible icon-only Coss button",
		dashboard.includes('aria-label="Refresh data"') &&
			dashboard.includes('size="icon-lg"') &&
			dashboard.includes("loading={isManualRefreshing}") &&
			dashboard.includes("<TooltipPopup") &&
			!dashboard.includes("Live · Refresh now"),
	],
	[
		"rows-per-page uses the shared Coss select",
		pagination.includes('from "@/components/ui/select"') &&
			!pagination.includes("<select"),
	],
];

let failed = false;
for (const [label, passed] of checks) {
	console.log(`${passed ? "PASS" : "FAIL"}: ${label}`);
	failed ||= !passed;
}

if (failed) process.exit(1);
