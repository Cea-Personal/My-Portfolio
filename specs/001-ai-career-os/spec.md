# Feature Specification: AI Career OS and Intelligent Portfolio

**Feature Branch**: `master` (no branch-creation hook configured)

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Create an evidence-backed Personal AI Career Operating System with an
intelligent one-page public portfolio, private career management, job and application intelligence,
interview preparation, content, analytics, and owner-controlled AI assistance."

## Product Vision

The product is a personal career operating system whose public face is an intelligent professional
portfolio. It continuously turns approved career evidence into a coherent public career story and
private workflows for opportunity discovery, application preparation, interview learning, and career
development. The Career Brain is the single source of professional truth, and the owner retains control
over every consequential action and every claim made public.

The intended career narrative progresses from Software Engineer to Lead Software Engineer to Data
Engineer to Senior Data Engineer, with connected positioning across Data Engineering, Data Platform
Engineering, AI Data Engineering, and AI Engineering. The narrative MUST emerge from approved evidence,
not from hard-coded marketing copy.

## Actors and Personas

- **Career Owner**: The sole administrator of private career data, evidence, job searches, applications,
  interview records, generated artifacts, publishing decisions, integrations, and visibility controls.
- **Recruiter or Hiring Manager**: A public visitor who needs a fast, credible understanding of the
  owner’s progression, impact, skills, projects, and fit for a role.
- **Technical Leader or Peer**: A public visitor who explores technical depth, architecture decisions,
  projects, measurable outcomes, and writing.
- **General Visitor**: A public visitor who browses the portfolio or uses approved public contact paths.
- **External Information Provider**: A document, job, market, or company-information source whose data is
  untrusted until normalized, checked, and governed by visibility and evidence rules.
- **Scheduled Automation**: A system actor that runs owner-configured searches and processing workflows
  without gaining authority to make consequential decisions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish Trusted Career Knowledge (Priority: P1)

As the career owner, I can add career facts manually, ingest career documents, inspect extracted facts,
link evidence, and approve what is true and publishable so every downstream experience uses one trusted
career record.

**Why this priority**: Every public story, AI answer, match result, document, and recommendation depends
on accurate, owner-controlled career knowledge.

**Independent Test**: Starting with an empty account, add one experience manually and ingest one
document, approve selected facts, keep another fact private, and verify that the approved public fact is
eligible for projection while the private fact is not.

**Acceptance Scenarios**:

1. **Given** the owner has a supported career document, **When** it is processed, **Then** extracted facts
   appear with their source, source location, confidence, trust level, and review state.
2. **Given** an extracted claim is inaccurate, **When** the owner edits and approves it, **Then** the
   corrected fact becomes authoritative while the original extraction and evidence remain traceable.
3. **Given** a fact is private or restricted, **When** public projections and public AI are used, **Then**
   the fact and its evidence are absent from all public output.
4. **Given** the owner creates a manual fact, **When** it is saved as owner verified, **Then** it is treated
   as first-class evidence with timestamps and explicit visibility.

---

### User Story 2 - Understand the Career on One Public Page (Priority: P1)

As a public visitor, I can understand the owner’s positioning, career progression, selected projects,
impact, skills, writing, and contact options in one cohesive scrolling experience.

**Why this priority**: The portfolio is the primary public product surface and the fastest route to
professional credibility and recruiter engagement.

**Independent Test**: Using approved sample projection data, a visitor can navigate every primary
section, follow the career journey, open a permitted detail page, and reach a contact action on desktop
and mobile without authenticating.

**Acceptance Scenarios**:

1. **Given** approved public career records exist, **When** a visitor opens the portfolio, **Then** the
   page presents the owner’s positioning, progression, evidence-backed impact, and primary actions.
2. **Given** a visitor selects a navigation item, **When** the target is on the primary portfolio, **Then**
   the page moves to that section without replacing the one-page experience.
3. **Given** a visitor uses a keyboard, screen reader, reduced-motion preference, or small screen,
   **When** they explore the career timeline, **Then** all content and controls remain understandable and
   operable without scroll-jacking.
4. **Given** a projected record is changed or withdrawn, **When** the public page is refreshed, **Then**
   the public representation reflects the current approved projection without a second career copy.

---

### User Story 3 - Ask Evidence-Backed Questions and Assess Role Fit (Priority: P1)

As a recruiter or visitor, I can ask questions about public professional experience or paste a job
description and receive a clear answer or match assessment grounded in approved public evidence.

**Why this priority**: Interactive evidence turns a static portfolio into a useful recruiting interface
without sacrificing truth or privacy.

**Independent Test**: With a controlled public evidence set, ask one supported and one unsupported
question, then assess a multi-requirement role and verify citations, per-requirement classifications,
deterministic scoring, and non-disclosure of private evidence.

**Acceptance Scenarios**:

1. **Given** a public question has supporting evidence, **When** the visitor asks it, **Then** the answer
   cites the relevant approved sources and distinguishes direct evidence from related evidence.
2. **Given** a public question lacks evidence, **When** the visitor asks it, **Then** the response states
   that no evidence is documented and does not invent experience.
3. **Given** a job description contains required, preferred, and optional requirements, **When** it is
   analyzed, **Then** each meaningful requirement receives its own evidence search, classification,
   weight, contribution to the score, and explanation.
4. **Given** private evidence would improve an answer, **When** a public user asks a related question,
   **Then** the response does not reveal or imply that private evidence exists.

---

### User Story 4 - Discover, Compare, and Track Opportunities (Priority: P2)

As the career owner, I can configure search profiles and sources, run or schedule searches, add jobs
manually, compare fit and opportunity value, and move jobs through a traceable lifecycle.

**Why this priority**: A unified opportunity pipeline reduces fragmented searching and focuses effort on
roles that fit the owner’s evidence, goals, constraints, and compensation expectations.

**Independent Test**: Configure one search profile and two sources, process duplicate listings plus one
manual job, verify normalization and deduplication, compare career match with opportunity score, and move
one job through multiple statuses with history preserved.

**Acceptance Scenarios**:

1. **Given** an enabled search profile and schedule, **When** a search run occurs, **Then** its source
   results are collected, normalized, deduplicated, analyzed, ranked, saved, and reported by run status.
