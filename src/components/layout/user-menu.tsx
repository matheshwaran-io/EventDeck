"use client";

import Link from "next/link";
import { Bell, LayoutDashboard, LogOut, ShieldCheck, Ticket, UserRound } from "lucide-react";
import type { Role } from "@/db/schema";
import { signOut } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { roleLabel } from "./nav-links";

export function UserMenu({ user }: { user: { name: string; email: string; role: Role } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="hidden size-9 place-items-center rounded-full bg-foreground text-[0.75rem] font-semibold text-background ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-signal md:grid"
      >
        {initials(user.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="py-2">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            <p className="eyebrow mt-1.5 text-[0.625rem]">{roleLabel[user.role]}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user.role !== "admin" && (
          <DropdownMenuItem render={<Link href="/my/bookings" />}>
            <Ticket /> My tickets
          </DropdownMenuItem>
        )}
        {user.role === "organizer" && (
          <DropdownMenuItem render={<Link href="/organizer" />}>
            <LayoutDashboard /> Organizer dashboard
          </DropdownMenuItem>
        )}
        {user.role === "admin" && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck /> Admin console
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/my/notifications" />}>
          <Bell /> Notifications
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/my/profile" />}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
