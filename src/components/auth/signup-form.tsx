"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  MailCheck,
  UserCheck,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signUp } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import {
  EXTERNAL_AFFILIATIONS,
  SRM_AFFILIATIONS,
  SRM_CAMPUSES,
  isSrmEmail,
} from "@/lib/constants";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

type Step = 1 | 2 | 3 | 4;

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      institutionType: "SRM",
      campus: "KTR",
      affiliation: "STUDENT",
      institutionName: "",
      city: "",
      department: "",
    },
  });

  const formValues = watch();
  const currentInstitutionType = formValues.institutionType ?? "SRM";
  const currentAffiliation = formValues.affiliation ?? "STUDENT";
  const currentCampus = formValues.campus ?? "KTR";

  // Step 1 validation check before moving to Step 2
  const handleNextFromStep1 = async () => {
    setError(null);
    const valid = await trigger(["fullName", "email", "password", "confirmPassword"]);
    if (valid) {
      setStep(2);
    }
  };

  // Step 2 selection
  const handleSelectOrigin = (type: "SRM" | "EXTERNAL_INSTITUTION" | "GUEST") => {
    setValue("institutionType", type, { shouldValidate: true });
    if (type === "GUEST") {
      setValue("affiliation", "GUEST", { shouldValidate: true });
      setValue("campus", null);
      setValue("institutionName", "");
      setValue("city", "");
    } else if (type === "SRM") {
      setValue("campus", "KTR", { shouldValidate: true });
      if (formValues.affiliation === "GUEST") {
        setValue("affiliation", "STUDENT", { shouldValidate: true });
      }
    } else {
      // EXTERNAL_INSTITUTION
      setValue("campus", null);
      if (formValues.affiliation === "GUEST" || formValues.affiliation === "ALUMNI") {
        setValue("affiliation", "STUDENT", { shouldValidate: true });
      }
    }
    setStep(3);
  };

  // Step 3 validation check before moving to Step 4 (Review)
  const handleNextFromStep3 = async () => {
    setError(null);
    let valid = true;
    if (currentInstitutionType === "SRM") {
      valid = await trigger(["campus", "affiliation", "email"]);
    } else if (currentInstitutionType === "EXTERNAL_INSTITUTION") {
      valid = await trigger(["institutionName", "city", "affiliation"]);
    }
    if (valid) {
      setStep(4);
    }
  };

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const res = await signUp(values);
      if (!res.ok) return setError(res.error);
      if (res.data?.needsConfirmation) return setSent(true);
      router.replace(res.data?.redirectTo ?? "/events");
      router.refresh();
    }),
  );

  if (sent) {
    return (
      <div className="mt-8 rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto size-7 text-success" />
        <h2 className="mt-3 font-semibold text-lg">Check your inbox</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent an activation link to <strong className="text-foreground">{formValues.email}</strong>. Open it to activate your account.
        </p>
      </div>
    );
  }

  // Friendly institution summary for step 4
  const renderIdentitySummary = () => {
    if (currentInstitutionType === "SRM") {
      const camp = SRM_CAMPUSES.find((c) => c.value === currentCampus)?.label ?? currentCampus;
      const aff = SRM_AFFILIATIONS.find((a) => a.value === currentAffiliation)?.label ?? currentAffiliation;
      return (
        <div>
          <p className="font-medium text-foreground">SRM University</p>
          <p className="text-xs text-muted-foreground">
            {camp} · {aff} {formValues.department ? `(${formValues.department})` : ""}
          </p>
        </div>
      );
    }

    if (currentInstitutionType === "EXTERNAL_INSTITUTION") {
      const aff = EXTERNAL_AFFILIATIONS.find((a) => a.value === currentAffiliation)?.label ?? currentAffiliation;
      return (
        <div>
          <p className="font-medium text-foreground">{formValues.institutionName || "College / University"}</p>
          <p className="text-xs text-muted-foreground">
            {formValues.city ? `${formValues.city} · ` : ""}
            {aff} {formValues.department ? `(${formValues.department})` : ""}
          </p>
        </div>
      );
    }

    return (
      <div>
        <p className="font-medium text-foreground">External Guest</p>
        <p className="text-xs text-muted-foreground">Attending as a community visitor / guest</p>
      </div>
    );
  };

  return (
    <div className="mt-6">
      {/* Step Indicators */}
      <nav aria-label="Progress" className="mb-6">
        <ol className="flex items-center justify-between gap-2">
          {[
            { s: 1, label: "Account" },
            { s: 2, label: "Origin" },
            { s: 3, label: "Details" },
            { s: 4, label: "Review" },
          ].map(({ s, label }) => {
            const isCompleted = step > s;
            const isCurrent = step === s;
            return (
              <li key={s} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    // Only allow jumping backward to already visited steps
                    if (s < step) setStep(s as Step);
                  }}
                  disabled={s > step}
                  className={`group flex w-full flex-col border-t-2 pt-2 text-left transition-colors ${
                    isCurrent
                      ? "border-signal font-semibold text-signal"
                      : isCompleted
                        ? "border-foreground text-foreground hover:border-foreground/80 cursor-pointer"
                        : "border-border text-muted-foreground/60 cursor-not-allowed"
                  }`}
                >
                  <span className="text-[10px] tracking-wider uppercase">Step 0{s}</span>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        {/* STEP 1: Account Information */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="First and last name"
                aria-invalid={Boolean(errors.fullName)}
                {...register("fullName")}
              />
            </Field>

            <Field
              label="Email address"
              htmlFor="email"
              error={errors.email?.message}
              hint="Use your university email if affiliated with SRM, or personal email for external / guests."
              required
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              error={errors.password?.message}
              hint="8+ characters with at least one letter and number."
              required
            >
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              error={errors.confirmPassword?.message}
              required
            >
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className="pr-10"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <div className="pt-2">
              <Button type="button" size="lg" className="w-full justify-center" onClick={handleNextFromStep1}>
                Continue <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Where are you from? */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Where are you from?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                EventDeck welcomes participants from SRM campuses, external colleges, and general guests.
              </p>
            </div>

            <div className="grid gap-3 pt-1">
              {/* SRM University Card */}
              <button
                type="button"
                onClick={() => handleSelectOrigin("SRM")}
                className={`group flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all hover:border-signal/50 hover:bg-card/90 ${
                  currentInstitutionType === "SRM"
                    ? "border-signal bg-signal-soft/20 ring-1 ring-signal"
                    : "border-border bg-card"
                }`}
              >
                <div className="rounded-lg bg-signal/10 p-2.5 text-signal transition-colors group-hover:bg-signal group-hover:text-signal-foreground">
                  <Building2 className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground">SRM University</p>
                    {currentInstitutionType === "SRM" && <Check className="size-4 text-signal" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kattankulathur (KTR), Ramapuram, Vadapalani, or other SRM campuses.
                  </p>
                </div>
              </button>

              {/* Other College / University Card */}
              <button
                type="button"
                onClick={() => handleSelectOrigin("EXTERNAL_INSTITUTION")}
                className={`group flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all hover:border-signal/50 hover:bg-card/90 ${
                  currentInstitutionType === "EXTERNAL_INSTITUTION"
                    ? "border-signal bg-signal-soft/20 ring-1 ring-signal"
                    : "border-border bg-card"
                }`}
              >
                <div className="rounded-lg bg-info/10 p-2.5 text-info transition-colors group-hover:bg-info group-hover:text-info-foreground">
                  <GraduationCap className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground">Other College / University</p>
                    {currentInstitutionType === "EXTERNAL_INSTITUTION" && <Check className="size-4 text-signal" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Students, faculty, or staff from other universities (VIT, Anna Univ, etc.).
                  </p>
                </div>
              </button>

              {/* Guest Card */}
              <button
                type="button"
                onClick={() => handleSelectOrigin("GUEST")}
                className={`group flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all hover:border-signal/50 hover:bg-card/90 ${
                  currentInstitutionType === "GUEST"
                    ? "border-signal bg-signal-soft/20 ring-1 ring-signal"
                    : "border-border bg-card"
                }`}
              >
                <div className="rounded-lg bg-success/10 p-2.5 text-success transition-colors group-hover:bg-success group-hover:text-success-foreground">
                  <UserCheck className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground">Guest</p>
                    {currentInstitutionType === "GUEST" && <Check className="size-4 text-signal" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    External visitors, industry attendees, or friends of campus. No college affiliation needed.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="outline" size="lg" className="w-1/3" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4 mr-1.5" /> Back
              </Button>
              <Button type="button" size="lg" className="w-2/3" onClick={() => setStep(3)}>
                Continue <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Institution Details */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {currentInstitutionType === "SRM"
                  ? "SRM Campus & Affiliation"
                  : currentInstitutionType === "EXTERNAL_INSTITUTION"
                    ? "College / University Details"
                    : "Guest Confirmation"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentInstitutionType === "SRM"
                  ? "Tell us which campus you belong to and your role."
                  : currentInstitutionType === "EXTERNAL_INSTITUTION"
                    ? "Tell us about your institution and your role."
                    : "External guests can register without institutional requirements."}
              </p>
            </div>

            {/* SRM Options */}
            {currentInstitutionType === "SRM" && (
              <div className="space-y-4">
                <Field label="SRM Campus" htmlFor="campus" error={errors.campus?.message} required>
                  <NativeSelect id="campus" {...register("campus")}>
                    {SRM_CAMPUSES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field label="You are a" htmlFor="affiliation" error={errors.affiliation?.message} required>
                  <NativeSelect id="affiliation" {...register("affiliation")}>
                    {SRM_AFFILIATIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field
                  label="Department / Branch"
                  htmlFor="department"
                  error={errors.department?.message}
                  hint="e.g. Computing / CSE, ECE, Mechanical, Directorate of Student Affairs"
                >
                  <Input
                    id="department"
                    placeholder="e.g. Computer Science & Engineering"
                    {...register("department")}
                  />
                </Field>

                {(currentAffiliation === "STUDENT" || currentAffiliation === "STAFF") && !isSrmEmail(formValues.email) && (
                  <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-3 text-xs text-foreground/80">
                    <p className="font-medium text-warning-foreground">Official SRM email required</p>
                    <p className="mt-0.5 text-muted-foreground">
                      SRM students and staff must register with an official @srmist.edu.in email. You can step back to edit your email address.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* External Institution Options */}
            {currentInstitutionType === "EXTERNAL_INSTITUTION" && (
              <div className="space-y-4">
                <Field
                  label="Institution / College / University Name"
                  htmlFor="institutionName"
                  error={errors.institutionName?.message}
                  required
                >
                  <Input
                    id="institutionName"
                    autoComplete="organization"
                    placeholder="e.g. Vellore Institute of Technology, Anna University"
                    aria-invalid={Boolean(errors.institutionName)}
                    {...register("institutionName")}
                  />
                </Field>

                <Field label="City" htmlFor="city" error={errors.city?.message} required>
                  <Input
                    id="city"
                    autoComplete="address-level2"
                    placeholder="e.g. Chennai, Vellore, Bangalore"
                    aria-invalid={Boolean(errors.city)}
                    {...register("city")}
                  />
                </Field>

                <Field label="You are a" htmlFor="affiliation" error={errors.affiliation?.message} required>
                  <NativeSelect id="affiliation" {...register("affiliation")}>
                    {EXTERNAL_AFFILIATIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field label="Department / Field (optional)" htmlFor="department" error={errors.department?.message}>
                  <Input id="department" placeholder="e.g. Computer Science, Mechanical" {...register("department")} />
                </Field>
              </div>
            )}

            {/* Guest Info */}
            {currentInstitutionType === "GUEST" && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-success font-medium text-sm">
                  <CheckCircle2 className="size-4" /> Guest Profile
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are registering as an external attendee. You do not need to provide any college or institution credentials. You will be able to discover and book passes for all public events open to external guests.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="outline" size="lg" className="w-1/3" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4 mr-1.5" /> Back
              </Button>
              <Button type="button" size="lg" className="w-2/3" onClick={handleNextFromStep3}>
                Review details <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Summary & Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Review & Confirm</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Please check your details before creating your account.</p>
            </div>

            <div className="rounded-xl border bg-card divide-y text-sm">
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">Account</span>
                  <p className="font-medium text-foreground">{formValues.fullName || "—"}</p>
                  <p className="text-xs text-muted-foreground">{formValues.email}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                  Edit
                </Button>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">Affiliation</span>
                  {renderIdentitySummary()}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(3)} className="text-xs">
                  Edit
                </Button>
              </div>

              <div className="p-3.5 bg-muted/30">
                <span className="text-xs text-muted-foreground">Application Role</span>
                <p className="font-semibold text-xs text-foreground uppercase tracking-wider mt-0.5">PARTICIPANT</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  All accounts start as Participants. Event Organizer access is assigned through an administrator approval workflow.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="outline" size="lg" className="w-1/3" onClick={() => setStep(3)} disabled={pending}>
                <ArrowLeft className="size-4 mr-1.5" /> Back
              </Button>
              <Button type="submit" size="lg" className="w-2/3" disabled={pending}>
                {pending && <Loader2 className="animate-spin mr-1.5 size-4" />} Create account
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