2. **Given** the same opportunity appears from multiple sources, **When** results are processed, **Then**
   one canonical job retains all relevant source references.
3. **Given** the owner pastes only a job description, **When** the manual job is saved, **Then** it enters
   the same analysis and tracking flow as an automatically discovered job.
4. **Given** one source fails, **When** a multi-source search runs, **Then** successful sources continue and
   the failed source is reported without discarding the run’s usable results.

---

### User Story 5 - Prepare and Preserve an Application Package (Priority: P2)

As the career owner, I can analyze an application, prepare form answers, generate a tailored CV and
cover letter, research compensation, edit everything, and preserve exactly what I chose to submit.

**Why this priority**: Evidence-backed preparation saves time while preventing invented claims and
retaining the owner’s final review authority.

**Independent Test**: For one interested job, create an application workspace from pasted questions,
generate and edit a CV, cover letter, answers, and compensation recommendation, mark the chosen versions
as final, and confirm that nothing is submitted automatically.

**Acceptance Scenarios**:

1. **Given** an application question and word limit, **When** an answer is drafted, **Then** it uses the
   current job context and strongest verified evidence, respects the limit, cites its evidence privately,
   and awaits owner review.
2. **Given** a tailored CV is requested, **When** it is generated, **Then** its content is structured,
   evidence-traceable, editable, versioned, and associated with the job and job-description version.
3. **Given** compensation evidence is limited, **When** research is requested, **Then** the result states
   its assumptions, date, currency, confidence, observed evidence, and floor, target, and stretch ranges.
4. **Given** an application package is ready, **When** the owner marks selected artifacts as submitted,
   **Then** the exact versions remain retrievable and the system performs no external submission.

---

### User Story 6 - Prepare for and Learn from Interviews (Priority: P2)

As the career owner, I can track an evidence-based interview process, prepare for each stage, practice
privately, record original notes, and use accumulated learning to improve future preparation.

**Why this priority**: Interview success depends on stage-specific preparation grounded in real career
examples and honest learning from prior interviews.

**Independent Test**: Create an interview process with one inferred and one manual stage, generate a
stage kit, map questions to verified experiences, complete a mock session, record post-interview notes,
and verify that derived insights do not overwrite the original journal.

**Acceptance Scenarios**:

1. **Given** stage evidence is available, **When** an interview process is created, **Then** stages are
   ordered and cite their basis; when evidence is insufficient, the process is marked unknown and allows
   manual stages.
2. **Given** a scheduled technical stage, **When** a preparation kit is generated, **Then** it reflects the
   role, company, stage, Career Brain, prior learning, strengths, gaps, questions, and evidence-backed
   stories.
3. **Given** predicted questions are shown, **When** the owner reviews them, **Then** each is labeled high,
   medium, or lower confidence and none is presented as guaranteed.
4. **Given** post-interview notes are analyzed, **When** insights are derived, **Then** the original notes
   remain unchanged and the derived topics and strengths or gaps are separately traceable.

---

### User Story 7 - Publish Evidence-Safe Technical Writing (Priority: P3)

As the career owner, I can draft, schedule, publish, and archive technical articles with optional AI
assistance while controlling publication and keeping technical knowledge distinct from career evidence.

**Why this priority**: Writing demonstrates technical judgment and builds portfolio depth, but it must
not become false proof of professional experience.

**Independent Test**: Draft an article with AI help, reference a verified career example, approve and
publish it, verify its public detail view and knowledge indexing, then confirm the article alone cannot
substantiate an employment claim.

**Acceptance Scenarios**:

1. **Given** the owner requests help with a career-based article, **When** content is drafted, **Then**
   relevant verified Career Brain evidence is retrieved first and unsupported stories are excluded.
2. **Given** a draft is complete, **When** no explicit publication approval has occurred, **Then** the
   article remains non-public.
3. **Given** an article is published, **When** public AI retrieves it, **Then** it is identified as public
   technical knowledge rather than proof of professional experience.

---

### User Story 8 - Review Career and Search Analytics (Priority: P3)

As the career owner, I can understand portfolio engagement, opportunity and application conversion,
interview patterns, and evidence gaps without invasive visitor tracking or unsupported conclusions.

**Why this priority**: Private, actionable analytics help the owner improve positioning, targeting, and
preparation after core workflows produce sufficient data.

**Independent Test**: Load representative portfolio, job, application, and interview events, verify
funnel and engagement summaries, compare market demand with documented evidence, and confirm the system
distinguishes missing evidence from an absent skill.

**Acceptance Scenarios**:

1. **Given** portfolio interactions exist, **When** the owner views analytics, **Then** private summaries
   show engagement without exposing unnecessary visitor identity or sensitive query text.
2. **Given** application history exists, **When** the owner filters by role, country, source, work model,
   score, or salary range, **Then** counts, conversion rates, and time metrics update consistently.
3. **Given** a market skill has no Career Brain evidence, **When** gap analysis runs, **Then** the result
   says “no evidence documented” and recommends documenting, demonstrating, writing, or learning as
   distinct actions.

---

### User Story 9 - Operate Automations Safely (Priority: P3)

As the career owner, I can see, control, and troubleshoot scheduled and AI-assisted workflows while
retaining service when individual sources or models fail.

**Why this priority**: Automation becomes trustworthy only when runs are bounded, observable, retryable,
and unable to exceed owner-granted authority.

**Independent Test**: Trigger a workflow with successful, failed, and retried steps, inspect its status
and sanitized error details, disable the schedule, and verify that no consequential action occurs.

**Acceptance Scenarios**:

1. **Given** an automation is enabled, **When** it runs, **Then** the owner can inspect its purpose,
   inputs, start and completion times, state, related records, retries, and sanitized failure reason.
2. **Given** an AI provider is unavailable, **When** a dependent task is requested, **Then** the task
   fails or degrades clearly while the public portfolio and verified Career Brain remain usable.
3. **Given** retrieved content attempts to issue instructions, **When** it is processed, **Then** it is
   treated as data and cannot alter authorization, visibility, tool permissions, or system rules.

### Edge Cases

- A source document is modified, renamed, moved, duplicated, or removed after prior ingestion.
- A document is partly unreadable, password-protected, oversized, malicious, or contains conflicting
  dates and claims.
