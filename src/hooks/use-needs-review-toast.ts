"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const storageKey = "review-dashboard:notified-feedback";

export function useNeedsReviewToast(replies: Array<Record<string, unknown>>) {
	const signature = replies
		.filter(
			(reply) =>
				reply.needsReview === true ||
				(reply.sentiment === "negative" && reply.reviewStatus !== "resolved"),
		)
		.map((reply) => String(reply.id ?? reply.replyId ?? ""))
		.filter(Boolean)
		.join("|");

	useEffect(() => {
		if (!signature) return;
		const currentIds = signature.split("|");
		let notified = new Set<string>();
		try {
			notified = new Set(
				JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]"),
			);
		} catch {
			notified = new Set();
		}
		const newIds = currentIds.filter((id) => !notified.has(id));
		if (newIds.length === 0) return;

		toast.warning("Customer feedback needs review", {
			description: `${newIds.length} negative ${newIds.length === 1 ? "response is" : "responses are"} waiting for your attention. Google review requests are blocked.`,
			duration: 10_000,
		});
		for (const id of newIds) notified.add(id);
		window.sessionStorage.setItem(
			storageKey,
			JSON.stringify([...notified].slice(-200)),
		);
	}, [signature]);
}
