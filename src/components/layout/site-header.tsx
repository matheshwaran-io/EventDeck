import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/server/queries";
import { moderationCount } from "@/lib/server/moderators";
import { Brand } from "@/components/common/brand";
import { buttonVariants } from "@/components/ui/button";
import { HeaderNav, MobileNav } from "./header-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { primaryLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const [unread, moderating] = user ? await Promise.all([unreadCount(user.id), moderationCount(user.id)]) : [0, 0];
  const links = primaryLinks(user?.role ?? null, { moderating: moderating > 0 });
  const menuUser = user && { id: user.id, name: user.fullName, email: user.email, role: user.role };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Brand />
        <HeaderNav links={links} />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {menuUser ? (
            <>
              <NotificationBell userId={menuUser.id} initialUnread={unread} />
              <UserMenu user={menuUser} />
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Get started
              </Link>
            </>
          )}
          <MobileNav links={links} user={menuUser} />
        </div>
      </div>
    </header>
  );
}