- An extracted fact has high model confidence but low trust, or multiple sources disagree.
- The owner revokes publication after a claim has been cached, cited, or used in a generated artifact.
- A professional project is legitimate but its source is unavailable and its details are confidential.
- A metric lacks units, timeframe, baseline, attribution, or sufficient supporting evidence.
- A public visitor attempts prompt injection or asks for private notes, system prompts, or secrets.
- A job description is empty, duplicated, extremely long, malformed, multilingual, or contains hostile
  instructions embedded as content.
- A requirement maps to several weaker examples but no direct evidence, or the same evidence maps to
  multiple requirements.
- A configured job source is unauthorized, rate-limited, unavailable, or changes its returned fields.
- A manual job later appears through an automated source with different title, location, or description.
- A job closes, expires, reopens, or is reposted after the owner has started an application.
- An application form cannot be accessed, includes dynamic conditional questions, or asks for sensitive
  voluntary demographic information.
- A saved answer contains outdated company-specific content or conflicts with current evidence.
- Compensation evidence uses mixed currencies, periods, employment models, or outdated research.
- Interview-stage sources disagree, stages change, or no reliable hiring-process information exists.
- Mock-interview feedback is subjective, incomplete, or inconsistent across practice sessions.
- An article is scheduled for a past time, its slug conflicts, or its cited career fact becomes private.
- Analytics volume is too small for reliable trends, or a filter could reveal sensitive individual data.
- A scheduled run overlaps a prior run or is retried after some steps completed successfully.
- A provider fails after partial output, returns unsafe markup, or exposes content outside the owner’s
  authorized scope.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity, Access, and Product Surfaces

- **FR-001**: The system MUST provide a public portfolio that requires no authentication and a private
  Career OS that requires authenticated owner access.
- **FR-002**: The system MUST treat the career owner as the only administrator unless a future approved
  specification introduces additional roles.
- **FR-003**: The system MUST prevent public users from accessing private or restricted records through
  pages, search, AI responses, citations, exports, analytics, or indirect disclosure.
- **FR-004**: The owner MUST be able to view and revoke active access to connected external providers.
- **FR-005**: The system MUST record security-relevant owner actions, visibility changes, integration
  changes, and consequential approvals in an owner-reviewable audit history.
- **FR-006**: The private dashboard MUST summarize actionable items including new high-fit jobs,
  applications awaiting action, upcoming interviews, pending preparation, new or reviewable facts,
  portfolio activity, and draft content.

#### Career Brain and Evidence

- **FR-007**: The system MUST maintain one canonical Career Brain for experiences, roles, organizations,
  projects, achievements, metrics, skills, education, certifications, architecture decisions,
  leadership examples, career facts, application history, interview history, journal knowledge, and
  published technical content.
- **FR-008**: The owner MUST be able to create, view, edit, archive, and organize manual career knowledge
  by type, role, organization, project, statement, impact, metric, technology, skill, date, evidence,
  visibility, and notes where applicable.
- **FR-009**: Manual owner facts MUST retain their source type, owner-verification status, creator, and
  creation and update times.
- **FR-010**: The owner MUST be able to connect a dedicated career-document folder and initiate or
  schedule detection of added, changed, and removed documents.
- **FR-011**: The system MUST accept approved document types including portable documents, word-processing
  documents, plain text, Markdown, certifications, and supported cloud-native documents.
- **FR-012**: The system MUST identify unchanged document versions and MUST NOT create duplicate facts or
  repeated knowledge entries from them.
- **FR-013**: Each ingestion run MUST expose pending, processing, completed, partial, or failed status and
  identify affected documents and recoverable errors.
- **FR-014**: Document processing MUST preserve the original source, source version, source location,
  processing version, and processing time.
- **FR-015**: Extracted fact candidates MUST identify organizations, roles, dates, projects,
  technologies, skills, responsibilities, achievements, metrics, decisions, leadership, and business
  outcomes when supported by the source.
- **FR-016**: Every extracted fact candidate MUST retain its source, source location, extraction method
  version, confidence, trust level, and review state.
- **FR-017**: The owner MUST be able to approve, edit, reject, or defer an extracted fact while preserving
  the original extraction and evidence relationship.
- **FR-018**: AI-inferred information MUST remain distinguishable from extracted, document-verified,
  multi-source, and owner-verified information and MUST NOT become public without owner approval.
- **FR-019**: The system MUST support public, private, and restricted visibility on all career records
  and evidence for which disclosure matters.
- **FR-020**: Significant career claims MUST link to one or more evidence records that identify evidence
  type, source, trust, confidence, visibility, and verification state.
- **FR-021**: The system MUST support professional projects whose source is available, partial, or
  unavailable and whose disclosure is public summary, private, or confidential.
- **FR-022**: Professional projects MUST retain separate private and approved public descriptions plus
  confidentiality notes.
- **FR-023**: Project contributions MUST state the owner’s supported role, such as designed, built, led,
  co-built, contributed, maintained, migrated, optimized, or architected, without implying unsupported
  sole ownership.
- **FR-024**: Project case studies MUST support problem, context, sanitized architecture, owner
  contribution, decisions, implementation narrative, technologies, impact, challenges, lessons, skills,
  career stage, evidence, and approved media or links.
- **FR-025**: The system MUST provide a Portfolio Projection in which the owner controls public
  eligibility, featured status, priority, career stage, display order, public summary, category, display
  metrics, and display technologies.
- **FR-026**: Changes to approved Career Brain records or projection controls MUST propagate to future
  public views without requiring a separate edit to duplicated career content.
- **FR-027**: The system MUST preserve superseded facts and evidence relationships sufficiently for the
  owner to understand what changed, when, and why.

#### One-Page Public Portfolio

- **FR-028**: The primary public portfolio MUST be a single-page scrolling experience containing Hero,
  About, Career Journey, Selected Projects, Measurable Impact, Skills, Writing, Role Match, Ask My AI,
  and Contact sections.
- **FR-029**: Primary navigation MUST move to sections on the same page, while articles and project case
  studies MAY have shareable detail views.
