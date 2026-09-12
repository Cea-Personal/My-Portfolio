import { About } from "../../components/portfolio/about";
import { Contact } from "../../components/portfolio/contact";
import { CareerTimeline } from "../../components/portfolio/career-timeline";
import { Hero } from "../../components/portfolio/hero";
import { PortfolioNavigation } from "../../components/portfolio/navigation";
import { Projects } from "../../components/portfolio/projects";
import { Writing } from "../../components/portfolio/writing";
import { AskShell } from "../../components/portfolio/ask-shell";
import { PortfolioMotion } from "../../components/portfolio/portfolio-motion";
import { PageIntro } from "../../components/portfolio/page-intro";
import { ProfileRail } from "../../components/portfolio/profile-rail";
import { EngineeringProcesses } from "../../components/portfolio/engineering-processes";
import type { CareerTimelineStage } from "../../components/portfolio/career-timeline";
import { loadPublicBlogPostsWithStatus, loadPublicPortfolio } from "@/lib/api/public-data";
import { PublicEvents } from "@/components/analytics/public-events";
import { CredentialsAndSkills } from "@/components/portfolio/credentials-skills";
import { youtubeEmbedUrl } from "@/lib/portfolio-media";
import {
  expandTechnologyLabels,
  expandTechnologyTerms,
  normalizeCareerIdentity,
  projectCareerPlacement,
  projectContributionLabel,
  sameCareerIdentity
} from "@/lib/portfolio-career-rules";

export const dynamic = "force-dynamic";

