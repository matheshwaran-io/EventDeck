"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import type { Role } from "@/db/schema";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "@/components/common/brand";
import { cn } from "@/lib/utils";
import { roleLabel, type NavLink } from "./nav-links";

export function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function HeaderNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-signal",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  links,
  user,
}: {
  links: NavLink[];
  user: { name: string; email: string; role: Role } | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const extra: NavLink[] = user
    ? [
        { href: "/my/notifications", label: "Notifications" },
        { href: "/my/profile", label: "Profile" },
      ]
    : [
        { href: "/login", label: "Sign in" },
        { href: "/signup", label: "Create account" },
      ];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[86vw] max-w-sm gap-0 p-0">
        <SheetHeader className="border-b p-5">
          <SheetTitle render={<div />}>
            <Brand />
          </SheetTitle>
        </SheetHeader>
        {user && (
          <div className="border-b px-5 py-4">
            <p className="font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="eyebrow mt-2">{roleLabel[user.role]}</p>
          </div>
        )}
        <nav aria-label="Mobile" className="flex flex-col p-3">
          {[...links, ...extra].map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center rounded-lg px-3 text-[0.9375rem] font-medium transition-colors hover:bg-secondary",
                  active && "bg-secondary text-foreground",
                  !active && "text-muted-foreground",
                )}
              >
                {active && <span className="mr-3 h-4 w-0.5 rounded-full bg-signal" aria-hidden />}
                {l.label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <form action={signOut} className="mt-auto border-t p-4">
            <Button type="submit" variant="outline" className="w-full">
              <LogOut /> Sign out
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