- **FR-030**: The Hero MUST communicate the owner’s name, senior data and AI engineering positioning,
  connected capability areas, and concise actions to explore work, ask AI, and assess role fit.
- **FR-031**: The career journey MUST present the approved progression from Software Engineer through
  Lead Software Engineer, Data Engineer, Senior Data Engineer, and Data Platform or AI Engineering.
- **FR-032**: Each career stage MUST be able to present approved role, organization, dates, description,
  responsibilities, technologies, work, projects, achievements, diagrams, and case studies.
- **FR-033**: On larger screens the journey MUST support an active stage indicator associated with the
  visible content; on smaller or reduced-motion experiences it MUST provide an accessible linear
  timeline without scroll-jacking.
- **FR-034**: Public experience and project content MUST prioritize verified impact and metrics before
  technology lists and MUST show context needed to interpret each metric.
- **FR-035**: Public project views MUST use only approved public descriptions and sanitized diagrams or
  media and MUST exclude confidential employer information.
- **FR-036**: The Writing section MUST show published articles and allow visitors to open a complete
  article without fragmenting the primary portfolio navigation.
- **FR-037**: The Contact section MUST provide owner-approved contact methods without exposing private
  profile fields.
- **FR-038**: The public portfolio MUST remain browseable when AI, document ingestion, job sources, or
  other private services are unavailable.

#### Evidence Retrieval, Public AI, and Role Matching

- **FR-039**: Evidence retrieval MUST combine exact structured facts, textual relevance, semantic
  relevance, metadata constraints, and optional result refinement rather than relying on a single
  undifferentiated search method.
- **FR-040**: Retrieval MUST support filtering by organization, role, project, career stage, skill,
  technology, date, visibility, confidence, evidence type, and source document.
- **FR-041**: Retrieval results MUST preserve citations and the evidence needed to verify generated
  claims.
- **FR-042**: Public AI MUST classify a visitor’s question, retrieve only approved public evidence,
  verify proposed claims against that evidence, and return an answer with citations.
- **FR-043**: Public AI MUST state when evidence is insufficient, conflicting, private, or absent and MUST
  NOT manufacture a positive answer.
- **FR-044**: Public AI MUST NOT reveal private documents, restricted evidence, system instructions,
  secrets, internal configuration, or private notes, even when prompted to do so.
- **FR-045**: The public role matcher MUST accept pasted job-description text without requiring a visitor
  account.
- **FR-046**: The role matcher MUST extract meaningful requirements, classify each as required,
  preferred, or optional, and evaluate evidence separately for each requirement.
- **FR-047**: Each requirement MUST be classified as Strong Match, Related Match, Partial Match, or No
  Evidence and show the supporting approved public evidence or the absence of evidence.
- **FR-048**: Match calculations MUST use stable published values of 1.00 for direct evidence, 0.75 for
  strong transferable evidence, 0.50 for related evidence, 0.25 for weak evidence, and 0.00 for no
  evidence, weighted 3 for required, 2 for preferred, and 1 for optional requirements.
- **FR-049**: The displayed overall match MUST be derived from the classified requirement results; AI MAY
  explain the score but MUST NOT change the calculation.
- **FR-050**: Public AI and role matching MUST apply rate and abuse controls while returning a clear,
  non-disclosing response when a request cannot be processed.

#### Job Discovery and Opportunity Management

- **FR-051**: The owner MUST be able to create multiple search profiles with target titles and synonyms,
  seniority, locations, work arrangements, employment and contract preferences, technologies,
  industries, authorization or sponsorship preferences, compensation expectations, company preferences,
  schedule, and enabled status.
- **FR-052**: The owner MUST be able to configure search schedules for daily, weekday, selected-day,
  multiple-times-per-day, or custom recurrence patterns and enable or disable each schedule.
- **FR-053**: The owner MUST be able to add, view, edit, enable, disable, test, and safely remove job
  sources without changing the core opportunity workflow.
- **FR-054**: Job sources MUST support built-in providers, employer hiring systems, feeds, configurable
  external services, and owner-approved custom adapters where access is lawful and permitted.
- **FR-055**: Before enabling a configured source, the owner MUST receive a connection-test result that
  distinguishes success, authorization failure, configuration error, rate limit, and source
  unavailability without exposing credentials.
- **FR-056**: Scheduled search runs MUST use the selected profile and enabled sources, collect results,
  normalize jobs, identify duplicates, analyze requirements, calculate career match and opportunity
  scores, persist results, and notify the owner according to preferences.
- **FR-057**: Each search run MUST retain its schedule or manual trigger, profile, attempted sources,
  result counts, start and completion times, status, retries, and sanitized errors.
- **FR-058**: The owner MUST be able to add a job manually using title, company, description, URL,
  location, known compensation, and source, with job-description text as the only required content.
- **FR-059**: Manual, recruiter, referral, automated, and other jobs MUST enter the same normalization,
  analysis, ranking, and lifecycle workflows.
- **FR-060**: Each canonical job MUST support source identity, source references, company, title,
  description and its versions, location, country, work arrangement, employment and contract type,
  compensation, currency, posted and expiry dates, discovery date, lifecycle status, and original source
  data where retention is permitted.
- **FR-061**: Duplicate detection MUST consider stable source identifiers, canonical links, company,
  title, location, and description similarity while preserving distinct source references.
- **FR-062**: Career Match Score MUST measure evidence-backed fit separately from Opportunity Score.
- **FR-063**: Opportunity Score MUST use owner-configurable weights for career fit, compensation,
  location, work arrangement, seniority, progression, authorization compatibility, company preference,
  and recency.
- **FR-064**: The system MUST preserve the factors, weights, input values, and calculation version for
  each score so the owner can understand and reproduce it.
- **FR-065**: Jobs MUST support Discovered, Shortlisted, Interested, Preparing Application, Ready to
  Apply, Applied, Recruiter Contact, Interview, Technical Assessment, Final Interview, Offer, Rejected,
  Withdrawn, and Expired states.
- **FR-066**: Every job state transition MUST retain prior state, new state, time, actor, and optional
  reason or note.
- **FR-067**: The owner MUST be able to view jobs as a filterable list and as a stage-oriented board.
- **FR-068**: A source failure MUST NOT prevent results from successful sources from being retained and
  MUST be visible in the run summary.