export default async function PublicPortfolioPage() {
  const [snapshot, publishedPostsResult] = await Promise.all([
    loadPublicPortfolio(),
    loadPublicBlogPostsWithStatus()
  ]);
  const publishedPosts =
    snapshot.source === "empty" && publishedPostsResult.source === "fallback"
      ? []
      : publishedPostsResult.posts;
  const publicReadIsStale =
    snapshot.stale || (snapshot.source !== "empty" && publishedPostsResult.stale);
  const items = snapshot.items;
  const profile = snapshot.publication;
  // if (!profile) {
  //   return (
  //     <>
  //       <PageIntro name="Basil Ogbonna" />
  //       <PortfolioNavigation />
  //       <main id="main-content" className="portfolio-main portfolio-empty-state">
  //         <p className="eyebrow">Basil Ogbonna · Portfolio</p>
  //         <h1>Verified work is being prepared.</h1>
  //         <p>
  //           There is no active publication yet. Experience, projects, evidence, and writing will appear
  //           here only after they have been reviewed and deliberately published.
  //         </p>
  //         <a href="/sign-in">Owner sign in</a>
  //       </main>
  //     </>
  //   );
  // }
  const configuredName =
    typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  const displayName =
    configuredName && configuredName.toLowerCase() !== "ai career os"
      ? configuredName
      : "Basil Ogbonna";
  const configuredHeadline = typeof profile?.headline === "string" ? profile.headline.trim() : "";
  const headline =
    configuredHeadline && !/senior data\s*(?:&|and)\s*ai engineer/i.test(configuredHeadline)
      ? expandTechnologyTerms(configuredHeadline)
      : "Senior Data Engineer";
  const projectItems = items.filter(
    (item) => item.section === "projects" || item.source_entity_type === "project"
  );
  const impactItems = items.filter(
    (item) =>
      item.source_entity_type === "achievement" ||
      (item.section === "experience" && String(item.title).toLowerCase() === "achievement")
  );
  const skillItems = items.filter(
    (item) => item.source_entity_type === "skill" || String(item.title).toLowerCase() === "skill"
  );
  const certificationItems = items.filter(
    (item) =>
      ["education", "certification"].includes(String(item.source_entity_type)) ||
      item.section === "credentials"
  );
  const writingItems = items.filter(
    (item) => item.section === "blog" || item.source_entity_type === "post"
  );
  const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
  const displayText = (value: unknown, fallback = "") =>
    expandTechnologyTerms(text(value, fallback));
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const record = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const objectList = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item)
        )
      : [];
  const publishedCareerItems = items.filter((item) => {
    const isCareerItem =
      item.source_entity_type === "experience" ||
      item.source_entity_type === "career_experience" ||
      (item.section === "experience" && String(item.title).toLowerCase() === "experience");
    if (!isCareerItem) return false;
    const structured = record(item.structured_content);
    const role = text(item.title, text(structured.role));
    const organization = text(
      item.subtitle,
      text(item.company_name, text(item.organization_name, text(structured.organization)))
    );
    return !(
      /one\s+acre\s+fund/i.test(organization) && /software\s+engineer\s*\(?.*backend/i.test(role)
    );
  });
  const projectNameKey = (value: unknown) =>
    text(value)
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const slugHref = (item: Record<string, unknown>) => {
    const slug = text(item.detail_slug, text(item.public_id));
    return slug ? `/projects/${encodeURIComponent(slug)}` : undefined;
  };
  const identities = (item: Record<string, unknown>) =>
    [text(item.career_stage), text(item.title)].filter(Boolean).map((value) => value.toLowerCase());
  const careerIdentityForItem = (item: Record<string, unknown>) => {
    const structured = record(item.structured_content);
    return normalizeCareerIdentity(
      text(item.title, text(structured.role)),
      text(
        item.company_name,
        text(item.organization_name, text(item.subtitle, text(structured.organization)))
      ),
      text(
        item.period,
        text(
          structured.period,
          [text(item.start_date), text(item.end_date)].filter(Boolean).join(" — ")
        )
      )
    );
  };
  // The owner has explicitly confirmed this public career chapter. Keep it as
  // a resilient baseline if an older publication omitted the Bloom record.
  const bloomIdentity = normalizeCareerIdentity(
    "Lead Software Engineer",
    "Bloom Institute of Technology",
    "November 2019 – April 2020"
  );
  const careerItems = publishedCareerItems.some((item) =>
    sameCareerIdentity(careerIdentityForItem(item), bloomIdentity)
  )
    ? publishedCareerItems
    : [
        ...publishedCareerItems,
        {
          public_id: "confirmed-bloom-lead-software-engineer",
          source_entity_type: "experience",
          source_entity_id: "confirmed-bloom-lead-software-engineer",
          section: "experience",
          career_stage: "lead-software-engineer",
          title: bloomIdentity.role,
          company_name: bloomIdentity.organization,
          period: bloomIdentity.period,
          public_summary:
            "Led technical decisions that helped teams ship reliable systems together.",
          structured_content: { experience: [], projects: [], workProjects: [] }
        }
      ];
  const stageKey = (item: Record<string, unknown>) =>
    Object.values(careerIdentityForItem(item)).join("|").toLowerCase();
  const parseEmploymentStart = (value: unknown): number | null => {
    const candidate = text(value);
    if (!candidate) return null;
    const match = candidate.match(
      /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?)\s*(\d{4})\b/i
    );
    if (!match) return null;
    const monthName = (match[1] ?? "").trim().toLocaleLowerCase();
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec"
    ];
    const month = months.findIndex((name) => monthName.startsWith(name));
    return Date.UTC(Number(match[2]), month < 0 ? 0 : month, 1);
  };
  const timelineStages: CareerTimelineStage[] = Array.from(
    new Map(careerItems.map((item) => [stageKey(item), item])).values()
  )
    .map((item) => {
      const careerIdentity = careerIdentityForItem(item);
      const key = identities(item)[0] ?? "career stage";
      const structured = record(item.structured_content);
      const declaredProjectKeys = [...list(structured.projects), ...list(item.projects)].map(
        projectNameKey
      );
      const detailedWorkProjects = objectList(structured.workProjects).map((project) => ({
        title: displayText(project.title, "Work project"),
        summary: displayText(
          project.summary,
          displayText(project.outcome, "Delivered during this role.")
        ),
        ...(text(project.outcome) ? { outcome: displayText(project.outcome) } : {}),
        ...(list(project.technologies).length
          ? { technologies: expandTechnologyLabels(list(project.technologies)) }
          : {})
      }));
      const detailedProjectNames = new Set(
        detailedWorkProjects.map((project) => projectNameKey(project.title))
      );
      const embeddedProjects = list(structured.projects)
        .filter((project) => !detailedProjectNames.has(projectNameKey(project)))
        .map((project) => ({
          title: expandTechnologyTerms(project),
          summary: expandTechnologyTerms(project)
        }));
      const stageProjects = Array.from(
        new Map(
          [
            ...detailedWorkProjects,
            ...embeddedProjects,
            ...projectItems
              .filter((project) => {
                const projectStructured = record(project.structured_content);
                const projectKey = projectNameKey(project.title);
                const confirmedPlacement = projectCareerPlacement(text(project.title));
                if (confirmedPlacement)
                  return sameCareerIdentity(careerIdentity, confirmedPlacement);
                if (declaredProjectKeys.includes(projectKey)) return true;

                // Source-document overlap is provenance, not ownership. Only an
                // explicit role/career-stage plus a compatible employer can attach a
                // standalone project to this timeline chapter.
                const projectRole = text(
                  project.career_stage,
                  text(projectStructured.careerStage, text(projectStructured.role))
                );
                const projectOrganization = text(
                  project.company_name,
                  text(
                    project.organization_name,
                    text(projectStructured.organization, text(projectStructured.company))
                  )
                );
                if (!projectRole) return false;
                const roleMatches = [key, careerIdentity.role]
                  .map(projectNameKey)
                  .includes(projectNameKey(projectRole));
                const organizationMatches =
                  !projectOrganization ||
                  projectNameKey(projectOrganization) ===
                    projectNameKey(careerIdentity.organization);
                return roleMatches && organizationMatches;
              })
              .map((project) => {
                const href = slugHref(project);
                return {
                  title: displayText(project.title, "Project"),
                  summary: displayText(project.public_summary),
                  ...(href ? { href } : {})
                };
              })
          ].map((project) => [projectNameKey(project.title), project])
        ).values()
      );
      const stageExperience = impactItems
        .filter((impact) => identities(impact).includes(key))
        .flatMap((impact) => [text(impact.display_metric, text(impact.public_summary))])
        .filter(Boolean);
      const directImpact = text(item.display_metric);
      if (directImpact) stageExperience.unshift(directImpact);
      // New snapshots expose one detailed experience list. Keep the old fields
      // as a publication migration fallback so existing selections do not lose
      // their content until the next publication is staged.
      stageExperience.unshift(...list(structured.experience));
      stageExperience.unshift(...list(structured.responsibilities));
      stageExperience.unshift(...list(structured.achievements));
      stageExperience.unshift(...list(structured.impact));
      stageExperience.unshift(...list(structured.outcomes));
      const expandedExperience = stageExperience.map(expandTechnologyTerms);
      const stageSkills = expandTechnologyLabels(
        [
          ...skillItems
            .filter((skill) => identities(skill).includes(key))
            .map((skill) => text(skill.title)),
          ...list(item.display_technologies)
        ].filter(Boolean)
      );
      return {
        title: careerIdentity.role || "Career stage",
        summary: displayText(item.public_summary),
        ...(careerIdentity.organization ? { company: careerIdentity.organization } : {}),
        ...(careerIdentity.period ? { period: careerIdentity.period } : {}),
        ...(stageProjects.length ? { projects: stageProjects } : {}),
        ...(expandedExperience.length ? { experience: [...new Set(expandedExperience)] } : {}),
        ...(stageSkills.length ? { skills: [...new Set(stageSkills)] } : {})
      };
    })
    .sort((left, right) => {
      const leftDate = parseEmploymentStart(left.period);
      const rightDate = parseEmploymentStart(right.period);
      if (leftDate === null && rightDate === null) return 0;
      if (leftDate === null) return 1;
      if (rightDate === null) return -1;
      return rightDate - leftDate;
    });
  // The active publication already contains only the projects selected by the
  // owner. Project type is descriptive metadata, not a visibility filter:
  // professional, personal, and open-source projects can all be featured.
  const nonProjectNarratives = new Set([
    "portfolio as proof",
    "engineering process",
    "engineering processes"
  ]);
  const selectedProjectItems = projectItems.filter(
    (project) => !nonProjectNarratives.has(text(project.title).trim().toLowerCase())
  );
  // Use the included local portrait when a deployment does not supply an external image URL.
  const profileImage =
    process.env.NEXT_PUBLIC_PROFILE_IMAGE_URL?.trim() || "/images/basil-ogbonna.jpg";
  // Keep the two profile narratives independent. A portfolio summary belongs in
  // the fixed profile rail; the About section should only use the dedicated About
  // narrative (or the publication bio), never whichever profile item happens to
  // appear first in the publication ordering.
  const portfolioSummaryItem = items.find((item) => {
    const title = text(item.title).trim().toLowerCase();
    return item.source_entity_type === "portfolio_summary" || title === "portfolio summary";
  });
  const aboutItem = items.find((item) => {
    const title = text(item.title).trim().toLowerCase();
    return (
      item.source_entity_type === "about" ||
      title === "about" ||
      (item.section === "about" && item.source_entity_type !== "portfolio_summary")
    );
  });
  // The publication bio is the resilient fallback for the portfolio summary;
  // it is separate from the About narrative below.
  const portfolioSummary = displayText(portfolioSummaryItem?.public_summary, text(profile?.bio));
  const bio = displayText(aboutItem?.public_summary, text(profile?.bio));
  const safeHref = (value: unknown) => {
    const href = text(value).trim();
    return /^(?:https?:\/\/|mailto:)/i.test(href) ? href : "";
  };
  const email = text(profile?.email, process.env.NEXT_PUBLIC_CONTACT_EMAIL).trim();
  const contactHref = safeHref(profile?.contact_url) || (email ? `mailto:${email}` : "");
  const profileLinks = [
    {
      label: "LinkedIn",
      href: safeHref(profile?.linkedin_url) || safeHref(process.env.NEXT_PUBLIC_LINKEDIN_URL)
    },
    {
      label: "GitHub",
      href: safeHref(profile?.github_url) || safeHref(process.env.NEXT_PUBLIC_GITHUB_URL)
    },
    { label: "Email", href: contactHref }
  ];
  const mediaSource = (value: unknown) => {
    if (!Array.isArray(value)) return "";
    let candidate: unknown;
    for (const entry of value as unknown[]) {
      if (typeof entry === "string") {
        if (!youtubeEmbedUrl(entry)) {
          candidate = entry;
          break;
        }
      }
      if (!entry || typeof entry !== "object") continue;
      const media = entry as Record<string, unknown>;
      if (typeof media.url === "string" || typeof media.src === "string") {
        const mediaUrl = text(media.url, text(media.src));
        if (!youtubeEmbedUrl(mediaUrl)) {
          candidate = entry;
          break;
        }
      }
    }
    const source =
      typeof candidate === "string"
        ? candidate
        : candidate && typeof candidate === "object"
          ? text(
              (candidate as Record<string, unknown>).url,
              text((candidate as Record<string, unknown>).src)
            )
          : "";
    return /^(?:https?:\/\/|\/)/i.test(source) ? source : "";
  };
  const renderedProjects = selectedProjectItems.map((item) => {
    const href = slugHref(item);
    const technologies = expandTechnologyLabels(list(item.display_technologies));
    const structured = record(item.structured_content);
    const image = mediaSource(item.sanitized_media);
    const projectType =
      projectContributionLabel(text(item.title)) ??
      (projectCareerPlacement(text(item.title))
        ? "Professional project"
        : text(structured.projectType, text(structured.project_type)));
    return {
      title: displayText(item.title, "Project"),
      summary: displayText(item.public_summary),
      ...(href ? { href } : {}),
      ...(technologies.length ? { technologies } : {}),
      ...(text(structured.category) ? { category: text(structured.category) } : {}),
      ...(projectType ? { meta: projectType } : { meta: "Selected project" }),
      ...(image ? { image } : {})
    };
  });
  const portfolioSourceUrl = safeHref(process.env.NEXT_PUBLIC_PORTFOLIO_SOURCE_URL);
  return (
    <>
      <PublicEvents
        sections={["about", "experience", "projects", "ask-basil", "blog", "contact"]}
      />
      <PageIntro name={displayName} />
      <PortfolioNavigation />
      {publicReadIsStale ? (
        <p className="portfolio-stale-notice" role="status">
          Showing the latest approved portfolio snapshot while live content reconnects.
        </p>
      ) : null}
      <main id="main-content" className="portfolio-main" tabIndex={-1}>
        <PortfolioMotion />
        <div className="portfolio-layout">
          <ProfileRail
            name={displayName}
            {...(profileImage ? { photoSrc: profileImage } : {})}
            links={profileLinks}
            className="desktop-profile-rail"
            {...(portfolioSummary ? { statement: portfolioSummary } : {})}
          />
          <div className="portfolio-stream">
            <Hero name={displayName} headline={headline} />
            <div className="mobile-profile-rail">
              <ProfileRail
                name={displayName}
                {...(profileImage ? { photoSrc: profileImage } : {})}
                links={profileLinks}
                {...(portfolioSummary ? { statement: portfolioSummary } : {})}
              />
            </div>
            <About {...(bio ? { bio } : {})} />
            <EngineeringProcesses />
            <CareerTimeline stages={timelineStages} />
            <CredentialsAndSkills
              credentials={certificationItems.map((item) => ({
                title: displayText(item.title, "Certification"),
                ...(text(item.subtitle) ? { issuer: displayText(item.subtitle) } : {}),
                ...(text(item.public_summary) ? { summary: displayText(item.public_summary) } : {})
              }))}
              skillGroups={skillItems
                .filter((item) => !text(item.career_stage))
                .map((item) => ({
                  title: text(item.title, "Technical skills"),
                  skills: expandTechnologyLabels(list(item.display_technologies))
                }))}
            />
            <Projects
              items={renderedProjects}
              {...(portfolioSourceUrl ? { portfolioSourceUrl } : {})}
            />
            <div className="intelligence-grid">
              <AskShell />
            </div>
            <Writing
              items={[
                ...publishedPosts.map((post) => ({
                  title: post.title,
                  summary: post.excerpt,
                  href: `/blog/${encodeURIComponent(post.slug)}`,
                  meta: new Date(post.visible_at).toLocaleDateString()
                })),
                ...writingItems.map((item) => {
                  const structured = record(item.structured_content);
                  const externalUrl = safeHref(
                    structured.externalUrl ??
                      structured.external_url ??
                      structured.canonicalUrl ??
                      structured.sourceUrl ??
                      structured.url
                  );
                  const detailSlug = text(item.detail_slug);
                  return {
                    title: text(item.title),
                    summary: text(item.public_summary),
                    ...(externalUrl
                      ? { href: externalUrl, external: true }
                      : detailSlug
                        ? { href: `/blog/${encodeURIComponent(detailSlug)}` }
                        : {}),
                    ...(text(item.subtitle, text(structured.platform, text(structured.source)))
                      ? {
                          meta: text(
                            item.subtitle,
                            text(structured.platform, text(structured.source))
                          )
                        }
                      : {})
                  };
                })
              ]}
            />
            <Contact />
          </div>
        </div>
      </main>
    </>
  );
}
