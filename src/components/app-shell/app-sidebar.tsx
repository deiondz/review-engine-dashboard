"use client";

import {
	ChatTeardropText,
	FlowArrow,
	Gear,
	House,
} from "@phosphor-icons/react/dist/ssr";
import type { User as BetterAuthUser } from "better-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { OrganizationSwitcher } from "@/components/auth/organization/organization-switcher";
import { UserButton } from "@/components/auth/user/user-button";
import { Logo } from "@/components/logo";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";

export function AppSidebar({
	session,
	...props
}: ComponentProps<typeof Sidebar> & {
	session: {
		user: BetterAuthUser & {
			username?: string | null;
			displayUsername?: string | null;
		};
	};
}) {
	const pathname = usePathname();
	const navMain = [
		{
			title: "Dashboard",
			href: "/",
			icon: House,
			isActive: pathname === "/",
		},
		{
			title: "Automation",
			href: "/automation",
			icon: FlowArrow,
			isActive: pathname === "/automation",
		},
		{
			title: "Reviews",
			href: "/reviews",
			icon: ChatTeardropText,
			isActive: pathname === "/reviews",
		},
		{
			title: "Settings",
			href: "/settings/account",
			icon: Gear,
			isActive: pathname.startsWith("/settings"),
			items: [
				{ title: "Account", href: "/settings/account" },
				{ title: "Security", href: "/settings/security" },
			],
		},
	];

	return (
		<Sidebar variant="inset" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							render={
								<Link href="/">
									<div className="flex aspect-square size-8 items-center justify-center">
										<Logo alt="Review Engine" className="h-8 w-auto" />
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">Review Engine</span>
										<span className="truncate text-xs">
											Pipeline operations
										</span>
									</div>
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<div className="px-2 pb-2">
				<p className="mb-1 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Organization
				</p>
				<OrganizationSwitcher
					className="w-full justify-between border border-sidebar-border bg-sidebar-accent/40"
					hidePersonal
					side="right"
					sideOffset={8}
				/>
			</div>
			<SidebarContent>
				<NavMain items={navMain} />
			</SidebarContent>
			<SidebarFooter>
				<UserButton
					align="start"
					className="w-full justify-start"
					initialSession={session}
					sideOffset={4}
				/>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
