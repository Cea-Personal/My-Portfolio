# Portfolio + Career OS: V1 operating agreement

Approved simplification implemented from the owner's “V1 Simplification and Feature Freeze” brief. This is a presentation and navigation change, not a rewrite or a deletion of working capabilities.

## Feature classification

| Feature                                                           | V1 classification               | Purpose and access                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Public positioning, impact, experience and projects               | ACTIVE                          | Help recruiters and clients understand Basil and inspect approved evidence.                                                     |
| Ask Basil, including role fit, grounding and references           | ACTIVE / FROZEN development     | Answer visitor questions from public evidence only; no new assistant features.                                                  |
| Skills, education and certifications                              | ACTIVE                          | Support experience and projects; credentials are expandable.                                                                    |
| Engineering processes and Portfolio as Proof                      | ADVANCED/HIDDEN                 | Supporting technical evidence in expandable homepage sections.                                                                  |
| Contact and professional profiles                                 | ACTIVE                          | Convert interest into a professional conversation.                                                                              |
| Writing and blog editor                                           | ACTIVE use / FROZEN development | Publish useful material from actual work; no CMS expansion.                                                                     |
| Today                                                             | ACTIVE                          | Recent, owner-scoped next actions rather than a second knowledge overview.                                                      |
| Jobs, discovery, matching and shortlisting                        | ACTIVE                          | Find and review genuinely relevant opportunities.                                                                               |
| Applications, tailored CVs, letters and evidence maps             | ACTIVE                          | Prepare, review and manually submit strong applications. Libraries and reusable profiles remain expandable inside Applications. |
| Interviews, preparation, mocks and debriefs                       | ACTIVE                          | Prepare for real interviews and capture outcomes.                                                                               |
| Freelance, fit scores, pricing and proposals                      | ACTIVE                          | Pursue clients, review proposals and submit manually.                                                                           |
| Career Brain, source provenance and verified facts                | FOUNDATIONAL / ACTIVE           | Maintain the private career source of truth, distinct from Today.                                                               |
| Publication staging, approval, activation, withdrawal and history | FOUNDATIONAL / FROZEN           | Preserve the deliberate private-to-public boundary.                                                                             |
| Documents, Drive sync, indexing, retrieval and recovery           | FOUNDATIONAL / FROZEN           | Keep evidence available; Documents is linked from Career Brain and Settings.                                                    |
| Journal                                                           | ACTIVE, secondary               | Capture useful feedback and evidence when needed; linked from Career Brain, not a required daily ritual.                        |
| Scheduled job search                                              | ACTIVE                          | The priority recurring workflow; existing search profiles and run results are preserved.                                        |
| Other automation infrastructure, retries and history              | ADVANCED/HIDDEN / FROZEN        | Accessible from Settings/Admin; existing schedules are not silently disabled.                                                   |
| AI providers, agents and capability routing                       | ADVANCED/HIDDEN / FROZEN        | Configure, verify and leave alone unless broken.                                                                                |
| Job source configuration                                          | ADVANCED/HIDDEN / FROZEN        | Maintain existing sources; add one only when opportunity supply demonstrably fails.                                             |
| Analytics                                                         | ADVANCED/HIDDEN / FROZEN        | Inspect engagement and real outcomes from Settings/Admin; AI insights are on demand.                                            |
| Logs, diagnostics, exports and portability                        | ADVANCED/HIDDEN / FROZEN        | Troubleshoot actual failures without occupying everyday navigation.                                                             |
| Unused optional workflows                                         | DORMANT                         | Leave available without promoting or expanding them. No capability or stored data is removed.                                   |

## Public journey

Previous: Hero → About → Engineering processes → Experience → Credentials/skills → Projects and full Portfolio as Proof → Ask Basil → Blog → Contact.

V1: Hero → Selected impact → Experience → Selected projects → Technical capabilities → About / expandable engineering approach → Ask Basil → Writing when published → Contact.

