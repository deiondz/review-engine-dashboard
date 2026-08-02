import { readFileSync } from "node:fs";

const input = readFileSync("src/components/ui/input.tsx", "utf8");
const interior = readFileSync(
	"src/components/interior/interior-controls.tsx",
	"utf8",
);
const createOrganization = readFileSync(
	"src/components/auth/organization/create-organization-dialog.tsx",
	"utf8",
);
const slugField = readFileSync(
	"src/components/auth/organization/slug-field.tsx",
	"utf8",
);
const styles = readFileSync("src/styles/app.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const automation = readFileSync(
	"src/components/automation/automation-guide.tsx",
	"utf8",
);
const card = readFileSync("src/components/ui/card.tsx", "utf8");
const button = readFileSync("src/components/ui/button.tsx", "utf8");
const appShell = readFileSync("src/components/app-shell/app-shell.tsx", "utf8");
const dataPagination = readFileSync(
	"src/components/ui/data-pagination.tsx",
	"utf8",
);

const checks = [
	[
		"inputs use Coss sizing and padding",
		input.includes('"h-9 w-full') && input.includes("px-3.5"),
	],
	[
		"dashboard fields use the Coss input primitive",
		interior.includes('from "@/components/ui/input"') &&
			interior.includes("<FieldLabel") &&
			interior.includes("<Input") &&
			!interior.includes('className="peer h-12'),
	],
	[
		"default buttons are solid",
		!interior.includes(
			'"border-border bg-background text-foreground hover:bg-muted"',
		),
	],
	[
		"dashboard actions use the Coss button primitive",
		interior.includes('from "@/components/ui/button"') &&
			!interior.includes("<motion.button") &&
			interior.includes("loading={pending}") &&
			dataPagination.includes("<Button") &&
			!dataPagination.includes("<button"),
	],
	["dropdown uses a real caret icon", interior.includes("<CaretDown")],
	[
		"dropdown trigger has fixed alignment",
		interior.includes('className="h-11 w-full justify-between gap-3'),
	],
	["modal supports demo-width content", interior.includes("max-w-2xl")],
	[
		"organization fields share modal padding",
		createOrganization.includes('className="space-y-5 px-6 py-6"'),
	],
	[
		"organization footer uses compact rhythm",
		createOrganization.includes('className="border-t px-6 py-4"') &&
			createOrganization.includes('variant="outline"'),
	],
	["slug includes helper guidance", slugField.includes("FieldDescription")],
	[
		"Coss light background token is used",
		styles.includes("--background: var(--color-white)"),
	],
	[
		"Coss translucent borders are used",
		styles.includes("--border: --alpha(var(--color-black) / 8%)"),
	],
	[
		"Coss dark surface mixing is used",
		styles.includes("var(--color-neutral-950) 95%"),
	],
	[
		"Base UI root isolation is enabled",
		layout.includes("isolate relative flex min-h-svh"),
	],
	[
		"campaign fields provide useful examples",
		automation.includes('placeholder="e.g. Deion Williams"') &&
			automation.includes('placeholder="e.g. Praveen"') &&
			automation.includes("e.g. https://g.page/r/your-business/review"),
	],
	[
		"cards and primary actions have no decorative shadows",
		!card.includes("shadow-xs/5") &&
			!card.includes("before:shadow") &&
			!button.includes("shadow-primary") &&
			!interior.includes("shadow-2xl") &&
			!interior.includes("shadow-xl"),
	],
	[
		"cards have a distinct high-contrast edge",
		card.includes("border-foreground/15"),
	],
	[
		"dashboard canvas contrasts with white cards",
		appShell.includes("bg-neutral-100") &&
			appShell.includes("dark:bg-background") &&
			styles.includes("--card: var(--color-white)"),
	],
	[
		"dashboard uses strong heading typography",
		automation.includes("font-heading font-bold text-2xl") &&
			automation.includes("font-heading font-bold text-lg"),
	],
];

let failed = false;
for (const [label, passed] of checks) {
	console.log(`${passed ? "PASS" : "FAIL"}: ${label}`);
	failed ||= !passed;
}
if (failed) process.exit(1);
