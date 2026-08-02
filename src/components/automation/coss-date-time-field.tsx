"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { format, isSameDay } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";

const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
	const hours = Math.floor(index / 2);
	const minutes = index % 2 === 0 ? "00" : "30";
	return `${String(hours).padStart(2, "0")}:${minutes}`;
});

export function CossDateTimeField({ name }: { name: string }) {
	const [date, setDate] = useState(() => new Date());
	const [time, setTime] = useState(() => format(new Date(), "HH:mm"));
	const [open, setOpen] = useState(false);
	const today = new Date();
	const value = useMemo(() => {
		const [hours = "0", minutes = "0"] = time.split(":");
		const completed = new Date(date);
		completed.setHours(Number(hours), Number(minutes), 0, 0);
		return completed.toISOString();
	}, [date, time]);

	return (
		<Field>
			<FieldLabel>Completed at</FieldLabel>
			<input name={name} type="hidden" value={value} />
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							className="w-full justify-start font-normal"
							type="button"
							variant="outline"
						/>
					}
				>
					<CalendarBlank />
					<span className="truncate">
						{format(date, "PPP")} at {time}
					</span>
				</PopoverTrigger>
				<PopoverPopup
					align="start"
					className="w-auto max-w-[calc(100vw-2rem)] p-0"
				>
					<div className="flex max-sm:flex-col">
						<Calendar
							className="max-sm:pb-3 sm:pe-5"
							mode="single"
							selected={date}
							disabled={{ after: today }}
							onSelect={(selected) => {
								if (!selected) return;
								setDate(selected);
							}}
						/>
						<div className="relative w-full max-sm:h-48 sm:w-40">
							<div className="absolute inset-0 max-sm:border-t">
								<ScrollArea
									className="h-full sm:border-s"
									scrollbarGutter
									scrollFade
								>
									<div className="flex flex-col gap-3 py-3 sm:pt-0 sm:pb-2">
										<div className="flex h-8 shrink-0 items-center px-3 font-medium text-sm sm:px-5">
											{format(date, "EEEE, d")}
										</div>
										<ToggleGroup
											aria-label="Completion time"
											className="grid w-full grid-cols-2 gap-1.5 px-3 sm:grid-cols-1 sm:px-5"
											onValueChange={(values) => {
												const selectedTime = values[0];
												if (!selectedTime) return;
												setTime(selectedTime);
												setOpen(false);
											}}
											value={[time]}
										>
											{TIME_SLOTS.map((timeSlot) => {
												const [hours = "0", minutes = "0"] =
													timeSlot.split(":");
												const slotDate = new Date(date);
												slotDate.setHours(Number(hours), Number(minutes), 0, 0);
												const available =
													!isSameDay(date, today) || slotDate <= today;

												return (
													<Toggle
														disabled={!available}
														key={timeSlot}
														size="sm"
														value={timeSlot}
														variant="outline"
													>
														{timeSlot}
													</Toggle>
												);
											})}
										</ToggleGroup>
									</div>
								</ScrollArea>
							</div>
						</div>
					</div>
				</PopoverPopup>
			</Popover>
			<FieldDescription>
				Defaults to now. Choose when the job was completed; future times are
				disabled.
			</FieldDescription>
		</Field>
	);
}
