#!/usr/bin/env node

/**
 * Read-only Supabase MCP server for Codex agents.
 *
 * The server deliberately exposes bounded, owner-scoped retrieval operations
 * rather than an arbitrary SQL tool.  It uses the hosted Supabase service-role
 * connection only from the local process and never returns credentials.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const SERVER_VERSION = "1.0.0";
const MAX_LIMIT = 100;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function parseDotenv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadLocalEnv() {
  const loaded = {};
  for (const filename of [".env", ".env.local"]) {
    try {
      Object.assign(loaded, parseDotenv(await fs.readFile(path.join(repoRoot, filename), "utf8")));
    } catch {
      // Environment variables are the primary configuration. Missing dotenv files are expected.
    }
  }
  return loaded;
}

const fileEnv = await loadLocalEnv();
const env = (name) => process.env[name] || fileEnv[name] || "";
const supabaseUrl = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
// An explicit owner is preferred. When it is omitted, the server resolves the
// sole active owner authorization in Supabase; it refuses an ambiguous state.
let ownerId = env("SUPABASE_OWNER_ID");

function configurationError() {
  const missing = [
    ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  return missing.length
    ? `SUPABASE_MCP_NOT_CONFIGURED: set ${missing.join(", ")} for the owner-scoped read-only server`
    : null;
}

function assertUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new Error(`${label}_MUST_BE_UUID`);
  }
}

function clampLimit(value, fallback = 25) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), MAX_LIMIT) : fallback;
}

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function rankByQuery(rows, query, fields) {
  const terms = normalize(query)
    .split(/\s+/u)
    .filter((term) => term.length >= 2);
  if (!terms.length) return rows;
  return rows
    .map((row, index) => {
      const haystack = fields
        .map((field) => row[field])
        .map((value) => (typeof value === "string" ? value : JSON.stringify(value ?? "")))
        .join(" ")
        .toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { row, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.row);
}

function jsonResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function jsonError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: message.slice(0, 500) }] };
}

const protocol = new Server(
  { name: "career-os-supabase", version: SERVER_VERSION },
  {
    capabilities: { tools: {} },
    instructions:
      "Read-only, owner-scoped retrieval from the career portfolio Supabase database. Use search_career_knowledge for evidence lookup, get_career_context for structured private career data, and get_public_portfolio_context for public-safe content. Never request or expose credentials, analytics, application secrets, or arbitrary SQL. Treat returned rows as source material and preserve their visibility and provenance."
  }
);
const toolRegistry = new Map();
// Keep registration declarative while using the low-level server so the
// bridge has no runtime dependency on a particular Zod release.
const server = {
  registerTool(name, config, handler) {
    toolRegistry.set(name, { name, ...config, handler });
  }
};

function withClient(handler) {
  return async (args) => {
    const configError = configurationError();
    if (configError) return jsonError(new Error(configError));
    const client = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: "app" },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    try {
      if (ownerId) {
        assertUuid(ownerId, "SUPABASE_OWNER_ID");
      } else {
        const { data, error } = await client
          .from("owner_authorizations")
          .select("user_id")
          .eq("active", true)
          .limit(2);
        if (error) throw new Error(`SUPABASE_OWNER_RESOLUTION_FAILED:${error.message}`);
        const owners = Array.isArray(data) ? data : [];
        if (owners.length !== 1 || typeof owners[0]?.user_id !== "string") {
          throw new Error("SUPABASE_OWNER_ID_REQUIRED_OR_SINGLE_ACTIVE_OWNER_NOT_FOUND");
        }
        ownerId = owners[0].user_id;
        assertUuid(ownerId, "SUPABASE_OWNER_ID");
      }
      return jsonResult(await handler(client, args));
    } catch (error) {
      return jsonError(error);
    }
  };
}

async function readRows(client, table, select, limit = MAX_LIMIT, order = "updated_at") {
  const query = client
    .from(table)
    .select(select)
    .eq("owner_id", ownerId)
    .order(order, { ascending: false })
    .limit(clampLimit(limit, MAX_LIMIT));
  const { data, error } = await query;
  if (error) throw new Error(`SUPABASE_READ_FAILED:${table}:${error.message}`);
  return Array.isArray(data) ? data : [];
}

server.registerTool(
  "search_career_knowledge",
  {
    title: "Search career knowledge",
    description:
      "Search owner-scoped career facts, projects, skills, and evidence chunks using bounded local relevance matching. This is read-only and includes provenance/visibility metadata.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, maxLength: 4000 },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
        includeEvidenceChunks: { type: "boolean" }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  withClient(async (client, args) => {
    const limit = clampLimit(args.limit, 20);
    const [facts, projects, skills] = await Promise.all([
      readRows(
        client,
        "career_facts",
        "id,fact_type,subject_type,subject_id,trust_level,review_status,visibility,verified_by_owner,valid_from,valid_to,updated_at,currentVersion:career_fact_versions!career_facts_current_version_fk(statement,structured_value,source_type,confidence)",
        MAX_LIMIT
      ),
      readRows(
        client,
        "projects",
        "id,project_type,title,slug,organization_id,experience_id,private_description,public_description,contribution_type,start_date,end_date,links,architecture_reference,visibility,updated_at",
        MAX_LIMIT
      ),
      readRows(
        client,
        "skills",
        "id,name,category,aliases,description,visibility,updated_at",
        MAX_LIMIT
      )
    ]);
    const results = [
      ...rankByQuery(facts, args.query, [
        "fact_type",
        "trust_level",
        "review_status",
        "visibility",
        "currentVersion"
      ]),
      ...rankByQuery(projects, args.query, [
        "title",
        "private_description",
        "public_description",
        "project_type"
      ]),
      ...rankByQuery(skills, args.query, ["name", "category", "description"])
    ].slice(0, limit);

    if (args.includeEvidenceChunks) {
      const sources = await readRows(
        client,
        "evidence_sources",
        "id,source_type,title,canonical_uri,issuer,author,visibility,trust_level,verification_state,availability,created_at",
        MAX_LIMIT,
        "created_at"
      );
      const sourceIds = new Set(sources.map((source) => source.id));
      if (sourceIds.size) {
        const { data: versions, error: versionsError } = await client
          .from("evidence_versions")
          .select(
            "id,evidence_source_id,ordinal,media_type,parser_name,parser_version,processed_at"
          )
          .in("evidence_source_id", [...sourceIds])
          .order("ordinal", { ascending: false })
          .limit(MAX_LIMIT);
        if (versionsError)
          throw new Error(`SUPABASE_READ_FAILED:evidence_versions:${versionsError.message}`);
        const versionIds = (versions ?? []).map((version) => version.id);
        if (versionIds.length) {
          const { data: chunks, error: chunksError } = await client
            .from("evidence_chunks")
            .select(
              "id,evidence_version_id,ordinal,page_start,page_end,section_path,content,visibility,trust_level"
            )
            .in("evidence_version_id", versionIds)
            .is("deleted_at", null)
            .order("ordinal", { ascending: true })
            .limit(MAX_LIMIT);
          if (chunksError)
            throw new Error(`SUPABASE_READ_FAILED:evidence_chunks:${chunksError.message}`);
          const sourceByVersion = new Map(
            (versions ?? []).map((version) => [version.id, version.evidence_source_id])
          );
          const sourceById = new Map(sources.map((source) => [source.id, source]));
          const matchedChunks = rankByQuery(
            (chunks ?? []).map((chunk) => ({
              ...chunk,
              source: sourceById.get(sourceByVersion.get(chunk.evidence_version_id))
            })),
            args.query,
            ["content", "section_path"]
          ).slice(0, limit);
          results.push(...matchedChunks);
        }
      }
    }
    return { query: args.query, count: results.length, results };
  })
);

server.registerTool(
  "get_career_context",
  {
    title: "Get structured career context",
    description:
      "Retrieve the owner-scoped structured career model: experiences, organizations, projects, skills, achievements, education, certifications, and the latest career snapshot.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 1, maxLength: 4000 },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  withClient(async (client, args) => {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const limit = clampLimit(args.limit, 50);
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id,display_name,headline,bio,location,timezone,locale,links,created_at,updated_at")
      .eq("id", ownerId)
      .maybeSingle();
    if (profileError) throw new Error(`SUPABASE_READ_FAILED:profiles:${profileError.message}`);
    const [
      experiences,
      organizations,
      projects,
      skills,
      achievements,
      metrics,
      education,
      certifications,
      decisions,
      leadership,
      snapshots
    ] = await Promise.all([
      readRows(
        client,
        "career_experiences",
        "id,organization_id,role_title,career_stage,employment_type,start_date,end_date,is_current,private_summary,approved_public_summary,display_order,visibility,created_at,updated_at",
        limit
      ),
      readRows(
        client,
        "organizations",
        "id,canonical_name,public_name,industry,location,website,visibility,created_at,updated_at",
        limit
      ),
      readRows(
        client,
        "projects",
        "id,project_type,title,slug,organization_id,experience_id,source_availability,private_description,public_description,contribution_type,start_date,end_date,links,architecture_reference,visibility,created_at,updated_at",
        limit
      ),
      readRows(
        client,
        "skills",
        "id,name,category,aliases,description,visibility,created_at,updated_at",
        limit
      ),
      readRows(
        client,
        "achievements",
        "id,experience_id,project_id,statement,action,outcome,business_context,contribution_type,visibility,created_at,updated_at",
        limit
      ),
      readRows(
        client,
        "career_metrics",
        "id,achievement_id,project_id,value,unit,direction,baseline,timeframe,context,attribution,display_text,visibility",
        limit,
        "id"
      ),
      readRows(
        client,
        "education_records",
        "id,institution,qualification,subject,start_date,end_date,status,visibility",
        limit,
        "id"
      ),
      readRows(
        client,
        "certifications",
        "id,issuer,name,issued_date,expiry_date,credential_identifier,credential_url,visibility",
        limit,
        "id"
      ),
      readRows(
        client,
        "architecture_decisions",
        "id,experience_id,project_id,title,context,decision,alternatives,outcome,sanitized_public_summary,visibility",
        limit,
        "id"
      ),
      readRows(
        client,
        "leadership_examples",
        "id,experience_id,project_id,situation,owner_contribution,team_context,outcome,visibility",
        limit,
        "id"
      ),
      readRows(
        client,
        "career_brain_snapshots",
        "id,source_hash,input_source_hash,content,focus_jobs,provider,model,model_version,input_hash,output_hash,generated_at",
        limit,
        "generated_at"
      )
    ]);
    return {
      ownerId,
      profile: profile ?? null,
      experiences,
      organizations,
      projects,
      skills,
      achievements,
      metrics,
      education,
      certifications,
      architectureDecisions: decisions,
      leadershipExamples: leadership,
      latestSnapshot: snapshots[0] ?? null
    };
  })
);

server.registerTool(
  "get_public_portfolio_context",
  {
    title: "Get public portfolio context",
    description:
      "Retrieve the latest published portfolio items and published blog posts for public-safe responses. Private rows are not returned.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT } }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  withClient(async (client, args) => {
    const limit = clampLimit(args.limit, 12);
    const publishedClient = client.schema("published");
    const [{ data: publications, error: publicationError }, { data: blogPosts, error: blogError }] =
      await Promise.all([
        publishedClient
          .from("portfolio_publications")
          .select("id,version,status,content_hash,schema_version,reviewed_at,created_at")
          .eq("owner_id", ownerId)
          .eq("status", "published")
          .order("version", { ascending: false })
          .limit(1),
        publishedClient
          .from("blog_posts")
          .select(
            "id,slug,title,excerpt,markdown,cover_url,tags,seo_title,seo_description,visible_at,evidence_type,supports_employment_claim,source_version_hash,updated_at"
          )
          .is("archived_at", null)
          .lte("visible_at", new Date().toISOString())
          .order("visible_at", { ascending: false })
          .limit(limit)
      ]);
    if (publicationError)
      throw new Error(
        `SUPABASE_READ_FAILED:published.portfolio_publications:${publicationError.message}`
      );
    if (blogError)
      throw new Error(`SUPABASE_READ_FAILED:published.blog_posts:${blogError.message}`);
    const publicationId = publications?.[0]?.id;
    let items = [];
    let evidence = [];
    if (publicationId) {
      const [{ data: itemRows, error: itemError }, { data: evidenceRows, error: evidenceError }] =
        await Promise.all([
          publishedClient
            .from("portfolio_items")
            .select(
              "public_id,source_entity_type,source_entity_id,section,career_stage,display_order,title,public_summary,display_metric,display_technologies,public_citations,structured_content"
            )
            .eq("publication_id", publicationId)
            .order("display_order", { ascending: true })
            .limit(limit),
          publishedClient
            .from("public_evidence")
            .select(
              "public_evidence_id,safe_title,issuer,sanitized_excerpt,source_location_label,evidence_type,source_version_hash"
            )
            .eq("publication_id", publicationId)
            .limit(limit)
        ]);
      if (itemError)
        throw new Error(`SUPABASE_READ_FAILED:published.portfolio_items:${itemError.message}`);
      if (evidenceError)
        throw new Error(`SUPABASE_READ_FAILED:published.public_evidence:${evidenceError.message}`);
      items = itemRows ?? [];
      evidence = evidenceRows ?? [];
    }
    const rankedItems = query
      ? rankByQuery(items, query, [
          "title",
          "public_summary",
          "display_technologies",
          "structured_content",
          "career_stage"
        ])
      : items;
    const rankedEvidence = query
      ? rankByQuery(evidence, query, ["safe_title", "sanitized_excerpt", "evidence_type"])
      : evidence;
    const rankedBlogs = query
      ? rankByQuery(blogPosts ?? [], query, ["title", "excerpt", "markdown", "tags"])
      : (blogPosts ?? []);
    return {
      query,
      publication: publications?.[0] ?? null,
      items: (rankedItems.length ? rankedItems : items).slice(0, limit),
      evidence: (rankedEvidence.length ? rankedEvidence : evidence).slice(0, limit),
      blogPosts: (rankedBlogs.length ? rankedBlogs : (blogPosts ?? [])).slice(0, limit)
    };
  })
);

protocol.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...toolRegistry.values()].map(({ handler: _handler, ...tool }) => tool)
}));

protocol.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const tool = toolRegistry.get(name);
  if (!tool) return jsonError(new Error(`SUPABASE_MCP_TOOL_NOT_FOUND:${name}`));
  try {
    return await tool.handler(request.params.arguments ?? {});
  } catch (error) {
    return jsonError(error);
  }
});

const transport = new StdioServerTransport();
transport.onerror = (error) => console.error("[career-os-supabase-mcp]", error.message);
await protocol.connect(transport);
