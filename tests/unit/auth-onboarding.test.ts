import { describe, expect, it } from "vitest";
import { homeFor } from "@/lib/roles";
import { APPLICATION_ROLES } from "@/db/schema";
import { loginSchema, signupSchema } from "@/lib/validation/auth";

describe("Participant Registration Validation", () => {
  // 1. SRM KTR Student registration
  it("validates SRM KTR student registration (requires SRM email & KTR campus)", () => {
    // Fails with personal email
    const failRes = signupSchema.safeParse({
      fullName: "Ananya Sharma",
      email: "ananya@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
      department: "CSE",
    });
    expect(failRes.success).toBe(false);
    if (!failRes.success) {
      expect(failRes.error.issues.some((i) => i.path.includes("email"))).toBe(true);
    }

    // Passes with @srmist.edu.in
    const passRes = signupSchema.safeParse({
      fullName: "Ananya Sharma",
      email: "as1234@srmist.edu.in",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
      department: "CSE",
    });
    expect(passRes.success).toBe(true);
  });

  // 2. SRM KTR Faculty registration
  it("validates SRM KTR faculty registration (allows SRM or personal email)", () => {
    const srmEmailRes = signupSchema.safeParse({
      fullName: "Dr. Rajesh Kumar",
      email: "rajesh@srmist.edu.in",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "FACULTY",
      department: "Mechanical",
    });
    expect(srmEmailRes.success).toBe(true);

    const personalEmailRes = signupSchema.safeParse({
      fullName: "Dr. Rajesh Kumar",
      email: "rajesh.kumar@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "FACULTY",
      department: "Mechanical",
    });
    expect(personalEmailRes.success).toBe(true);
  });

  // 3. SRM Ramapuram Student registration
  it("validates SRM Ramapuram student registration", () => {
    const passRes = signupSchema.safeParse({
      fullName: "Vikas Raman",
      email: "vr5678@srmist.edu.in",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "RAMAPURAM",
      affiliation: "STUDENT",
      department: "ECE",
    });
    expect(passRes.success).toBe(true);
  });

  // 4. SRM Vadapalani Staff registration
  it("validates SRM Vadapalani staff registration (requires official email)", () => {
    const failRes = signupSchema.safeParse({
      fullName: "Suresh Babu",
      email: "suresh@yahoo.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "VADAPALANI",
      affiliation: "STAFF",
    });
    expect(failRes.success).toBe(false);

    const passRes = signupSchema.safeParse({
      fullName: "Suresh Babu",
      email: "suresh@srmist.edu.in",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "VADAPALANI",
      affiliation: "STAFF",
    });
    expect(passRes.success).toBe(true);
  });

  // 5. Other SRM Campus Alumni registration
  it("validates Other SRM Campus alumni registration (allows personal email)", () => {
    const passRes = signupSchema.safeParse({
      fullName: "Pooja Hegde",
      email: "pooja.alumni@outlook.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "SRM",
      campus: "OTHER_SRM",
      affiliation: "ALUMNI",
    });
    expect(passRes.success).toBe(true);
  });

  // 6. External College Student registration
  it("validates External college student registration (allows personal email, requires college & city)", () => {
    // Missing city
    const missingCity = signupSchema.safeParse({
      fullName: "Rahul Menon",
      email: "rahul@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STUDENT",
      institutionName: "VIT Chennai",
      city: "",
    });
    expect(missingCity.success).toBe(false);

    // Missing college name
    const missingCollege = signupSchema.safeParse({
      fullName: "Rahul Menon",
      email: "rahul@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STUDENT",
      institutionName: "",
      city: "Chennai",
    });
    expect(missingCollege.success).toBe(false);

    // Valid external student
    const validRes = signupSchema.safeParse({
      fullName: "Rahul Menon",
      email: "rahul@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STUDENT",
      institutionName: "VIT Chennai",
      city: "Chennai",
    });
    expect(validRes.success).toBe(true);
  });

  // 7. External College Faculty registration
  it("validates External college faculty registration", () => {
    const validRes = signupSchema.safeParse({
      fullName: "Dr. K. Swaminathan",
      email: "swami@annauniv.edu",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "FACULTY",
      institutionName: "Anna University",
      city: "Chennai",
      department: "Information Technology",
    });
    expect(validRes.success).toBe(true);
  });

  // 8. External Staff registration
  it("validates External staff registration", () => {
    const validRes = signupSchema.safeParse({
      fullName: "Mary Joseph",
      email: "mary@loyola.edu",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "EXTERNAL_INSTITUTION",
      affiliation: "STAFF",
      institutionName: "Loyola College",
      city: "Chennai",
    });
    expect(validRes.success).toBe(true);
  });

  // 9. Guest registration
  it("validates Guest registration (no college name, campus, or university email required)", () => {
    const guestRes = signupSchema.safeParse({
      fullName: "John Doe",
      email: "john@example.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "GUEST",
      affiliation: "GUEST",
    });
    expect(guestRes.success).toBe(true);
  });

  // Password confirmation check
  it("rejects mismatched passwords during registration", () => {
    const mismatchRes = signupSchema.safeParse({
      fullName: "John Doe",
      email: "john@example.com",
      password: "Password123!",
      confirmPassword: "DifferentPassword123!",
      institutionType: "GUEST",
      affiliation: "GUEST",
    });
    expect(mismatchRes.success).toBe(false);
    if (!mismatchRes.success) {
      expect(mismatchRes.error.issues.some((i) => i.path.includes("confirmPassword"))).toBe(true);
    }
  });

  // Security: Role manipulation rejected
  it("never accepts client-submitted application role during registration", () => {
    const tampered = {
      fullName: "Attacker",
      email: "attacker@example.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      institutionType: "GUEST",
      affiliation: "GUEST",
      role: "UNIVERSITY_ADMIN",
    };
    const parsed = signupSchema.parse(tampered as never);
    expect(parsed).not.toHaveProperty("role");
  });
});

describe("Common Login Validation", () => {
  it("requires valid email and non-empty password", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "123" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "USER@EXAMPLE.COM", password: "secret" }).success).toBe(true);
  });

  it("normalizes login email to lowercase", () => {
    const parsed = loginSchema.parse({ email: "Test.User@SRMIST.EDU.IN", password: "password123" });
    expect(parsed.email).toBe("test.user@srmist.edu.in");
  });
});

describe("Role-Based Authorization & Dashboard Routing", () => {
  it("maps the three application roles to the correct dashboards", () => {
    expect(APPLICATION_ROLES.UNIVERSITY_ADMIN).toBe("admin");
    expect(APPLICATION_ROLES.EVENT_ORGANIZER).toBe("organizer");
    expect(APPLICATION_ROLES.PARTICIPANT).toBe("participant");

    expect(homeFor("admin")).toBe("/admin");
    expect(homeFor("organizer")).toBe("/organizer");
    expect(homeFor("participant")).toBe("/my/bookings");
  });
});
