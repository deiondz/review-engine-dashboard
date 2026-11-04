"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export function usePagination<T>(items: T[], initialPageSize = 10) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(initialPageSize);
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

	useEffect(() => {
		setPage((current) => Math.min(current, totalPages));
	}, [totalPages]);

	const pageItems = useMemo(() => {
		const start = (page - 1) * pageSize;
		return items.slice(start, start + pageSize);
	}, [items, page, pageSize]);

	return { page, pageItems, pageSize, setPage, setPageSize, totalPages };
}

export function DataPagination({
	page,
	pageSize,
	totalItems,
	onPageChange,
	onPageSizeChange,
}: {
	page: number;
	pageSize: number;
	totalItems: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
}) {
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
	const end = Math.min(page * pageSize, totalItems);
	const candidates = [1, page - 1, page, page + 1, totalPages]
		.filter((value) => value >= 1 && value <= totalPages)
		.filter((value, index, values) => values.indexOf(value) === index)
		.sort((a, b) => a - b);

	return (
		<div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex items-center gap-3 text-muted-foreground text-xs">
				<span className="tabular-nums">{start}–{end} of {totalItems}</span>
				<div className="flex items-center gap-2">
					<span id="rows-per-page-label">Rows</span>
					<Select
						value={String(pageSize)}
						onValueChange={(value) => {
							if (!value) return;
							onPageSizeChange(Number(value));
							onPageChange(1);
						}}
					>
						<SelectTrigger
							aria-label="Rows per page"
							aria-labelledby="rows-per-page-label"
							className="h-9 min-h-9 w-20 min-w-20 font-semibold"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{[5, 10, 20].map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			<nav aria-label="Table pagination" className="flex items-center gap-1.5">
				<PageButton label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><CaretLeft size={15} weight="bold" /></PageButton>
				{candidates.map((candidate, index) => {
					const previous = candidates[index - 1];
					return <span className="contents" key={candidate}>{previous && candidate - previous > 1 ? <span className="px-1 text-muted-foreground text-xs">…</span> : null}<PageButton active={candidate === page} label={`Page ${candidate}`} onClick={() => onPageChange(candidate)}>{candidate}</PageButton></span>;
				})}
				<PageButton label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><CaretRight size={15} weight="bold" /></PageButton>
			</nav>
		</div>
	);
}

function PageButton({ active = false, children, disabled = false, label, onClick }: { active?: boolean; children: React.ReactNode; disabled?: boolean; label: string; onClick: () => void }) {
	return <Button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} size="icon" variant={active ? "default" : "outline"}>{children}</Button>;
}
