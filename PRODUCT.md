# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal Plastifar staff operating the company's support and quality workflows. They are not technical: the panel is the tool they use for a full working day, so scanability and speed of response matter more than expression.

Distinct roles inside that audience:

- **Agents** handle tickets in the departments they have access to.
- **Supervisors** oversee several departments at once. Multi-department access is the norm, not the exception — a typical collaborator holds access to several departments, each with its own role.
- **Administrators** manage staff, roles, permissions and catalogs.

## Product Purpose

Internal operations panel for Plastifar, S. A. It centralizes the requests, complaints and queries that reach the company; routes them into department queues; measures elapsed time against committed SLAs; and formalizes two quality processes that were previously handled on paper or spreadsheets (corrective action sheets and credit requests).

Success means the operation stops tracking work in email and spreadsheets, and that response commitments become measurable.

## Positioning

Two mechanisms distinguish this panel from a generic ticketing tool, and both are structural rather than cosmetic:

1. **Permission is scoped by department, not by global role.** A person holds one primary department plus additional department accesses, each carrying its own role. A permission grants an action only over the resources of the departments where that person holds the role granting it. A neighboring product with a flat role model cannot express "supervisor in Calidad, agent in Soporte" without inventing a second concept.
2. **The two quality processes are first-class records, not attachments.** Corrective action sheets and credit requests carry their own lifecycle, approval separation and closing gate inside the same system that measures the SLA. Off-the-shelf tools model them as a form stapled to a ticket.

## Operating Context

- Work is organized by **department** (Calidad, Almacén, Soporte, Administración). Department access is what determines who sees which records.
- A collaborator has one primary department plus additional department accesses, each carrying a distinct role.
- The team building the system is two people; each owns whole modules end to end (data model, endpoints, screens).
- **Visual uniformity across modules is no longer a product requirement** (released 12 September 2026). The previous record declared that the end user must not perceive where one module ends and another begins. That constraint was lifted deliberately, and modules may now carry distinct visual languages.

  The cost was stated before the decision and accepted: without a shared system, a panel drifts toward feeling like several products wearing one logo. The requirement is gone; the risk is not. Divergence should remain something someone chose, recorded where the next person can find it, rather than something that accumulated because nobody was watching.

## Capabilities and Constraints

**Shipped** (verified in `src/api/` and `src/pages/` on 12 September 2026): authentication (login, logout with server-side revocation, silent refresh), password recovery by emailed 6-digit code, in-session password change, staff, roles, effective permissions, departments, clients, territories, product lines, ticket inbox and ticket detail, email inbox with canned replies, quality (corrective action sheets and credit requests), reports, and configuration catalogs (topics, SLA, holidays, mailboxes, templates).

**On scaffolding:** the operations dashboard (`src/features/cx-dashboard`) renders entirely from `mockData.ts`. It has no API client and no endpoint behind it. Every figure on that screen is invented, and it must not be read as data or cited as evidence until it is wired.

**Constraints that future work must preserve:**

- Backend .NET 10 / ASP.NET Core with EF Core and PostgreSQL. Frontend React 19, Vite 8, TypeScript, React Router 7, react-hook-form + Zod, Tailwind CSS 4, Radix primitives, Lucide icons, Recharts for charting, BlockNote for rich text, and SignalR for live counters. Transactional email through Resend.
- All list endpoints paginate in the database and return `{ items, page, pageSize, total, totalPages, counts }`. Filtering, search and ordering happen in SQL, never in memory. Page size is capped between 1 and 100.
- Dates are stored and transported in UTC; conversion to local time happens only at display.
- Soft delete by default. Records with history are deactivated, not removed; a physical delete is refused with 409 and an explanation.
- Every relevant write is recorded in the audit log.
- Server-side validation mirrors every client-side rule.
- Entities are named in English in code and routes; all user-facing text, including API error messages, is in Spanish.
- Enumerations are stored as readable text, never as numbers.
- No secrets in the repository or in `appsettings.json`; the application fails to start when they are missing.
- The frontend permission layer (`src/lib/permissions.ts`) is a courtesy, not a barrier: it exists so a person does not discover a refusal after filling a form. Authorization is decided by the backend on every endpoint.

**Permission model:** the catalog uses a `module.action` convention. An administrator's effective permissions are all of them; everyone else's are the union of the permissions of the roles assigned in their department accesses, carried in the `dept_access` token claim. The single exception is `tickets.read_all`, which widens `tickets.read` across all departments without granting any write. The system must prevent the installation from being left without an active administrator.

## Brand Commitments

**Binding:**

- The product is Plastifar, S. A.'s internal panel. Name and logo assets live in `public/brand/`.
- All user-facing text is Spanish, written for a person doing their job rather than for a developer.
- **`public/image.png` (the "Center Quest" contact-centre dashboard) is a binding visual reference for dashboards and reports only.** Future work on those surfaces is expected to honour it. It carries no authority over lists, forms, detail screens or any other part of the panel.

**No longer binding** (released 12 September 2026):

The Brandbook Plastifar 2026 — red 185 C, green 348 C, grey 11 C, Montserrat for headings, Poppins for body, and the 2 px control radius derived from the logotype stroke — was previously recorded here as binding. It is now a historical reference, not a constraint.

Two things are worth flagging for whoever reads this next. First, this is a company brand commitment that was released inside a product decision; if the brand owner has not been told, that conversation has not happened yet. Second, the repository already shows what an unconstrained type system costs: four font families are installed today — Montserrat, Poppins, Plus Jakarta Sans and Geist Variable — and no record says which surface owns which. Releasing the constraint is not the same as having no answer.

## Evidence on Hand

- `Plan-de-construccion-Plastifar.pdf` at the project root — the team's construction plan, v1.0, dated 2 September 2026. It carries the data model, business rules, endpoints and acceptance criteria for every module.
- `public/image.png` — a full-screen capture of the "Center Quest" contact-centre dashboard, supplied by the user as the quality target for this project's dashboards. It is a third-party product's interface, held as a reference, not as an asset to reproduce verbatim.
- `public/brand/` — Plastifar logo, isotype, monochrome logo and favicon.
- The shipped modules in `src/` are the live reference for structure and behavior. They are no longer a single reference for visual language, because that uniformity requirement has been released.

No customer data, benchmarks, usage metrics, pricing or deployment claims are on hand; future work must not fabricate them. The dashboard's current figures are scaffolding and are not evidence.

## Product Principles

1. **The operation reads the errors, not the developer.** Every message is written for a person doing their job, and appears on the field that caused it.
2. **Department access is the boundary of everything.** Visibility and permission are always scoped by department; a global view is a deliberate exception that must be granted.
3. **Nothing with history is destroyed.** Deactivation is the default; real deletion is reserved for records with no activity.
4. **The seam between API and interface must not show.** The same rule exists on both sides, and the same person writes both.
5. **Invented data is labelled as invented.** A screen running on scaffolding says so in its own source, and its numbers never reach a report, a decision or a claim.

## Accessibility & Inclusion

Labels associated to their control; `aria-invalid` and `aria-describedby` on fields in error; visible focus; Escape to close and focus trapped inside dialogs. Native `alert()`, `confirm()` and `prompt()` are forbidden — the project has its own dialog. Layouts must work at 1366 px wide with no horizontal overflow.
