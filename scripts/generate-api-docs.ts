/**
 * Generates docs/api-reference.md and updates CLAUDE.md with API documentation
 * derived from Zod schemas. Run with: npm run docs:api
 */
import * as fs from "fs";
import * as path from "path";

import { CreateContactInput, UpdateContactInput, ImportContactsInput } from "../src/lib/schemas/contacts.js";
import { CreateTagInput, UpdateTagInput, ContactTagInput } from "../src/lib/schemas/tags.js";
import { CreateFieldInput, UpdateFieldInput } from "../src/lib/schemas/fields.js";
import { CreateInteractionInput } from "../src/lib/schemas/interactions.js";
import { CreateSegmentInput, UpdateSegmentInput, SegmentPreviewInput, SegmentFilter } from "../src/lib/schemas/segments.js";
import { CreateCampaignInput, UpdateCampaignInput, CampaignPreviewInput } from "../src/lib/schemas/campaigns.js";
import { CreateScriptInput, UpdateScriptInput } from "../src/lib/schemas/scripts.js";
import { CreateAutomationInput, UpdateAutomationInput } from "../src/lib/schemas/automations.js";
import { CreateApiKeyInput } from "../src/lib/schemas/api-keys.js";
import { UpdateUserInput } from "../src/lib/schemas/users.js";
import { CreateTicketInput, UpdateTicketInput, CreateTicketReplyInput } from "../src/lib/schemas/support-tickets.js";

// --- Endpoint definitions ---

type Endpoint = {
  method: string;
  path: string;
  auth: "none" | "session" | "admin";
  description: string;
  requestSchema?: { name: string; schema: unknown };
  responseDescription: string;
  errors?: string[];
};

