# Portfolio Experience Contract

**Version**: `portfolio-experience/v2`  
**Authority**: FR-028–FR-038, FR-127–FR-133, SC-023–SC-027

## Public Composition

The primary route is one scrolling portfolio with this semantic order:

1. Hero
2. About
3. Experience
4. Projects, including Portfolio as Proof
5. Ask Basil
6. Blog
7. Let’s Talk

Primary navigation exposes About, Experience, Projects, Blog, and Let’s Talk anchors plus Owner Login.
Project and article details may use dedicated routes. Impact, metrics, professional projects, skills, and
tools are not independent top-level sections; they belong to an Experience stage.

## Publication Boundary

- Career and project content comes only from the active immutable publication returned by the public
  portfolio contract.
- **E-001 exception**: on a typed live-read transport, timeout, or response-validation failure, anonymous
  portfolio sections may read a build-generated `PublicFallbackSnapshot` containing the most recent
  owner-approved publication. The snapshot is allowlisted, immutable, versioned with its source publication
  and hash, and carries generated time/stale metadata. It is not hand-authored frontend career content.
- The frontend may provide layout labels and non-career empty-state copy, but neither live data nor E-001
  may provide unapproved roles, organizations, dates, projects, impacts, skills, tools, metrics, or claims.
- An explicit `no_active_publication` or `withdrawn` response always takes precedence over E-001 and
  produces an honest `unpublished` state. Navigation, theme control, Owner Login, and the owner-approved
  non-career contact shell may remain usable.
- E-001 is never valid for private routes, Ask Basil/role-fit answers, retrieval/citations, analytics,
  embeddings, contact mutations, or any other authenticated or AI response.
- Withdrawal removes the prior publication’s public reachability before a replacement is rendered.

### Public read outcome

Every public portfolio read returns one typed outcome: `live` (current active publication), `fallback`
(E-001 snapshot plus stale metadata), `empty` (explicit no publication/withdrawal), or `error` (no safe
content). Callers must preserve this distinction; an error cannot be silently converted into empty content.

## Hero Contract

The visual sequence is:

1. Data Engineer
2. Data Platform Engineer
3. AI Data Engineer
4. AI Engineer
5. AI Software Engineer
6. Software Engineer

“Engineer” may remain visually fixed. Each state exposes one complete accessible label. Animation is a
progressive enhancement; reduced motion receives a static label or non-disorienting transition. The hero
contains Basil Ogbonna, See the work, Read the blog, and a career signal linked to Experience.

Acceptance viewports cover representative mobile, tablet, smaller desktop, and large desktop at normal
and 200% zoom. The document must not gain horizontal overflow, and no essential label/action may clip.

## Profile Rail Contract

At supported wide layouts, the rail is sticky within its content boundary and contains:

- owner-approved image or an accessible intentional placeholder;
- concise owner-approved professional summary;
- centered owner-approved LinkedIn, GitHub, and email/contact destinations when configured;
- “Open to meaningful work” availability statement.

It does not repeat a redundant trailing name/title block. On smaller layouts the same information moves
into normal flow and does not cover navigation or portfolio content.

## Experience Contract

Stage order and stable keys are:

| Order | Key | Public label | Default semantic type |
|-------|-----|--------------|-----------------------|
| 1 | `web_developer` | Web Developer | role |
| 2 | `software_engineer` | Software Engineer | role |
| 3 | `lead_software_engineer` | Lead Software Engineer | role |
| 4 | `data_engineer` | Data Engineer | role |
| 5 | `senior_data_engineer` | Senior Data Engineer | role |
| 6 | `ai_engineer_software_data` | AI Engineer — Software and Data | capability |

A closed chapter exposes role, approved organization/date values when available, and concise summary.
Its toggle reports expanded state and controls the immediately following detail region. The detail may
contain selected work, professional projects, impact/metrics with context, skills/tools, contribution,
sanitized architecture, and case-study links. Closing a chapter leaves every stage summary discoverable.

The last stage may be emitted as `role` only when approved evidence supports a formal employer title.

## Project Contract

- Personal and open-source projects render as substantial visual chapters rather than uniform summary
  cards. Each published featured project has an approved `detail`, `demo`, or `external` destination.
- Professional projects render under the associated Experience stage and use only approved sanitized
  descriptions, media, contribution types, and links.
- Portfolio as Proof is a personal first-party project. It describes owner-approved technology,
  architecture/process, evidence-grounded AI/RAG/vector behavior, privacy boundaries, and inaccessible
  private workflows without disclosing their contents or offering public access.

## Ask Basil Contract

Ask Basil contains two modes in one section:

- portfolio question: streamed evidence-grounded answer with citations or explicit abstention;
- How do I fit?: pasted job description, independent requirement results, deterministic score, evidence,
  and limitations.

The modes retain separate input, loading, error, retry, evidence, and result state. Switching modes does
not relabel an AI-generated answer as a deterministic score or discard an in-progress result without
warning. Private evidence is excluded before either retrieval path.

## Theme and Accessibility Contract

- Light and dark presentations maintain WCAG 2.1 AA contrast for essential text, controls, focus,
  borders, proof labels, status messages, and role-fit results.
- Meaning does not depend only on color, motion, hover, accordion state, or pointer use.
- Keyboard order follows the semantic document; focus is never moved merely because hero text changes.
- Empty, loading, insufficient-evidence, provider-error, and retry states use announced text.

## Acceptance Evidence

Completion requires projection-backed seeded E2E tests, an empty-publication test, keyboard and
accessibility-tree journeys, reduced-motion checks, light/dark contrast checks, viewport/zoom overflow
checks, and public/private evidence-boundary tests. Screenshots alone or page-reachability checks do not
satisfy this contract.