#### Applications, Forms, and Generated Materials

- **FR-069**: Each interested job MUST provide an application workspace containing overview, job
  analysis, requirement match, readiness, form, CV, cover letter, answers, compensation research,
  interview process, journal, documents, company notes, and timeline where data exists.
- **FR-070**: The owner MUST be able to create an application from an interested job and preserve a
  separate application lifecycle and status history.
- **FR-071**: The owner MUST be able to supply an application link, paste application questions, or add
  form fields manually.
- **FR-072**: Where access is allowed, the system MAY identify accessible application fields; otherwise
  it MUST support copy-and-paste and manual entry without blocking preparation.
- **FR-073**: Application fields MUST support label, type, required state, options, character or word
  limit, and category including identity, contact, work authorization, career facts, experience,
  motivation, compensation, availability, education, documents, links, and voluntary demographics.
- **FR-074**: The system MUST NOT infer sensitive demographic answers and MUST NOT draft them without
  explicit owner input.
- **FR-075**: The owner MUST be able to maintain a reusable private application profile for deterministic
  identity, contact, links, location, work authorization, sponsorship, availability, relocation,
  languages, education, and certifications.
- **FR-076**: Deterministic application fields MUST use owner-approved profile data without AI rewriting.
- **FR-077**: Career-related answer drafts MUST use the current question, job context, strongest verified
  evidence, and applicable length constraints and MUST await owner review.
- **FR-078**: Each answer version MUST retain the original question, generated draft, owner’s final text,
  evidence, generation context, applicable limit, and owner edits.
- **FR-079**: The owner MUST be able to search and adapt saved answers, but reuse MUST remove outdated or
  irrelevant company-specific context and revalidate against current evidence.
- **FR-080**: CV generation MUST rank verified achievements and produce editable structured content for
  a selected presentation style without allowing generated prose to control final document layout.
- **FR-081**: Each CV version MUST retain the job, company, application, job-description version,
  evidence, generation date, presentation style, revision, and final-submission status.
- **FR-082**: Cover-letter generation MUST select the strongest two to four evidence-backed connections
  between the role’s business needs and the owner’s experience rather than merely summarize the CV.
- **FR-083**: Cover letters MUST support owner-selected tone and length and retain every version and its
  evidence context.
- **FR-084**: An application package MUST be able to include selected versions of the CV, cover letter,
  answers, compensation recommendation, job analysis, requirement match, highlighted projects, relevant
  writing, interview preparation, and final submitted-answer snapshot.
- **FR-085**: The system MUST preserve exactly which artifact versions were marked final or submitted for
  each application.
- **FR-086**: The system MUST NOT submit applications, forms, answers, or recruiter communications on the
  owner’s behalf.

#### Compensation Intelligence

- **FR-087**: Compensation research MUST consider role, seniority, company, industry, location, country,
  work arrangement, employment and contract model, published range, comparable jobs, market evidence,
  and career match.
- **FR-088**: Evidence MUST be prioritized from same company and role, same company and similar role,
  same role and city, same role and country, then comparable market, with departures stated.
- **FR-089**: Each result MUST include floor, target, and stretch values; observed market range;
  recommended answer; confidence; sources; research date; currency; assumptions; and selected strategy.
- **FR-090**: The owner MUST be able to choose Conservative, Market Competitive, Aggressive, or Maximum
  Reasonable strategy without changing the underlying observed evidence.
- **FR-091**: Compensation MUST support annual, monthly, hourly, daily, business-to-business, freelance,
  base, bonus, equity, and total-compensation contexts with explicit conversions and assumptions.
- **FR-092**: Historical compensation research and recommendations MUST remain associated with the job
  and retrievable after newer research is performed.

#### Journal and Interview Intelligence

- **FR-093**: The owner MUST be able to create private journal entries linked to a job, application,
  interview, assessment, recruiter interaction, rejection, offer, or general career topic, with title,
  original text, date, tags, attachments, and related records.
- **FR-094**: Derived journal insights MUST be stored separately and MUST NOT alter original journal text.
- **FR-095**: When a job enters an interview-related state, the system MUST allow creation of an Interview
  Process and attempt to identify stages from the job description, approved public company information,
  owner-provided recruiter information, history, and manual input in that priority order.
- **FR-096**: If stage evidence is insufficient, the process MUST display Interview Process Unknown and
  allow the owner to add arbitrary stages.
- **FR-097**: Interview stages MUST support name, type, sequence, scheduled date, status, notes,
  preparation state, outcome, source, and confidence where inferred.
- **FR-098**: The owner MUST be able to add, reorder, edit, cancel, and complete interview stages without
  losing stage history.
- **FR-099**: Each stage MUST support a personalized preparation kit based on the job description, stage,
  company, Career Brain, and prior interview learning.
- **FR-100**: A preparation kit MUST include stage purpose, relevant role requirements, likely topics and
  questions, strongest experiences, projects, achievements, stories, weak areas, company and role
  research, revision topics, behavioral preparation, questions for interviewers, compensation
  preparation where relevant, personal notes, and a mock-interview option.
- **FR-101**: Predicted interview questions MUST be labeled High Probability, Medium Probability, or Lower
  Confidence and MUST NOT be represented as guaranteed.
- **FR-102**: Each likely question MUST be able to map to a verified experience with problem, context,
  owner contribution, technologies, impact, and suggested talking points.
- **FR-103**: The owner MUST be able to create reusable evidence-backed stories structured by situation,
  task, action, result, metrics, skills, technologies, project, role, and visibility.
- **FR-104**: Private mock interviews MUST support recruiter, technical, system-design, behavioral,
  hiring-manager, and leadership modes using the current job, stage, Career Brain, company context, and
  prior learning.
- **FR-105**: Mock-interview feedback MUST address technical accuracy, structure, evidence use, clarity,
  conciseness, and improvement areas without presenting subjective scores as scientific measurements.
- **FR-106**: The owner MUST be able to record post-interview questions, topics, successes, difficulties,
  follow-ups, and original notes and separately approve or reject derived insights.
- **FR-107**: Interview analytics MUST summarize recurring technologies, system-design topics,
  behavioral themes, strengths, gaps, conversion rates, and assessment patterns and use them to recommend
  preparation for future stages.
