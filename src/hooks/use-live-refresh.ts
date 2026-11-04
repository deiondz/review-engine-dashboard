"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

export function useLiveRefresh(intervalMs = 3000) {
	const router = useRouter();
	const [isRefreshing, startManualTransition] = useTransition();
	const [, startBackgroundTransition] = useTransition();
	const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

	const refresh = useCallback(() => {
		if (document.visibilityState !== "visible") return;
		startManualTransition(() => {
			router.refresh();
			setLastRefreshAt(new Date());
		});
	}, [router]);
	const refreshSilently = useCallback(() => {
		if (document.visibilityState !== "visible") return;
		startBackgroundTransition(() => {
			router.refresh();
			setLastRefreshAt(new Date());
		});
	}, [router]);

	useEffect(() => {
		const interval = window.setInterval(refreshSilently, intervalMs);
		const refreshWhenVisible = () => {
			if (document.visibilityState === "visible") refreshSilently();
		};

		document.addEventListener("visibilitychange", refreshWhenVisible);
		window.addEventListener("focus", refreshSilently);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", refreshWhenVisible);
			window.removeEventListener("focus", refreshSilently);
		};
	}, [intervalMs, refreshSilently]);

	return { isRefreshing, lastRefreshAt, refresh };
}
