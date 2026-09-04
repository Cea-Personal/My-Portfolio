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
import { loadPublicBlogPosts, loadPublicPortfolio } from "@/lib/api/public-data";
import { PublicEvents } from "@/components/analytics/public-events";

export const dynamic = "force-dynamic";

export default async function PublicPortfolioPage() {
  const [snapshot, publishedPosts] = await Promise.all([
    loadPublicPortfolio(),
    loadPublicBlogPosts()
  ]);
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
      ? configuredHeadline
      : "Senior Data Engineer";
  const careerItems = items.filter(
    (item) =>
      item.source_entity_type === "experience" ||
      item.source_entity_type === "career_experience" ||
      (item.section === "experience" && String(item.title).toLowerCase() === "experience")
  );
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
  const writingItems = items.filter(
    (item) => item.section === "blog" || item.source_entity_type === "post"
  );
  const aboutItems = items.filter(
    (item) => item.section === "about" || item.source_entity_type === "profile"
  );
  const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const slugHref = (item: Record<string, unknown>) => {
    const slug = text(item.detail_slug);
    return slug ? `/projects/${encodeURIComponent(slug)}` : undefined;
  };
  const identities = (item: Record<string, unknown>) =>
    [text(item.career_stage), text(item.title)].filter(Boolean).map((value) => value.toLowerCase());
  const stageKey = (item: Record<string, unknown>) => identities(item)[0] ?? "career stage";
  const timelineStages: CareerTimelineStage[] = Array.from(
    new Map(careerItems.map((item) => [stageKey(item), item])).values()
  ).map((item) => {
    const key = stageKey(item);
    const stageProjects = projectItems
      .filter((project) => identities(project).includes(key))
      .map((project) => {
        const href = slugHref(project);
        return {
          title: text(project.title, "Project"),
          summary: text(project.public_summary),
          ...(href ? { href } : {})
        };
      });
    const stageImpacts = impactItems
      .filter((impact) => identities(impact).includes(key))
      .flatMap((impact) => [text(impact.display_metric, text(impact.public_summary))])
      .filter(Boolean);
    const directImpact = text(item.display_metric);
    if (directImpact) stageImpacts.unshift(directImpact);
    const stageSkills = [
      ...skillItems
        .filter((skill) => identities(skill).includes(key))
        .map((skill) => text(skill.title)),
      ...list(item.display_technologies)
    ].filter(Boolean);
    const company = text(item.company_name, text(item.organization_name, text(item.subtitle)));
    const period = text(
      item.period,
      [text(item.start_date), text(item.end_date)].filter(Boolean).join(" — ")
    );
    return {
      title: text(item.title, "Career stage"),
      summary: text(item.public_summary),
      ...(company ? { company } : {}),
      ...(period ? { period } : {}),
      ...(stageProjects.length ? { projects: stageProjects } : {}),
      ...(stageImpacts.length ? { impacts: stageImpacts } : {}),
      ...(stageSkills.length ? { skills: [...new Set(stageSkills)] } : {})
    };
  });
  const timelineProjectIds = new Set(
    timelineStages.flatMap((stage) => (stage.projects ?? []).map((project) => project.title))
  );
  const personalProjectItems = projectItems.filter(
    (project) => !timelineProjectIds.has(text(project.title))
  );
  // Use the included local portrait when a deployment does not supply an external image URL.
  const profileImage =
    process.env.NEXT_PUBLIC_PROFILE_IMAGE_URL?.trim() || "/images/basil-ogbonna.jpg";
  const bio = text(aboutItems[0]?.public_summary);
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
        candidate = entry;
        break;
      }
      if (!entry || typeof entry !== "object") continue;
      const media = entry as Record<string, unknown>;
      if (typeof media.url === "string" || typeof media.src === "string") {
        candidate = entry;
        break;
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
  const renderedProjects = personalProjectItems.map((item) => {
    const href = slugHref(item);
    const technologies = list(item.display_technologies);
    const image = mediaSource(item.sanitized_media);
    return {
      title: text(item.title, "Project"),
      summary: text(item.public_summary),
      ...(href ? { href } : {}),
      ...(technologies.length ? { technologies } : {}),
      ...(text(item.subtitle) ? { meta: text(item.subtitle) } : {}),
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
      <main id="main-content" className="portfolio-main" tabIndex={-1}>
        <PortfolioMotion />
        <div className="portfolio-layout">
          <ProfileRail
            name={displayName}
            {...(profileImage ? { photoSrc: profileImage } : {})}
            links={profileLinks}
            {...(bio ? { statement: bio } : {})}
          />
          <div className="portfolio-stream">
            <Hero name={displayName} headline={headline} />
            <About {...(bio ? { bio } : {})} />
            <EngineeringProcesses />
            <CareerTimeline stages={timelineStages} />
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
                ...writingItems.map((item) => ({
                  title: text(item.title),
                  summary: text(item.public_summary),
                  ...(text(item.detail_slug)
                    ? { href: `/blog/${encodeURIComponent(text(item.detail_slug))}` }
                    : {}),
                  ...(text(item.subtitle) ? { meta: text(item.subtitle) } : {})
                }))
              ]}
            />
            <Contact {...(email ? { email } : {})} />
          </div>
        </div>
      </main>
    </>
  );
}