- **FR-108**: The system MUST NOT join meetings, transcribe live employer interviews, provide hidden live
  assistance, or supply real-time interview answers.

#### Writing, Analytics, and Career Intelligence

- **FR-109**: The owner MUST be able to create, edit, preview, schedule, publish, archive, and version
  articles with title, shareable identifier, excerpt, content, cover, tags, search metadata, status, and
  publication date.
- **FR-110**: Optional writing assistance MUST support topic ideas, outlines, drafting, rewriting,
  summaries, titles, tags, and discoverability suggestions.
- **FR-111**: Writing about the owner’s professional experience MUST retrieve approved Career Brain
  evidence before drafting and MUST exclude unsupported career stories.
- **FR-112**: Publishing or republishing an article MUST require explicit owner approval.
- **FR-113**: Published articles MAY be indexed as public technical knowledge but MUST NOT be treated as
  proof of professional employment or project experience without independent evidence.
- **FR-114**: Portfolio analytics MUST be private and MAY track visitors, sessions, page and section
  engagement, project and article views, AI conversations, role analyses, common skill queries, and
  popular projects using privacy-conscious data.
- **FR-115**: Job and application analytics MUST track discovery, shortlisting, interest, applications,
  responses, recruiter screens, interviews, assessments, finals, offers, rejections, conversions, and
  time through the funnel.
- **FR-116**: The owner MUST be able to filter job and application analytics by role, country, source,
  work arrangement, match score, opportunity score, and compensation range.
- **FR-117**: Career-gap analysis MUST compare market demand with documented Career Brain evidence and
  distinguish “no evidence documented” from “skill not possessed.”
- **FR-118**: Gap recommendations MUST distinguish documenting existing experience, creating a
  demonstrative project, publishing an article, and learning or practicing a skill.
- **FR-119**: Analytics MUST avoid unnecessarily invasive tracking and MUST NOT expose private visitor or
  owner data publicly.

#### Orchestration, Configuration, and Human Control

- **FR-120**: A central task coordinator MUST classify requested work, choose an appropriate bounded
  workflow, invoke only necessary reasoning or deterministic capabilities, manage dependencies, track
  execution, and aggregate results.
- **FR-121**: Semantic reasoning MAY be used for evidence extraction and verification, career gaps, job
  discovery and ranking explanations, job-description analysis, document composition, compensation
  research, interview preparation and analysis, public Q&A, role matching explanations, and writing
  assistance.
- **FR-122**: Simple data entry, permissions, scoring, state changes, deduplication, scheduling,
  validation, rendering, field mapping, and analytics aggregation MUST remain deterministic.
- **FR-123**: The owner MUST be able to configure AI capabilities by task, including selected provider,
  model class, creativity, length limits, timeout, retry, and fallback where supported.
- **FR-124**: Each AI execution MUST retain task type, configuration, instruction version, usage, elapsed
  time, status, sanitized error, and related record without logging unnecessary sensitive content.
- **FR-125**: Retrieved and uploaded content MUST be treated as data and MUST NOT alter governing
  instructions, authorization, visibility, or tool permissions.
- **FR-126**: Consequential outputs MUST remain drafts or recommendations until the owner explicitly
  approves the corresponding action.

### State Transitions

- **ST-001 Career Fact**: Candidate -> In Review -> Approved, Edited and Approved, Rejected, or Deferred.
  Only approved facts are eligible for trusted downstream use, and public use also requires public
  visibility and projection eligibility.
- **ST-002 Document Ingestion**: Pending -> Processing -> Completed, Partial, or Failed. A changed source
  creates a new version; a removed source is marked unavailable without silently deleting verified facts.
- **ST-003 Job**: Discovered -> Shortlisted -> Interested -> Preparing Application -> Ready to Apply ->
  Applied -> Recruiter Contact -> Interview or Technical Assessment -> Final Interview -> Offer,
  Rejected, Withdrawn, or Expired. Authorized backward moves retain transition history.
- **ST-004 Application Artifact**: Draft -> Owner Reviewed -> Final -> Submitted Snapshot or Superseded.
  Only the owner can mark Final or Submitted Snapshot.
- **ST-005 Interview Stage**: Proposed or Manual -> Planned -> Scheduled -> Completed, Cancelled, or
  Skipped. Reordering or correction retains prior values.
- **ST-006 Article**: Draft -> Scheduled or Published -> Archived. Republishing or material edits create
  a new version and require owner approval.
- **ST-007 Automation Run**: Pending -> Running -> Completed, Partial, Failed, or Cancelled, with retry
  attempts linked to the original run.

### AI Behavior Requirements

- **AIR-001**: Every material career claim produced by AI MUST be supported by identified evidence with
  sufficient provenance for owner or public verification according to visibility.
- **AIR-002**: AI MUST clearly distinguish direct evidence, transferable evidence, related evidence,
  weak evidence, inference, and no documented evidence.
- **AIR-003**: AI MUST NOT invent or embellish employers, roles, dates, duties, skills, projects,
  leadership, education, certifications, metrics, impact, compensation evidence, or interview history.
- **AIR-004**: AI MUST refuse or safely redirect requests to disclose private data, confidential employer
  information, internal instructions, secrets, or unauthorized records.
- **AIR-005**: AI-generated drafts MUST preserve source attribution and MUST NOT change deterministic
  scores, permissions, state transitions, or approved facts.
- **AIR-006**: Model confidence MUST remain separate from evidence trust and owner verification.
- **AIR-007**: When sources conflict, AI MUST present the conflict or request owner review rather than
  silently selecting a convenient claim.
- **AIR-008**: Prompt, model, retrieval, and evaluation changes MUST be version-identifiable for generated
  outputs and execution records.

### Privacy and Security Requirements

- **PSR-001**: Private and restricted data MUST be excluded before public retrieval or generation, not
  removed only from the final response.
- **PSR-002**: Authentication, authorization, and record-level access controls MUST fail closed.
- **PSR-003**: Credentials and integration secrets MUST never be displayed after entry or included in
  public responses, generated artifacts, analytics, or ordinary logs.
