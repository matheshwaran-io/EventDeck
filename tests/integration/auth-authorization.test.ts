import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { applyForOrganizer, reviewApplication, setUserActive, setUserRole, updateOwnProfile } from "@/lib/server/users";
import { cleanup, makeClassifiedUser, makeUser } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("Participant Provisioning across Institutions & Campuses", () => {
  it("provisions an SRM KTR student profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Ananya Sharma",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
      department: "CSE",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("SRM");
    expect(user.campus).toBe("KTR");
    expect(user.affiliation).toBe("STUDENT");
    expect(user.category).toBe("host_student");
  });

  it("provisions an SRM KTR faculty profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Dr. Rajesh Kumar",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "FACULTY",
      department: "Mechanical",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("SRM");
    expect(user.campus).toBe("KTR");
    expect(user.affiliation).toBe("FACULTY");
    expect(user.category).toBe("faculty");
  });

  it("provisions an SRM Ramapuram student profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Vikas Raman",
      institutionType: "SRM",
      campus: "RAMAPURAM",
      affiliation: "STUDENT",
      department: "ECE",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("SRM");
    expect(user.campus).toBe("RAMAPURAM");
    expect(user.affiliation).toBe("STUDENT");
    expect(user.category).toBe("host_student");
  });

  it("provisions an SRM Vadapalani staff profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Suresh Babu",
      institutionType: "SRM",
      campus: "VADAPALANI",
      affiliation: "STAFF",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("SRM");
    expect(user.campus).toBe("VADAPALANI");
    expect(user.affiliation).toBe("STAFF");
    expect(user.category).toBe("staff");
  });

  it("provisions an Other SRM Campus alumni profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Pooja Hegde",
      institutionType: "SRM",
      campus: "OTHER_SRM",
      affiliation: "ALUMNI",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("SRM");
    expect(user.campus).toBe("OTHER_SRM");
    expect(user.affiliation).toBe("ALUMNI");
    expect(user.category).toBe("alumni");
  });

  it("provisions an External College student profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Rahul Menon",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STUDENT",
      institutionName: "VIT Chennai",
      city: "Chennai",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("EXTERNAL_INSTITUTION");
    expect(user.campus).toBeNull();
    expect(user.affiliation).toBe("STUDENT");
    expect(user.institutionName).toBe("VIT Chennai");
    expect(user.city).toBe("Chennai");
    expect(user.category).toBe("external_student");
  });

  it("provisions an External College faculty profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Dr. K. Swaminathan",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "FACULTY",
      institutionName: "Anna University",
      city: "Chennai",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("EXTERNAL_INSTITUTION");
    expect(user.campus).toBeNull();
    expect(user.affiliation).toBe("FACULTY");
    expect(user.category).toBe("faculty");
  });

  it("provisions an External Staff profile correctly", async () => {
    const user = await makeClassifiedUser({
      fullName: "Mary Joseph",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STAFF",
      institutionName: "Loyola College",
      city: "Chennai",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("EXTERNAL_INSTITUTION");
    expect(user.campus).toBeNull();
    expect(user.affiliation).toBe("STAFF");
    expect(user.category).toBe("staff");
  });

  it("provisions a Guest profile without requiring fake college credentials", async () => {
    const user = await makeClassifiedUser({
      fullName: "John Doe",
      institutionType: "GUEST",
      affiliation: "GUEST",
    });

    expect(user.role).toBe("participant");
    expect(user.institutionType).toBe("GUEST");
    expect(user.campus).toBeNull();
    expect(user.affiliation).toBe("GUEST");
    expect(user.institutionName).toBeNull();
    expect(user.category).toBe("guest");
  });
});

describe("Security & Privilege Escalation Prevention", () => {
  it("rejects malicious client attempts to self-provision UNIVERSITY_ADMIN or EVENT_ORGANIZER", async () => {
    // Attempting to inject role via user metadata
    const user = await makeClassifiedUser({
      fullName: "Hacker X",
      metadataOverrides: { role: "admin", user_role: "admin", is_admin: true },
    });

    // Database trigger strictly forces 'participant'
    expect(user.role).toBe("participant");
  });

  it("prevents institutional affiliation from conferring administrative privileges", async () => {
    // SRM Faculty is still only a participant
    const srmFaculty = await makeClassifiedUser({
      fullName: "Prof. Dean",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "FACULTY",
    });
    expect(srmFaculty.role).toBe("participant");

    // External Faculty is still only a participant
    const extFaculty = await makeClassifiedUser({
      fullName: "Prof. Outside",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "FACULTY",
      institutionName: "IIT Madras",
    });
    expect(extFaculty.role).toBe("participant");
  });

  it("ensures updating profile cannot alter user role", async () => {
    const user = await makeUser("participant");
    const updated = await updateOwnProfile(user, {
      fullName: "Updated Name",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
      // Even if client tried to pass a role in any shape, it is not accepted
    });

    expect(updated.fullName).toBe("Updated Name");
    expect(updated.role).toBe("participant");
  });
});

describe("Authorized Organizer & Admin Workflow", () => {
  it("allows participants to apply for organizer access and admin to review/approve", async () => {
    const admin = await makeUser("admin");
    const participant = await makeUser("participant");

    // Participant applies
    const application = await applyForOrganizer(participant, {
      organization: "Robotics Club",
      reason: "We organize campus robotics competitions and workshops.",
    });
    expect(application.status).toBe("pending");

    // While application is pending, participant cannot submit another application (one pending constraint)
    await expect(
      applyForOrganizer(participant, {
        organization: "Another Club",
        reason: "Duplicate pending application should be rejected.",
      }),
    ).rejects.toThrow();

    // Admin reviews and approves
    const reviewed = await reviewApplication(admin, application.id, true, "Approved for semester events.");
    expect(reviewed.status).toBe("approved");

    // Fetch updated participant profile
    const [updatedParticipant] = await db.select().from(profiles).where(eq(profiles.id, participant.id));
    expect(updatedParticipant!.role).toBe("organizer");

    // Now that user is an organizer, applying again is blocked
    await expect(
      applyForOrganizer(updatedParticipant!, {
        organization: "Another Club",
        reason: "Already an organizer, should be rejected.",
      }),
    ).rejects.toThrow(/already has organizer access/);
  });

  it("allows admin to grant and revoke organizer role, but protects admin accounts", async () => {
    const admin = await makeUser("admin");
    const user = await makeUser("participant");

    // Admin grants organizer
    const promoted = await setUserRole(admin, user.id, "organizer");
    expect(promoted.role).toBe("organizer");

    // Admin revokes organizer
    const demoted = await setUserRole(admin, user.id, "participant");
    expect(demoted.role).toBe("participant");

    // Admin cannot change their own role
    await expect(setUserRole(admin, admin.id, "participant")).rejects.toThrow(/own role/);

    // Admin cannot deactivate their own account
    await expect(setUserActive(admin, admin.id, false)).rejects.toThrow(/own account/);
  });
});
