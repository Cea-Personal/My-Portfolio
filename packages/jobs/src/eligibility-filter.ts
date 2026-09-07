export type EligibilityOutcome = "PASS" | "FAIL" | "REVIEW";

export interface EligibilityReason {
  code: string;
  message: string;
}

export interface EligibilityProfile {
  targetTitles?: readonly string[];
  locations?: readonly string[];
  requiredTechnologies?: readonly string[];
  excludedTechnologies?: readonly string[];
  excludedCompanies?: readonly string[];
}

interface EligibleJob {
  company: string;
  title: string;
  location?: string;
  description?: string;
}

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function includesAny(value: string, candidates: readonly string[] | undefined): boolean {
  return (candidates ?? []).some((candidate) => {
    const expected = normalized(candidate);
    return expected.length > 0 && value.includes(expected);
  });
}

export function evaluateJobEligibility(
  job: EligibleJob,
  profile: EligibilityProfile
): { outcome: EligibilityOutcome; reasons: EligibilityReason[] } {
  const title = normalized(job.title);
  const company = normalized(job.company);
  const location = normalized(job.location);
  const content = `${title} ${normalized(job.description)}`;
  const failures: EligibilityReason[] = [];
  const reviews: EligibilityReason[] = [];

  if (includesAny(company, profile.excludedCompanies))
    failures.push({
      code: "EXCLUDED_COMPANY",
      message: "The company matches an explicit exclusion."
    });
  if (includesAny(content, profile.excludedTechnologies))
    failures.push({
      code: "EXCLUDED_TECHNOLOGY",
      message: "The listing contains an explicitly excluded technology."
    });
  if (failures.length) return { outcome: "FAIL", reasons: failures };

  const titles = profile.targetTitles ?? [];
  if (titles.length && !includesAny(title, titles))
    failures.push({
      code: "TITLE_NOT_MATCHED",
      message: "The title does not match any configured target or preferred title."
    });
  const geographies = profile.locations ?? [];
  const remoteAllowed = geographies.some((geography) => normalized(geography).includes("remote"));
  if (
    geographies.length &&
    !includesAny(location, geographies) &&
    !(remoteAllowed && location.includes("remote"))
  )
    failures.push({
      code: "LOCATION_NOT_MATCHED",
      message: "The location does not match a configured geography or remote arrangement."
    });
  const missingRequired = (profile.requiredTechnologies ?? []).filter(
    (technology) => !includesAny(content, [technology])
  );
  if (missingRequired.length) {
    const reason = {
      code: "REQUIRED_TECHNOLOGY_UNCONFIRMED",
      message: `Not confirmed in the listing: ${missingRequired.join(", ")}.`
    };
    // A feed without a description cannot prove a required technology is
    // absent. Keep it reviewable; a listing with searchable content that
    // omits the requirement is filtered out deterministically.
    if (normalized(job.description)) failures.push({ ...reason, code: "REQUIRED_TECHNOLOGY_NOT_FOUND" });
    else reviews.push(reason);
  }
  if (failures.length) return { outcome: "FAIL", reasons: failures };
  return { outcome: reviews.length ? "REVIEW" : "PASS", reasons: reviews };
}
