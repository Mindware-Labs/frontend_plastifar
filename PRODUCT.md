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

Internal operations panel for Plastifar, S. A. It centralizes the requests, complaints and queries that reach the company; routes them into department queues; measures elapsed time against committed SLAs; and formalizes two quality processes that are currently handled on paper or spreadsheets (corrective action sheets and credit requests).

Success means the operation stops tracking work in email and spreadsheets, and that response commitments become measurable.

## Operating Context

- Work is organized by **department** (Calidad, Almacén, Soporte, Administración). Department access is what determines who sees which records.
- A collaborator has one primary department plus additional department accesses, each carrying a distinct role. A permission grants an action only over the resources of the departments where that person holds the role granting it.
- The team building the system is two people; each owns whole modules end to end (data model, endpoints, screens). Uniformity across modules is a product requirement: the end user must not perceive where one module ends and another begins.

## Capabilities and Constraints

**Shipped:** authentication (login, logout with server-side revocation, silent refresh), password recovery by emailed 6-digit code, in-session password change, staff management, and role management. This module is the reference implementation for everything that follows.

**Pending:** effective permissions, catalogs and configuration, clients, ticket inbox, quality (corrective action sheets and credit requests), and reports.

**Constraints that future work must preserve:**

- Backend .NET 10 / ASP.NET Core with EF Core and PostgreSQL; frontend React 19, Vite, TypeScript, React Router 7, react-hook-form + Zod, Tailwind CSS 4, Lucide icons. Transactional email through Resend.
- All list endpoints paginate in the database and return `{ items, page, pageSize, total, totalPages, counts }`. Filtering, search and ordering happen in SQL, never in memory. Page size is capped between 1 and 100.
- Dates are stored and transported in UTC; conversion to local time happens only at display.
- Soft delete by default. Records with history are deactivated, not removed; a physical delete is refused with 409 and an explanation.
- Every relevant write is recorded in the audit log.
- Server-side validation mirrors every client-side rule.
- Entities are named in English in code and routes; all user-facing text, including API error messages, is in Spanish.
- Enumerations are stored as readable text, never as numbers.
- No secrets in the repository or in `appsettings.json`; the application fails to start when they are missing.

**Permission model:** the catalog uses a `module.action` convention and is expected to stay at roughly 15-20 permissions once every module contributes its own. An administrator's effective permissions are all of them; everyone else's are the union of the permissions of the roles assigned in their department accesses. The exception is `tickets.read_all`, which widens reading across all departments without granting writes. The system must prevent the installation from being left without an active administrator.

## Brand Commitments

Brandbook Plastifar 2026 is binding: red 185 C, green 348 C, grey 11 C; Montserrat for headings, Poppins for body text. The 2 px control radius is the industrial stroke of the logotype.

## Evidence on Hand

- `Plan-de-construccion-Plastifar.pdf` at the project root — the team's construction plan, v1.0, dated 2 September 2026. It carries the data model, business rules, endpoints and acceptance criteria for every pending module.
- The shipped authentication and staff module in `src/` is the live reference for structure, behavior and visual language.

No customer data, benchmarks or usage metrics are on hand; future work must not fabricate them.

## Product Principles

1. **The operation reads the errors, not the developer.** Every message is written for a person doing their job, and appears on the field that caused it.
2. **Department access is the boundary of everything.** Visibility and permission are always scoped by department; a global view is a deliberate exception that must be granted.
3. **Nothing with history is destroyed.** Deactivation is the default; real deletion is reserved for records with no activity.
4. **The seam between API and interface must not show.** The same rule exists on both sides, and the same person writes both.
5. **Uniformity is functional, not decorative.** Existing components are reused as they are; a new variant is a team decision, not an individual one.

## Accessibility & Inclusion

Labels associated to their control; `aria-invalid` and `aria-describedby` on fields in error; visible focus; Escape to close and focus trapped inside dialogs. Native `alert()`, `confirm()` and `prompt()` are forbidden — the project has its own dialog. Layouts must work at 1366 px wide with no horizontal overflow.