- **PSR-004**: Uploaded files, descriptions, forms, web content, and provider responses MUST be validated,
  size-limited where appropriate, safely parsed, and sanitized before display or processing.
- **PSR-005**: External content MUST be prevented from triggering unauthorized network access, tool use,
  data disclosure, or instruction changes.
- **PSR-006**: Public AI, matching, contact, and form-entry surfaces MUST have abuse and rate protections
  with accessible error feedback.
- **PSR-007**: Confidential project records MUST never expose proprietary source, customer information,
  private interfaces, internal credentials, detailed private infrastructure, trade secrets, or
  confidential documents.
- **PSR-008**: Analytics and operational records MUST minimize sensitive text and retain only data needed
  for documented owner value, security, and troubleshooting.
- **PSR-009**: Owner-approved deletion, disconnection, or visibility changes MUST propagate to future
  retrieval and publication and report any retained audit or submitted-artifact exceptions.

### Non-Functional Requirements

- **NFR-001 Accessibility**: Public and private workflows MUST meet WCAG 2.1 AA acceptance checks,
  including keyboard operation, semantic structure, visible focus, screen-reader labels, sufficient
  contrast, reduced motion, and alternatives to color, hover, or animation.
- **NFR-002 Public Responsiveness**: At least 95% of normal public page visits MUST show usable primary
  content within 2.5 seconds on a representative mid-range mobile device and broadband connection.
- **NFR-003 Interaction Feedback**: At least 95% of ordinary owner actions MUST acknowledge input within
  one second; longer work MUST show progress, status, cancellation where safe, and a recoverable outcome.
- **NFR-004 AI Feedback**: At least 95% of public AI and role-match requests under normal load MUST begin
  showing a response or meaningful progress within three seconds.
- **NFR-005 Reliability**: Failure of document ingestion, one job source, or one AI provider MUST NOT make
  approved public portfolio content or verified Career Brain records unavailable.
- **NFR-006 Idempotency**: Repeating an ingestion, scheduled search, notification decision, or retried
  workflow with the same inputs MUST NOT create unintended duplicate documents, facts, jobs, or actions.
- **NFR-007 Observability**: Every asynchronous, scheduled, or AI-assisted run MUST have an inspectable
  identity, state, timestamps, related records, retry history, and sanitized failure reason.
- **NFR-008 Data Integrity**: Every state transition, visibility decision, score, evidence link, and final
  generated artifact MUST remain attributable to its inputs, actor, rule or version, and time.
- **NFR-009 Graceful Degradation**: When external or AI capabilities fail, users MUST receive a clear
  non-technical explanation and retain access to unaffected stored information and manual workflows.
- **NFR-010 Scalability**: The product MUST remain usable with at least 10,000 career facts and evidence
  links, 10,000 document chunks, 25,000 jobs, 2,500 applications, 1,000 generated artifacts, and five
  years of analytics for one owner.
- **NFR-011 Compatibility**: Primary public and private workflows MUST be operable on current major
  desktop and mobile browsers without requiring installation.
- **NFR-012 Data Portability**: The owner MUST be able to export core career facts, evidence metadata,
  jobs, applications, interviews, journal entries, and generated-artifact metadata in a documented,
  commonly readable form.

### Key Entities *(include if feature involves data)*

- **Owner Profile**: Private identity, contact, authorization, preferences, links, and reusable
  application details controlled by the career owner.
- **Career Experience**: A role at an organization with dates, responsibilities, career stage, related
  skills, projects, achievements, and evidence.
- **Career Fact**: A discrete professional statement with type, source, trust, confidence, review state,
  visibility, owner verification, and evidence links.
- **Project**: Personal, open-source, or professional work with source availability, confidentiality,
  owner contribution, public and private descriptions, technologies, impact, and evidence.
- **Achievement and Career Metric**: An evidence-backed outcome and its quantified value, units,
  timeframe, context, attribution, and display eligibility.
- **Skill, Education, Certification, Architecture Decision, and Leadership Example**: Structured career
  knowledge linked to experiences, projects, dates, evidence, and visibility.
- **Evidence**: A document, source location, owner-verified manual record, project record, approved public
  source, or corroborating set that supports a claim and retains trust and verification metadata.
- **Portfolio Projection**: Public display controls selecting and ordering approved Career Brain records
  and their sanitized summaries, metrics, and technologies.
- **Document and Document Version**: A source file and immutable version metadata, processing state,
  extracted content references, and availability.
- **Extracted Fact Review**: The original extraction, confidence, evidence, review decision, owner edits,
  reviewer, and timestamps.
- **Search Profile**: Owner-defined role, location, technology, industry, authorization, compensation,
  company, schedule, and exclusion preferences.
- **Job Source and Search Run**: A configured external or manual origin and an observable execution over
  selected sources and a search profile.
- **Job and Job Requirement**: A canonical opportunity, its source references and description versions,
  extracted requirements, match classifications, scores, and lifecycle history.
- **Application**: The owner’s pursuit of a job, including workspace, lifecycle, form fields, answers,
  notes, documents, packages, compensation research, interviews, and status history.
- **Generated Artifact and Version**: A CV, cover letter, answer, package, or preparation kit with purpose,
  inputs, evidence, generation context, owner edits, final status, and immutable version history.
- **Compensation Research**: Dated market evidence, normalization assumptions, confidence, strategy, and
  floor, target, and stretch recommendations linked to a job.
- **Journal Entry and Derived Insight**: Immutable owner-authored notes and separately stored AI-derived
  topics, strengths, gaps, or follow-ups.
- **Interview Process and Stage**: An evidence-based or manual sequence of stages, schedules, statuses,
  preparation, outcomes, sources, and history for an application.
- **Interview Question and Career Story**: A predicted or observed question and an evidence-backed
  situation, task, action, result, metrics, skills, and project mapping.
- **Article and Version**: Draft, scheduled, published, or archived technical content with metadata,
  approval history, public visibility, and knowledge classification.
- **Analytics Event and Summary**: Privacy-conscious interaction or lifecycle data and derived private
  metrics for portfolio, jobs, applications, interviews, and career gaps.
- **Automation and Agent Run**: A scheduled or requested workflow execution with bounded purpose,
  configuration, states, dependencies, usage, timestamps, retries, and sanitized errors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of target visitors can identify the owner’s current
  positioning, career progression, two evidence-backed impacts, and a contact path within three minutes.
