import "server-only";

import env from "@/../env.config";

export type AutomationHealth = {
	messaging: "healthy" | "degraded";
	n8n: "healthy" | "degraded";
	database: "healthy";
	checkedAt: string;
};

async function reachable(url: string) {
	try {
		const response = await fetch(url, {
			cache: "no-store",
			signal: AbortSignal.timeout(3000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

export async function getAutomationHealth(): Promise<AutomationHealth> {
	const [messaging, n8n] = await Promise.all([
		reachable(new URL("/health", env.MESSAGING_SERVICE_URL).toString()),
		reachable(env.N8N_HEALTH_URL),
	]);
	return {
		messaging: messaging ? "healthy" : "degraded",
		n8n: n8n ? "healthy" : "degraded",
		database: "healthy",
		checkedAt: new Date().toISOString(),
	};
}
