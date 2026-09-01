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
import { loadPublicPortfolio } from "@/lib/api/public-data";

export const dynamic = "force-dynamic";

export default async function PublicPortfolioPage() {
  const snapshot = await loadPublicPortfolio();
  const items = snapshot.items;
  const profile = snapshot.publication;
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
  const careerItems = items.filter((item) => item.source_entity_type === "experience");
  const projectItems = items.filter((item) => item.source_entity_type === "project");
  const impactItems = items.filter((item) => item.source_entity_type === "achievement");
  const skillItems = items.filter((item) => item.source_entity_type === "skill");
  const writingItems = items.filter((item) => item.source_entity_type === "post");
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
  const fallbackStages: CareerTimelineStage[] = [
    {
      title: "Web Developer",
      summary: "The beginning of a career built on shipping useful software."
    },
    {
      title: "Software Engineer",
      summary: "Expanding from web delivery into broader software systems and engineering practice."
    },
    {
      title: "Lead Software Engineer",
      summary: "Leading delivery, systems thinking, and teams through complex work."
    },
    {
      title: "Data Engineer",
      summary: "Building reliable pipelines and turning raw information into trusted data."
    },
    {
      title: "Senior Data Engineer",
      summary: "Designing scalable data platforms with measurable outcomes."
    },
    {
      title: "AI Engineer (Software + Data)",
      summary:
        "A parallel capability combining software and data foundations for practical AI systems."
    }
  ];
  const timelineStages: CareerTimelineStage[] = careerItems.length
    ? Array.from(new Map(careerItems.map((item) => [stageKey(item), item])).values()).map(
        (item) => {
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
          const company = text(
            item.company_name,
            text(item.organization_name, text(item.subtitle))
          );
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
        }
      )
    : fallbackStages;
  const timelineProjectIds = new Set(
    timelineStages.flatMap((stage) => (stage.projects ?? []).map((project) => project.title))
  );
  const personalProjectItems = projectItems.filter(
    (project) => !timelineProjectIds.has(text(project.title))
  );
  const profileImage = process.env.NEXT_PUBLIC_PROFILE_IMAGE_URL?.trim();
  const bio =
    typeof profile?.bio === "string"
      ? profile.bio
      : "I build software, data, and AI systems with a focus on clarity, reliability, and useful outcomes.";
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
  return (
    <>
      <PageIntro name={displayName} />
      <PortfolioNavigation />
      <main id="main-content" className="portfolio-main">
        <PortfolioMotion />
        <div className="portfolio-layout">
          <ProfileRail
            name={displayName}
            {...(profileImage ? { photoSrc: profileImage } : {})}
            links={profileLinks}
          />
          <div className="portfolio-stream">
            <Hero name={displayName} headline={headline} />
            <EngineeringProcesses />
            <About bio={bio} />
            <CareerTimeline stages={timelineStages} />
            <Projects items={renderedProjects} />
            <div className="intelligence-grid">
              <AskShell />
            </div>
            <Writing
              items={writingItems.map((item) => ({
                title: text(item.title),
                summary: text(item.public_summary),
                ...(text(item.detail_slug)
                  ? { href: `/blog/${encodeURIComponent(text(item.detail_slug))}` }
                  : {}),
                ...(text(item.subtitle) ? { meta: text(item.subtitle) } : {})
              }))}
            />
            <Contact {...(email ? { email } : {})} />
          </div>
        </div>
      </main>
    </>
  );
}
