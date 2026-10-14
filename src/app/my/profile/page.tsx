import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { OrganizerApplicationForm, ProfileForm } from "@/components/profile/profile-forms";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { myApplication } from "@/lib/server/queries";
import { roleLabel } from "@/components/layout/nav-links";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requirePageUser();
  const application = await myApplication(user.id);
  return (
    <>
      <PageHeader eyebrow={roleLabel[user.role]} title="Your profile" description={user.email} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <section className="surface p-5 sm:p-6">
          <h2 className="font-semibold">Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your category determines which events you&apos;re eligible for.</p>
          <ProfileForm
            defaults={{
              fullName: user.fullName,
              phone: user.phone ?? "",
              institutionType: user.institutionType,
              campus: user.campus,
              affiliation: user.affiliation,
              institutionName: user.institutionName ?? "",
              city: user.city ?? "",
              department: user.department ?? "",
              category: user.category,
              institution: user.institution ?? "",
            }}
          />
        </section>

        <section id="organizer" className="surface h-fit scroll-mt-24 p-5 sm:p-6">
          <h2 className="font-semibold">Host events</h2>
          {user.role === "organizer" || user.role === "admin" ? (
            <p className="mt-2 text-sm text-muted-foreground">You have organizer access. Create and manage events from your dashboard.</p>
          ) : application?.status === "pending" ? (
            <div className="mt-3 space-y-2 text-sm">
              <StatusBadge tone="info">Application under review</StatusBadge>
              <p className="text-muted-foreground">
                Submitted {formatDateTime(application.createdAt)} for <span className="font-medium text-foreground">{application.organization}</span>.
              </p>
            </div>
          ) : (
            <>
              {application?.status === "rejected" && (
                <div className="mt-3 rounded-lg bg-danger-soft p-3 text-sm">
                  <p className="font-medium text-destructive">Previous application declined</p>
                  {application.reviewNote && <p className="mt-1 text-foreground/80">{application.reviewNote}</p>}
                </div>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Clubs, departments and societies can apply for organizer access. An administrator reviews every request.
              </p>
              <OrganizerApplicationForm />
            </>
          )}
        </section>
      </div>
    </>
  );
}