const endpoints: Endpoint[] = [
  // Health
  {
    method: "GET",
    path: "/api/health",
    auth: "none",
    description: "Liveness/readiness probe (no DB access)",
    responseDescription: "{ status: 'ok', sha: string }",
    errors: [],
  },
  // Contacts
  {
    method: "GET",
    path: "/api/contacts",
    auth: "none",
    description: "List contacts with search, pagination, and sorting",
    responseDescription: "{ contacts: Contact[], total: number, page: number, pageSize: number }",
    errors: [],
  },
  {
    method: "POST",
    path: "/api/contacts",
    auth: "none",
    description: "Create a new contact",
    requestSchema: { name: "CreateContactInput", schema: CreateContactInput },
    responseDescription: "Contact (201)",
    errors: ["400 validation", "409 duplicate email"],
  },
  {
    method: "GET",
    path: "/api/contacts/:id",
    auth: "none",
    description: "Get a single contact by ID",
    responseDescription: "Contact",
    errors: ["404 not found"],
  },
  {
    method: "PUT",
    path: "/api/contacts/:id",
    auth: "none",
    description: "Update a contact (partial update)",
    requestSchema: { name: "UpdateContactInput", schema: UpdateContactInput },
    responseDescription: "Contact",
    errors: ["400 validation", "404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/contacts/:id",
    auth: "none",
    description: "Delete a contact",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },
  {
    method: "POST",
    path: "/api/contacts/import",
    auth: "none",
    description: "Bulk import contacts from CSV data",
    requestSchema: { name: "ImportContactsInput", schema: ImportContactsInput },
    responseDescription: "{ total, created, updated, skipped, errors: [{row, error}] }",
    errors: ["400 validation"],
  },

  // Contact interactions
  {
    method: "GET",
    path: "/api/contacts/:id/interactions",
    auth: "none",
    description: "List interactions for a contact (paginated)",
    responseDescription: "{ interactions: Interaction[], total, page, pageSize }",
    errors: ["404 contact not found"],
  },
  {
    method: "POST",
    path: "/api/contacts/:id/interactions",
    auth: "none",
    description: "Create an interaction for a contact",
    requestSchema: { name: "CreateInteractionInput", schema: CreateInteractionInput },
    responseDescription: "Interaction (201)",
    errors: ["400 validation", "404 contact not found"],
  },

  // Contact tags
  {
    method: "GET",
    path: "/api/contacts/:id/tags",
    auth: "none",
    description: "List tags for a contact",
    responseDescription: "Tag[]",
    errors: ["404 contact not found"],
  },
  {
    method: "POST",
    path: "/api/contacts/:id/tags",
    auth: "none",
    description: "Add a tag to a contact",
    requestSchema: { name: "ContactTagInput", schema: ContactTagInput },
    responseDescription: "Tag[] (updated list)",
    errors: ["400 validation", "404 contact not found"],
  },
  {
    method: "DELETE",
    path: "/api/contacts/:id/tags",
    auth: "none",
    description: "Remove a tag from a contact",
    requestSchema: { name: "ContactTagInput", schema: ContactTagInput },
    responseDescription: "Tag[] (updated list)",
    errors: ["400 validation"],
  },

  // Batch contact tags
  {
    method: "GET",
    path: "/api/contacts/tags?ids=uuid1,uuid2",
    auth: "none",
    description: "Get tags for multiple contacts (batch)",
    responseDescription: "Record<contactId, Tag[]>",
  },

  // Interactions
  {
    method: "DELETE",
    path: "/api/interactions/:id",
    auth: "none",
    description: "Delete an interaction",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },

  // Tags
  {
    method: "GET",
    path: "/api/tags",
    auth: "none",
    description: "List all tags",
    responseDescription: "Tag[]",
  },
  {
    method: "POST",
    path: "/api/tags",
    auth: "none",
    description: "Create a tag",
    requestSchema: { name: "CreateTagInput", schema: CreateTagInput },
    responseDescription: "Tag (201)",
    errors: ["400 validation", "409 duplicate name"],
  },
  {
    method: "PUT",
    path: "/api/tags/:id",
    auth: "none",
    description: "Update a tag",
    requestSchema: { name: "UpdateTagInput", schema: UpdateTagInput },
    responseDescription: "Tag",
    errors: ["404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/tags/:id",
    auth: "none",
    description: "Delete a tag",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },

  // Fields
  {
    method: "GET",
    path: "/api/fields",
    auth: "none",
    description: "List all custom field definitions",
    responseDescription: "FieldDefinition[]",
  },
  {
    method: "POST",
    path: "/api/fields",
    auth: "none",
    description: "Create a custom field definition",
    requestSchema: { name: "CreateFieldInput", schema: CreateFieldInput },
    responseDescription: "FieldDefinition (201)",
    errors: ["400 validation", "409 duplicate name"],
  },
  {
    method: "PUT",
    path: "/api/fields/:id",
    auth: "none",
    description: "Update a field definition",
    requestSchema: { name: "UpdateFieldInput", schema: UpdateFieldInput },
    responseDescription: "FieldDefinition",
    errors: ["404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/fields/:id",
    auth: "none",
    description: "Delete a field definition",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },

  // Segments
  {
    method: "GET",
    path: "/api/segments",
    auth: "session",
    description: "List all segments",
    responseDescription: "Segment[]",
  },
  {
    method: "POST",
    path: "/api/segments",
    auth: "admin",
    description: "Create a segment",
    requestSchema: { name: "CreateSegmentInput", schema: CreateSegmentInput },
    responseDescription: "Segment (201)",
    errors: ["400 validation"],
  },
  {
    method: "GET",
    path: "/api/segments/:id",
    auth: "session",
    description: "Get a single segment",
    responseDescription: "Segment",
    errors: ["404 not found"],
  },
  {
    method: "PUT",
    path: "/api/segments/:id",
    auth: "admin",
    description: "Update a segment",
    requestSchema: { name: "UpdateSegmentInput", schema: UpdateSegmentInput },
    responseDescription: "Segment",
    errors: ["404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/segments/:id",
    auth: "admin",
    description: "Delete a segment",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },
  {
    method: "POST",
    path: "/api/segments/preview",
    auth: "session",
    description: "Preview contacts matching a segment filter",
    requestSchema: { name: "SegmentPreviewInput", schema: SegmentPreviewInput },
    responseDescription: "{ contacts: Contact[], total: number }",
    errors: ["400 validation"],
  },

  // Campaigns
  {
    method: "GET",
    path: "/api/campaigns",
    auth: "session",
    description: "List all campaigns",
    responseDescription: "Campaign[]",
  },
  {
    method: "POST",
    path: "/api/campaigns",
    auth: "admin",
    description: "Create a campaign",
    requestSchema: { name: "CreateCampaignInput", schema: CreateCampaignInput },
    responseDescription: "Campaign (201)",
    errors: ["400 validation"],
  },
  {
    method: "GET",
    path: "/api/campaigns/:id",
    auth: "session",
    description: "Get a single campaign",
    responseDescription: "Campaign",
    errors: ["404 not found"],
  },
  {
    method: "PUT",
    path: "/api/campaigns/:id",
    auth: "admin",
    description: "Update a campaign",
    requestSchema: { name: "UpdateCampaignInput", schema: UpdateCampaignInput },
    responseDescription: "Campaign",
    errors: ["404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/campaigns/:id",
    auth: "admin",
    description: "Delete a campaign",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },
  {
    method: "POST",
    path: "/api/campaigns/:id/send",
    auth: "admin",
    description: "Queue a draft campaign for sending",
    responseDescription: '{ queued: true, message: "Campaign queued for sending." }',
    errors: ["400 already sent", "404 not found"],
  },
  {
    method: "POST",
    path: "/api/campaigns/:id/preview",
    auth: "admin",
    description: "Send a preview email for a campaign",
    requestSchema: { name: "CampaignPreviewInput", schema: CampaignPreviewInput },
    responseDescription: "{ success: true }",
    errors: ["400 validation/send error"],
  },
  {
    method: "GET",
    path: "/api/campaigns/:id/emails",
    auth: "session",
    description: "List email records for a campaign",
    responseDescription: "Email[]",
  },

  // Scripts
  {
    method: "GET",
    path: "/api/scripts",
    auth: "admin",
    description: "List all scripts",
    responseDescription: "Script[]",
  },
  {
    method: "POST",
    path: "/api/scripts",
    auth: "admin",
    description: "Create a script",
    requestSchema: { name: "CreateScriptInput", schema: CreateScriptInput },
    responseDescription: "Script (201)",
    errors: ["400 validation"],
  },
  {
    method: "GET",
    path: "/api/scripts/:id",
    auth: "admin",
    description: "Get a single script",
    responseDescription: "Script",
    errors: ["404 not found"],
  },
  {
    method: "PUT",
    path: "/api/scripts/:id",
    auth: "admin",
    description: "Update a script",
    requestSchema: { name: "UpdateScriptInput", schema: UpdateScriptInput },
    responseDescription: "Script",
    errors: ["404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/scripts/:id",
    auth: "admin",
    description: "Delete a script",
    responseDescription: "{ ok: true }",
    errors: ["404 not found"],
  },
  {
    method: "POST",
    path: "/api/scripts/:id/run",
    auth: "admin",
    description: "Execute a script manually",
    responseDescription: "ScriptRun",
  },
  {
    method: "GET",
    path: "/api/scripts/:id/runs",
    auth: "admin",
    description: "Get run history for a script",
    responseDescription: "ScriptRun[]",
  },

  // Automations
  {
    method: "GET",
    path: "/api/automations",
    auth: "admin",
    description: "List all automation rules",
    responseDescription: "AutomationRule[]",
  },
  {
    method: "POST",
    path: "/api/automations",
    auth: "admin",
    description: "Create an automation rule",
    requestSchema: { name: "CreateAutomationInput", schema: CreateAutomationInput },
    responseDescription: "AutomationRule (201)",
    errors: ["400 validation"],
  },
  {
    method: "GET",
    path: "/api/automations/:id",
    auth: "admin",
    description: "Get a single automation rule",
    responseDescription: "AutomationRule",
    errors: ["404 not found"],
  },
  {
    method: "PUT",
    path: "/api/automations/:id",
    auth: "admin",
    description: "Update an automation rule",
    requestSchema: { name: "UpdateAutomationInput", schema: UpdateAutomationInput },
    responseDescription: "AutomationRule",
    errors: ["404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/automations/:id",
    auth: "admin",
    description: "Delete an automation rule",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },
  {
    method: "POST",
    path: "/api/automations/:id/run",
    auth: "admin",
    description: "Execute an automation rule now",
    responseDescription: "{ affected: number }",
    errors: ["404 not found"],
  },

  // Users
  {
    method: "GET",
    path: "/api/users",
    auth: "admin",
    description: "List all users",
    responseDescription: "{ id, name, email, image, isAdmin }[]",
  },
  {
    method: "PUT",
    path: "/api/users/:id",
    auth: "admin",
    description: "Update user role",
    requestSchema: { name: "UpdateUserInput", schema: UpdateUserInput },
    responseDescription: "{ id, name, email, isAdmin }",
    errors: ["400 validation", "404 not found"],
  },

  // API Keys
  {
    method: "GET",
    path: "/api/api-keys",
    auth: "admin",
    description: "List all API keys (hashes hidden)",
    responseDescription: "{ id, name, keyPrefix, userId, isActive, lastUsedAt, createdAt }[]",
  },
  {
    method: "POST",
    path: "/api/api-keys",
    auth: "admin",
    description: "Create an API key (raw key returned once)",
    requestSchema: { name: "CreateApiKeyInput", schema: CreateApiKeyInput },
    responseDescription: "{ id, name, keyPrefix, rawKey, createdAt } (201)",
    errors: ["400 validation"],
  },
  {
    method: "DELETE",
    path: "/api/api-keys/:id",
    auth: "admin",
    description: "Revoke an API key",
    responseDescription: "{ success: true }",
    errors: ["404 not found"],
  },

  // Support Tickets (cross-workspace open forum)
  {
    method: "GET",
    path: "/api/support-tickets",
    auth: "session",
    description: "List all support tickets with optional filters, sorting by newest or most voted",
    responseDescription: "{ tickets: Ticket[], total, stats: { open, in_progress, resolved, closed } }",
  },
  {
    method: "POST",
    path: "/api/support-tickets",
    auth: "session",
    description: "Create a support ticket (creator is auto-subscribed to notifications)",
    requestSchema: { name: "CreateTicketInput", schema: CreateTicketInput },
    responseDescription: "Ticket (201)",
    errors: ["400 validation"],
  },
  {
    method: "GET",
    path: "/api/support-tickets/:id",
    auth: "session",
    description: "Get a ticket with replies, vote status, and subscription status",
    responseDescription: "{ ticket: Ticket & { hasVoted }, replies: Reply[], isSubscribed }",
    errors: ["404 not found"],
  },
  {
    method: "PUT",
    path: "/api/support-tickets/:id",
    auth: "session",
    description: "Update a ticket (admin: status/priority/type; owner: title/desc on open tickets)",
    requestSchema: { name: "UpdateTicketInput", schema: UpdateTicketInput },
    responseDescription: "Ticket",
    errors: ["400 validation", "403 not authorized", "404 not found"],
  },
  {
    method: "DELETE",
    path: "/api/support-tickets/:id",
    auth: "admin",
    description: "Delete a ticket and all its replies (admin only)",
    responseDescription: "{ success: true }",
    errors: ["403 not admin", "404 not found"],
  },
  {
    method: "GET",
    path: "/api/support-tickets/:id/replies",
    auth: "session",
    description: "List replies for a ticket",
    responseDescription: "Reply[]",
    errors: ["404 not found"],
  },
  {
    method: "POST",
    path: "/api/support-tickets/:id/replies",
    auth: "session",
    description: "Post a reply to a ticket (replier is auto-subscribed to notifications)",
    requestSchema: { name: "CreateTicketReplyInput", schema: CreateTicketReplyInput },
    responseDescription: "Reply (201)",
    errors: ["400 validation", "404 not found"],
  },
  {
    method: "POST",
    path: "/api/support-tickets/:id/vote",
    auth: "session",
    description: "Toggle upvote on a ticket (one vote per user)",
    responseDescription: "{ upvoted: boolean, upvoteCount: number }",
  },
  {
    method: "POST",
    path: "/api/support-tickets/:id/subscribe",
    auth: "session",
    description: "Subscribe to email notifications for a ticket",
    responseDescription: "{ subscribed: true }",
  },
  {
    method: "DELETE",
    path: "/api/support-tickets/:id/subscribe",
    auth: "session",
    description: "Unsubscribe from email notifications for a ticket",
    responseDescription: "{ subscribed: false }",
  },
  {
    method: "GET",
    path: "/api/support-tickets/unsubscribe",
    auth: "none",
    description: "One-click unsubscribe from ticket notifications via email link (HMAC token)",
    responseDescription: "HTML confirmation page",
    errors: ["400 missing params", "403 invalid token"],
  },
  {
    method: "GET",
    path: "/api/support-tickets/subscribe-all",
    auth: "session",
    description: "Get current user's global subscription status for all tickets",
    responseDescription: "{ subscribedToAll: boolean }",
  },
  {
    method: "POST",
    path: "/api/support-tickets/subscribe-all",
    auth: "session",
    description: "Toggle global subscription to all ticket notifications",
    responseDescription: "{ subscribedToAll: boolean }",
  },
  {
    method: "GET",
    path: "/api/support-tickets/stats",
    auth: "session",
    description: "Get ticket counts by status (global, cross-workspace)",
    responseDescription: "{ open: number, in_progress: number, resolved: number, closed: number }",
  },

  // Webhooks
  {
    method: "POST",
    path: "/api/webhooks/mailersend",
    auth: "none",
    description: "Receive MailerSend delivery events (sent, delivered, bounced, opened, clicked)",
    responseDescription: "{ ok: true }",
  },
  {
    method: "POST",
    path: "/api/webhooks/tally",
    auth: "none",
    description: "Receive Tally form submissions, creates/updates contacts and logs interactions",
    responseDescription: '{ status: "created"|"updated", contactId }',
    errors: ["400 invalid JSON / no email"],
  },
];

// --- Zod 4 schema introspection ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeZodType(schema: any, indent = 0): string {
  const type = schema?.type || schema?.def?.type;
  const pad = "  ".repeat(indent);

  switch (type) {
    case "string": {
      const fmt = schema.format || schema.def?.format;
      if (fmt === "email") return "string (email)";
      if (fmt === "datetime") return "string (datetime)";
      if (fmt === "uuid") return "string (uuid)";
      return "string";
    }
    case "number":
    case "int":
      return "number";
    case "boolean":
      return "boolean";
    case "literal":
      return JSON.stringify(schema.def?.value ?? schema.value);
    case "enum": {
      // Zod 4: options is an array
      const opts = schema.options || Object.values(schema.def?.entries || {});
      return opts.map((v: string) => `"${v}"`).join(" | ");
    }
    case "optional":
      return describeZodType(schema.def?.innerType || schema.unwrap?.(), indent) + "?";
    case "nullable":
      return describeZodType(schema.def?.innerType || schema.unwrap?.(), indent) + " | null";
    case "default":
      return describeZodType(schema.def?.innerType || schema.unwrap?.(), indent);
    case "transform":
    case "pipe":
      return describeZodType(schema.def?.in || schema.def?.innerType, indent);
    case "array":
      return describeZodType(schema.def?.element || schema.element, indent) + "[]";
    case "record": {
      // Zod 4: value schema is in def.keyType (confusingly)
      const valType = schema.def?.keyType;
      return `Record<string, ${describeZodType(valType, indent)}>`;
    }
    case "unknown":
      return "unknown";
    case "union":
    case "discriminatedUnion": {
      const options = schema.def?.options || schema.options || [];
      return options.map((o: unknown) => describeZodType(o, indent)).join(" | ");
    }
    case "object": {
      const shape = schema.shape || schema.def?.shape;
      if (!shape) return "object";
      const fields: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        fields.push(`${pad}  "${key}": ${describeZodType(val, indent + 1)}`);
      }
      return `{\n${fields.join(",\n")}\n${pad}}`;
    }
    default:
      return "unknown";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function schemaToDoc(schema: any): string {
  // Handle .refine() wrappers — look for the inner type
  const type = schema?.type || schema?.def?.type;
  if (type === "custom" || type === "pipe" || !type) {
    const inner = schema.def?.innerType || schema.def?.in || schema._zpiInput;
    if (inner) return describeZodType(inner);
  }
  return describeZodType(schema);
}

function authBadge(auth: string): string {
  switch (auth) {
    case "admin":
      return "**Auth: Admin**";
    case "session":
      return "**Auth: Session**";
    default:
      return "No auth required";
  }
}

function generateApiReference(): string {
  const lines: string[] = [];

  lines.push("# API Reference");
  lines.push("");
  lines.push("> Auto-generated from Zod schemas. Run `npm run docs:api` to regenerate.");
  lines.push("");
  lines.push("## Authentication");
  lines.push("");
  lines.push("Two auth methods are supported:");
  lines.push("- **Session cookie** (browser): Managed by NextAuth with Google OAuth");
  lines.push("- **API key** (machine-to-machine): `Authorization: Bearer pai_<key>`");
  lines.push("");
  lines.push("Auth levels:");
  lines.push("- **No auth**: Public endpoint");
  lines.push("- **Session**: Any authenticated user");
  lines.push("- **Admin**: Requires admin role (returns 403 otherwise)");
  lines.push("");
  lines.push("## Error Format");
  lines.push("");
  lines.push("```json");
  lines.push('{ "error": "message", "details": ["field-level errors (optional)"] }');
  lines.push("```");
  lines.push("");

  // Group endpoints by resource
  const groups = new Map<string, Endpoint[]>();
  for (const ep of endpoints) {
    const resource = ep.path.split("/")[2]; // api/contacts/... -> contacts
    const group = groups.get(resource) || [];
    group.push(ep);
    groups.set(resource, group);
  }

  for (const [resource, eps] of groups) {
    const title = resource.charAt(0).toUpperCase() + resource.slice(1);
    lines.push(`## ${title}`);
    lines.push("");

    for (const ep of eps) {
      lines.push(`### \`${ep.method} ${ep.path}\``);
      lines.push("");
      lines.push(`${ep.description}. ${authBadge(ep.auth)}`);
      lines.push("");

      if (ep.requestSchema) {
        lines.push(`**Request body** (\`${ep.requestSchema.name}\`):`);
        lines.push("```");
        lines.push(schemaToDoc(ep.requestSchema.schema));
        lines.push("```");
        lines.push("");
      }

      lines.push(`**Response:** ${ep.responseDescription}`);
      lines.push("");

      if (ep.errors && ep.errors.length > 0) {
        lines.push("**Errors:** " + ep.errors.map((e) => `\`${e}\``).join(", "));
        lines.push("");
      }
    }
  }

  // Add segment filter docs
  lines.push("## Appendix: Segment Filter Schema");
  lines.push("");
  lines.push("Used in segment creation and preview endpoints:");
  lines.push("```");
  lines.push(schemaToDoc(SegmentFilter));
  lines.push("```");
  lines.push("");
  lines.push("Supported operators: `eq`, `neq`, `contains`, `not_contains`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in`, `has_tag`, `not_has_tag`, `is_empty`, `is_not_empty`, `after`, `before`");
  lines.push("");

  return lines.join("\n");
}

function generateClaudeMd(): string {
  return `# PauseAI Everything App

CRM and operations platform for PauseAI Global. Built with Next.js 16 (App Router), PostgreSQL, Drizzle ORM, Graphile Worker. Supports multi-tenancy via workspaces (Global + chapter workspaces).

## Quick Reference

- **API docs:** See [docs/api-reference.md](docs/api-reference.md) for all endpoints, request/response schemas, and auth requirements
- **DB schemas:** \`src/db/schema/*.ts\` (Drizzle ORM, PostgreSQL)
- **API validation schemas:** \`src/lib/schemas/*.ts\` (Zod — source of truth for request validation)
- **Route handlers:** \`src/app/api/**/route.ts\`
- **Business logic:** \`src/lib/*.ts\`
- **Connectors:** \`src/lib/connectors/\` (Airtable, Notion, Demo)
- **Sync engine:** \`src/lib/sync-engine.ts\`
- **Background workers:** \`src/worker/\` (Graphile Worker)
- **UI components:** \`src/components/\` (React + shadcn/ui)
- **Workspace design:** See [docs/specs/workspaces.md](docs/specs/workspaces.md) for the multi-tenancy specification

## Workspaces (Multi-Tenancy)

The app supports multiple workspaces: one **global** workspace (PauseAI Global) and **chapter** workspaces (e.g., Pause IA France). Key concepts:

- **Workspace context:** Determined by cookie (\`pauseai_workspace\`), header (\`X-Workspace-Id\`), or query param. Server components use \`getServerWorkspaceId()\`, client components use \`useWorkspace()\` / \`useWorkspaceFetch()\`.
- **Contacts:** Exist once globally, linked to workspaces via \`contact_workspaces\` junction table. A workspace only sees its own contacts.
- **Effective role:** \`max(global role, workspace role)\` — computed by \`useEffectiveRole()\` (client) or \`getEffectiveRole()\` (server). A user with global "member" role but workspace "admin" role is an admin in that workspace.
- **Workspace-scoped entities:** Tags, segments, campaigns, communication categories, connections, custom fields (scope: core/global_internal/workspace), user memberships, automations (scripts + rules).
- **Workspace provider:** \`src/components/workspace-provider.tsx\` — provides \`activeWorkspace\`, \`useWorkspaceId()\`, \`useWorkspaceFetch()\` (auto-injects \`X-Workspace-Id\` header).
- **Server-side workspace:** \`src/lib/workspace-server.ts\` — \`getServerWorkspaceId()\` reads from cookies, \`isServerWorkspaceGlobal()\`.
- **API workspace context:** \`src/lib/workspace-context.ts\` — \`getActiveWorkspaceId(request)\` reads from header/query/cookie.

## Auth

- Google OAuth via NextAuth (\`src/lib/auth.ts\`)
- Dev login with Credentials provider (development only) — preset users + custom email form with workspace selector
- API keys: \`Authorization: Bearer pai_<key>\` (\`src/lib/api-auth.ts\`)
- Admin role from \`ADMIN_EMAILS\` env var
- Two-layer roles: global role (users table) + workspace role (user_workspaces table)

## Key Commands

- \`npm run dev\` — dev server with Turbopack
- \`npm run test\` — run tests (Vitest)
- \`npm run build\` — production build
- \`npm run worker\` — background job worker
- \`npm run db:migrate\` — run migrations
- \`npm run db:seed\` — seed default field definitions
- \`npm run docs:api\` — regenerate API docs from Zod schemas

## Conventions

- All API validation uses Zod schemas in \`src/lib/schemas/\`
- Error format: \`{ error: string, details?: string[] }\`
- Route handlers use \`validateBody()\` from \`src/lib/api-validate.ts\`
- Tests required for all backend features (\`src/lib/__tests__/\`)
- Client-side API calls MUST use \`useWorkspaceFetch()\` to include workspace context header
- Communication preference keys are namespaced: \`workspaceId:categoryName\`
- Segment tag conditions use operator \`has\`/\`not_has\` (not \`eq\`)
- Workspace switching triggers \`window.location.reload()\` — don't use refs to detect changes; check entity workspace ownership after fetch instead
- Connections UI lives at \`/dashboard/connections\` (top-level sidebar, admin-only), not under Settings
- When using \`stripNulls()\` in API routes, extract nullable fields that carry meaning (like \`segmentId\`, \`categoryId\`) before stripping
`;
}

// --- Main ---
const rootDir = path.resolve(import.meta.dirname, "..");
const apiRefPath = path.join(rootDir, "docs", "api-reference.md");
const claudeMdPath = path.join(rootDir, "CLAUDE.md");

fs.writeFileSync(apiRefPath, generateApiReference());
console.log(`Written: ${apiRefPath}`);

fs.writeFileSync(claudeMdPath, generateClaudeMd());
console.log(`Written: ${claudeMdPath}`);
