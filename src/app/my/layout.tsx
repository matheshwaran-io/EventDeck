import { requirePageUser } from "@/lib/auth";

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(undefined, "/my/bookings");
  return <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</main>;
}
