export type EligibilityOutcome = "PASS" | "FAIL" | "REVIEW";

export interface EligibilityReason {
  code: string;
  message: string;
}

export interface EligibilityProfile {
  targetTitles?: readonly string[];
  preferredTitles?: readonly string[];
  excludedTitles?: readonly string[];
  locations?: readonly string[];
  regions?: readonly string[];
  requiredTechnologies?: readonly string[];
  excludedTechnologies?: readonly string[];
  preferredCompanies?: readonly string[];
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

  if (includesAny(title, profile.excludedTitles))
    failures.push({ code: "EXCLUDED_TITLE", message: "The title matches an explicit exclusion." });
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

  const titles = [...(profile.targetTitles ?? []), ...(profile.preferredTitles ?? [])];
  if (titles.length && !includesAny(title, titles))
    reviews.push({
      code: "TITLE_REQUIRES_REVIEW",
      message: "The title is not a direct match for the configured title families."
    });
  const geographies = [...(profile.locations ?? []), ...(profile.regions ?? [])];
  if (geographies.length && !includesAny(location, geographies) && !location.includes("remote"))
    reviews.push({
      code: "LOCATION_REQUIRES_REVIEW",
      message: "The location does not confirm a configured geography or remote arrangement."
    });
  const missingRequired = (profile.requiredTechnologies ?? []).filter(
    (technology) => !includesAny(content, [technology])
  );
  if (missingRequired.length)
    reviews.push({
      code: "REQUIRED_TECHNOLOGY_UNCONFIRMED",
      message: `Not confirmed in the listing: ${missingRequired.join(", ")}.`
    });
  if (profile.preferredCompanies?.length && !includesAny(company, profile.preferredCompanies))
    reviews.push({
      code: "COMPANY_PREFERENCE_UNCONFIRMED",
      message: "The company is outside the preferred-company list."
    });

  return { outcome: reviews.length ? "REVIEW" : "PASS", reasons: reviews };
}
