"use client";

import { CaretDown, X } from "@phosphor-icons/react";
// Adapted from interior.dev (MIT): https://github.com/ddoemonn/interior
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input, type InputProps } from "@/components/ui/input";

const SPRING = {
	type: "spring",
	stiffness: 420,
	damping: 36,
	mass: 0.9,
} as const;
const QUICK = [0.23, 1, 0.32, 1] as const;

export function InteriorModal({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	panelClassName,
}: {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	panelClassName?: string;
}) {
	const reduced = useReducedMotion();
	const titleId = useId();
	const panel = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);
	useEffect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		panel.current?.querySelector<HTMLElement>("input, button")?.focus();
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.body.style.overflow = overflow;
			document.removeEventListener("keydown", handleEscape);
			previous?.focus();
		};
	}, [open, onClose]);

	if (!mounted) return null;
	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={
						reduced ? { duration: 0 } : { duration: 0.18, ease: QUICK }
					}
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) onClose();
					}}
				>
					<div className="absolute inset-0 -z-10 bg-black/45 backdrop-blur-[2px]" />
					<motion.div
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={
							reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }
						}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
						transition={reduced ? { duration: 0 } : SPRING}
						className={`relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background text-foreground outline-none ${panelClassName ?? ""}`}
					>
						<div className="flex items-start gap-4 border-b px-6 py-5">
							<div className="min-w-0 flex-1">
								<h2 id={titleId} className="font-semibold tracking-tight">
									{title}
								</h2>
								{description ? (
									<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
										{description}
									</p>
								) : null}
							</div>
							<InteriorButton
								aria-label="Close dialog"
								onClick={onClose}
								size="icon"
							>
								<X weight="bold" />
							</InteriorButton>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
							{children}
						</div>
						{footer ? (
							<div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-4">
								{footer}
							</div>
						) : null}
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

export function InteriorButton({
	children,
	variant = "default",
	size = "default",
	className,
	...props
}: Omit<ButtonProps, "variant" | "size"> & {
	variant?: "default" | "primary" | "danger";
	size?: "default" | "sm" | "icon";
}) {
	const cossVariant: ButtonProps["variant"] =
		variant === "primary"
			? "default"
			: variant === "danger"
				? "destructive"
				: "outline";
	const cossSize: ButtonProps["size"] = size === "icon" ? "icon" : size;

	return (
		<Button
			className={className}
			size={cossSize}
			variant={cossVariant}
			{...props}
		>
			{children}
		</Button>
	);
}

export function InteriorSubmitButton({
	children,
	pendingLabel = "Working…",
	variant = "primary",
	className,
}: {
	children: ReactNode;
	pendingLabel?: string;
	variant?: "default" | "primary" | "danger";
	className?: string;
}) {
	const { pending } = useFormStatus();
	return (
		<InteriorButton
			type="submit"
			loading={pending}
			aria-label={pending ? pendingLabel : undefined}
			variant={variant}
			className={className}
		>
			{children}
		</InteriorButton>
	);
}

export function InteriorInput({
	label,
	description,
	className,
	...props
}: InputProps & { label: string; description?: string }) {
	const id = useId();
	return (
		<Field className={className}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input nativeInput id={id} {...props} />
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}

export type InteriorDropdownItem = {
	value: string;
	label: string;
	hint?: string;
};

export function InteriorDropdown({
	name,
	label,
	items,
	value,
	onChange,
}: {
	name: string;
	label: string;
	items: InteriorDropdownItem[];
	value: string;
	onChange: (value: string) => void;
}) {
	const reduced = useReducedMotion();
	const root = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const selected = items.find((item) => item.value === value) ?? items[0];
	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [open]);
	return (
		<div ref={root} className="relative">
			<input type="hidden" name={name} value={value} />
			<InteriorButton
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
				className="h-11 w-full justify-between gap-3"
			>
				<span className="min-w-0 truncate text-left">
					<span className="text-muted-foreground">{label}:</span>{" "}
					{selected?.label}
				</span>
				<motion.span
					className="flex shrink-0 items-center justify-center"
					animate={{ rotate: open ? 180 : 0 }}
					transition={reduced ? { duration: 0 } : SPRING}
				>
					<CaretDown size={16} weight="bold" />
				</motion.span>
			</InteriorButton>
			<AnimatePresence>
				{open ? (
					<motion.ul
						role="menu"
						initial={
							reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }
						}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98, y: -4 }}
						transition={reduced ? { duration: 0 } : SPRING}
						className="absolute z-10 mt-1.5 w-full rounded-lg border bg-popover p-1.5 text-popover-foreground"
					>
						{items.map((item) => (
							<li key={item.value} role="none">
								<Button
									type="button"
									role="menuitemradio"
									aria-checked={item.value === value}
									onClick={() => {
										onChange(item.value);
										setOpen(false);
									}}
									className="h-9 w-full justify-start border-transparent px-2.5 text-left"
									variant="ghost"
								>
									<span>{item.label}</span>
									{item.hint ? (
										<span className="ml-auto text-xs text-muted-foreground">
											{item.hint}
										</span>
									) : null}
								</Button>
							</li>
						))}
					</motion.ul>
				) : null}
			</AnimatePresence>
		</div>
	);
}