Impact uses approved achievements, explicit outcome fields, or exact numeric signals with their source sentences from published experience, at most six. Empty evidence sections are omitted rather than filled with invented claims. The public hero is text-led and uses one professional headline. Existing professional links and contact remain available. No private CV is linked publicly without an intentionally public URL.

Projects retain their demos, media, notes, technologies and links. Business context, architecture, decisions, implementation and production considerations appear when present in approved structured project content; there is no schema rewrite or fabricated project narrative.

## Private navigation

Previous: Career Brain, Jobs, Freelance, Application Kit, Interview Kit, Journals, Blog, Settings, Portfolio; dashboard available through the brand link.

V1: Today, Jobs, Applications, Interviews, Freelance, Career Brain, Portfolio, Writing, Settings/Admin.

Documents and Journal are secondary Career Brain links. CV/letter libraries and reusable profiles stay in Applications. All existing settings pages remain reachable; diagnostics, reporting and infrastructure configuration are grouped under collapsed Advanced administration.

## Today versus Career Brain

Today answers “What can I move forward?” It shows interview preparation/outcome recording, application drafts and ready packages, follow-up review prompts, strong recorded job matches, recommended freelance opportunities, proposal reviews/client responses, pending evidence and staged portfolio versions.

- Employment matches need a latest recorded career match of at least 70%; unscored jobs are not called high fit. This is an existing score, not a new inference or guarantee.
- Freelance actions use the latest existing APPLY/APPLY_NOW recommendation and keep proposals separate.
- Submission follow-ups require a recorded submission date at least seven days old. Interview follow-ups are recorded notes, not invented deadlines. No new reminder/completion-tracking system is added.
- Interview stages are read through owner-scoped interview processes; the stage table itself has no owner column.
- Each group shows at most five actions and a total for the loaded recent records. Full history remains in each workspace. Failed loads are explicitly reported.

Career Brain answers “What evidence do I have, and what is approved?” Its synthesis, evidence, publication selections and control panel stay intact. Today does not duplicate its knowledge inventory.

## Freeze and exception gate

Begin the 60–90 day observation period after this version is put into use. Do not add speculative platform features during that period. A code merge is not evidence of deployment or real-world use.

Changes allowed:

| Priority | Allowed reason                                          | Required evidence                                                 |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| P0       | Security or privacy                                     | Reproduction or a credible risk to owner/private data.            |
| P1       | Broken Jobs, Applications, Interviews or Freelance flow | The blocked workflow and expected result.                         |
| P2       | Incorrect evidence or AI output                         | Source, actual output and expected grounded result.               |
| P3       | Repeated friction during actual use                     | Repeated instances, time lost and the smallest corrective change. |

Everything else goes to backlog. Record the date, workflow, observation, outcome, time lost, priority and source/example in the existing journal or issue process. Do not build a new feedback platform.

Measure actual results:

- Public: visits → experience/project engagement → professional-link/CV engagement where available → Ask Basil → contact → recruiter/client conversations.
- Career: relevant jobs → shortlisted → prepared applications → manual submissions → responses → interviews → final stages → offers. Observe the time needed to prepare a high-quality application.
- Freelance: reviewed opportunities → prepared proposals → manual submissions → views/responses → interviews → wins and revenue.

Keep current analytics; record currently uninstrumented outcomes manually. Do not create another dashboard or tracking infrastructure simply to complete this measurement list.

## Explicit non-changes

Authentication, owner authorization, RLS, public publication filtering, database/schema, vector storage, document pipeline, agents/providers, source adapters, durable workflows, application/proposal generation and manual submission safeguards are unchanged. No working route is deleted. No automation is enabled or disabled remotely. No production data, owner settings, external applications or publications are mutated by this simplification.

No automatic applications or Upwork submissions, additional agents, speculative ATS integrations, Personal OS expansion, new orchestration/vector layer, RAG redesign without retrieval evidence, publication redesign or CMS expansion during the freeze.
