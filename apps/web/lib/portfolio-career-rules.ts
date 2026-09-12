export interface CareerIdentity {
  role: string;
  organization: string;
  period: string;
}

export interface ProjectCareerPlacement {
  role: string;
  organization: string;
}

const normalized = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FULL_STACK_TECHNOLOGIES = ["PostgreSQL", "Express.js", "React.js", "Node.js"] as const;

export function expandTechnologyLabels(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.flatMap((value) =>
        /^pern(?:[\s-]+stack)?$/i.test(value.trim()) ? [...FULL_STACK_TECHNOLOGIES] : [value]
      )
    )
  ];
}

export function expandTechnologyTerms(value: string): string {
  return value.replace(
    /\bpern(?:[\s-]+stack)?\b/gi,
    "PostgreSQL, Express.js, React.js, and Node.js"
  );
}

/** User-confirmed career identity rules that must remain stable across AI retries. */
export function normalizeCareerIdentity(
  role: string,
  organization: string,
  period: string
): CareerIdentity {
  const employer = normalized(organization);
  const title = normalized(role);
  if (
    /bloom institute of technology/.test(employer) ||
    (/bloom/.test(employer) && /(?:technical team lead|lead software engineer)/.test(title))
  ) {
    return {
      role: "Lead Software Engineer",
      organization: "Bloom Institute of Technology",
      period: "November 2019 – April 2020"
    };
  }
  return { role, organization, period };
}

/** Explicit project ownership supplied by the portfolio owner. */
export function projectCareerPlacement(title: string): ProjectCareerPlacement | null {
  const project = normalized(title);
  if (/^lambda?door$/.test(project.replace(/\s+/g, ""))) {
    return {
      role: "Lead Software Engineer",
      organization: "Bloom Institute of Technology"
    };
  }
  if (/^climate\s*change$/.test(project)) {
    return { role: "Data Engineer", organization: "One Acre Fund" };
  }
  if (/^where\s*to\s*code$/.test(project)) {
    return { role: "Software Engineer", organization: "Andela" };
  }
  return null;
}

/** Public-facing contribution label for projects built as part of a wider team. */
export function projectContributionLabel(title: string): "Contributor" | null {
  const project = normalized(title).replace(/\s+/g, "");
  return /^(?:lambda?door|wheretocode)$/.test(project) ? "Contributor" : null;
}

export function sameCareerIdentity(
  left: Pick<CareerIdentity, "role" | "organization">,
  right: Pick<CareerIdentity, "role" | "organization">
): boolean {
  return (
    normalized(left.role) === normalized(right.role) &&
    normalized(left.organization) === normalized(right.organization)
  );
}