- **SC-002**: At least 95% of approved public Career Brain changes appear correctly in the public
  portfolio on the next content refresh without a second manual career-content edit.
- **SC-003**: In a curated evaluation set, 100% of material public AI career claims have a valid approved
  public citation, and zero private or restricted facts are disclosed.
- **SC-004**: In unsupported-question tests, at least 99% of responses explicitly report insufficient or
  absent evidence rather than present a fabricated professional claim.
- **SC-005**: For a representative role description, 100% of human-identified meaningful requirements
  receive an individual classification, evidence result, weight, and contribution to a reproducible
  overall score.
- **SC-006**: The owner can add and approve a manual career fact with evidence and visibility in under
  two minutes, excluding time spent composing the fact.
- **SC-007**: At least 95% of supported, readable career documents complete processing without manual
  recovery, and unchanged documents produce zero duplicate versions or facts on repeat processing.
- **SC-008**: The owner can review, edit, approve, or reject each extracted fact in no more than three
  primary interactions from the review queue.
- **SC-009**: In a controlled set of duplicate listings, at least 95% are consolidated correctly while
  retaining all valid source references, with fewer than 2% of distinct jobs incorrectly merged.
- **SC-010**: The owner can add a manually discovered job from pasted description text and receive the
  same analysis and tracking options as a sourced job within two minutes.
- **SC-011**: For every displayed job score, the owner can inspect all factors, weights, evidence, and
  calculation version and reproduce the displayed result exactly.
- **SC-012**: The owner can prepare, edit, and mark a complete application package for one job without any
  automatic external submission, and 100% of final artifacts remain retrievable by exact version.
- **SC-013**: In evidence audits, 100% of generated CV claims, cover-letter experience claims, and career
  application answers trace to verified evidence or are explicitly identified as owner-provided intent.
- **SC-014**: The owner can create or correct an interview process, generate one stage-specific kit, and
  locate three relevant evidence-backed stories within ten minutes.
- **SC-015**: Original journal and post-interview text remains byte-for-byte unchanged after insight
  generation in 100% of integrity tests.
- **SC-016**: In accessibility evaluation, all primary workflows complete with keyboard-only navigation
  and screen-reader use, with no critical WCAG 2.1 AA violations.
- **SC-017**: At least 95% of public portfolio visits expose usable primary content within 2.5 seconds on
  the defined representative mobile test, and timeline interaction never blocks native scrolling.
- **SC-018**: Failure tests for document processing, one job source, and one AI provider preserve access
  to approved portfolio content and verified Career Brain data in 100% of cases.
- **SC-019**: Every scheduled, ingestion, and AI-assisted run in audit sampling has a visible state,
  timestamps, related record, retry history, and sanitized outcome.
- **SC-020**: In owner usability testing, at least 85% of primary tasks are completed on the first attempt
  without assistance, and the owner rates trust and control at least 4 out of 5.
- **SC-021**: Analytics reports match source lifecycle records within 1% for counts, conversion rates,
  and time-to-stage calculations across the acceptance dataset.
- **SC-022**: In gap-analysis evaluation, 100% of missing-documentation cases are labeled “no evidence
  documented” and are never restated as proof that the owner lacks the skill.

## Assumptions

- The initial product serves one career owner; additional administrators, teams, recruiters with
  accounts, and multi-tenant organizations require separate future specifications.
- Public visitors do not create accounts, save role matches, or access private application workflows.
- The owner has the legal right to provide uploaded career documents and to publish approved summaries.
- Owner-verified manual facts are legitimate evidence, but their source type remains visible to the
  owner and is not misrepresented as documentary corroboration.
- English is the initial authoring and analysis language; source content in other languages may be
  retained, but full multilingual experience requires later acceptance criteria.
- Current industry-standard retention and deletion controls apply until the owner defines stricter
  policy; immutable audit and submitted-artifact records may retain minimal integrity metadata.
- External providers remain optional. Loss of a provider does not invalidate stored verified evidence or
  block manual workflows.
- Company hiring-process and compensation information is used only when lawfully and publicly available
  or supplied by the owner.
- Notifications are informational and follow owner preferences; they never authorize application,
  publication, or communication actions.
- Implementation technologies, service topology, storage choices, and deployment details are decided in
  the planning phase subject to the constitution and this specification.

## Dependencies

- Owner access to career evidence and permission to connect the selected document source.
- At least one lawful job-information source or manual job entry for opportunity workflows.
- Approved public career facts and Portfolio Projection records for meaningful public AI responses.
- Current external market evidence for confident compensation recommendations.
- Owner-provided recruiter or interview information when public evidence is insufficient.
- Available AI reasoning and retrieval capability for assisted features; manual and deterministic
  workflows remain available when it is unavailable.

## Scope and Release Boundaries

### Included in the Core Release

- One-page public portfolio, career timeline, selected projects, impact, skills, writing, and contact.
- Authentication, private dashboard, manual Career Brain management, evidence, trust, visibility,
  Portfolio Projection, document ingestion, extraction review, and evidence-backed retrieval.
- Public Ask My AI and recruiter role matching with citations and deterministic scoring.
- Manual job entry, canonical job tracking, application workspace, versioned CV and cover-letter
  generation, saved answers, application journal, and private content management.

### Included as Planned Expansion

- Configurable automated job sources and schedules, opportunity ranking, and notifications.
- Application-form intelligence, compensation intelligence, interview processes and preparation,
  practice interviews, interview learning, and advanced career and funnel analytics.
- Broader automation and coordinated domain-specific AI workflows within the same human-control rules.

### Explicitly Out of Scope

- Automatic submission of job applications, application forms, salary expectations, or recruiter
  communications.
- Meeting-joining bots, live employer-interview transcription, hidden interview assistants, or real-time
  answer assistance during interviews.
- Automatic publication of articles, new career facts, or changes to verified evidence.
- Exposure of confidential employer assets or recreation of unavailable proprietary systems.
- A recruiter marketplace, employer applicant-tracking product, or multi-owner enterprise platform.
- Runtime dependence on software-development agents or autonomous production deployment.
