# CareerOps Product Documentation

## Overview

CareerOps is a smart job application tracking platform designed to help job seekers manage the full lifecycle of their applications from one organized system. The product combines application tracking, interview management, automated follow-ups, email reminders, and ghosting insights so users can stay informed, act on time, and maintain professional communication with recruiters and hiring teams.

The backend is built as a modular Express.js API with PostgreSQL persistence through Prisma, Redis-backed background jobs through BullMQ, secure authentication, and automated email workflows.

## Product Purpose

Job searching often becomes difficult to manage when applications are spread across job portals, referrals, company career pages, emails, and recruiter conversations. CareerOps addresses this problem by giving users a structured workspace to record every opportunity, track status changes, schedule follow-ups, manage interviews, and identify applications that are likely inactive or ghosted.

The product is intended to reduce manual tracking effort, improve follow-up discipline, and provide a clear operational view of a candidate's job search pipeline.

## Target Users

CareerOps is built for:

- Job seekers actively applying to multiple companies.
- Candidates managing interviews across several roles and organizations.
- Professionals who want timely follow-up reminders and structured application history.
- Users who want visibility into stale applications and potential ghosting patterns.

## Core Capabilities

### User Accounts and Authentication

CareerOps supports secure user onboarding and session management.

- Users can register with email and password.
- Passwords are hashed before storage.
- Email verification is required before local login.
- Verification links expire after 15 minutes.
- Users can log in with Google OAuth.
- Access tokens are issued as JWTs.
- Refresh tokens are generated securely, hashed before storage, rotated on refresh, and revocable on logout.
- Authenticated routes support bearer tokens and HTTP-only cookies.

### Application Tracking

The application module is the core workspace for job search management. Users can create and manage job application records with company, role, location, source, applied date, HR contact name, and HR contact email.

Supported application sources:

- LinkedIn
- Naukri
- Referral
- Career Page
- Other

Supported application statuses:

- Applied
- Shortlisted
- Interviewing
- Offered
- Rejected
- Ghosted

The system prevents duplicate active applications for the same user, company, and role. Applications are soft deleted so historical relationships can remain intact while removing the record from active user views.

### Status Lifecycle Management

CareerOps enforces controlled application status transitions. When an application status changes, the system records the update, stores the latest response timestamp, cancels follow-ups that no longer match the current status, and schedules the next relevant follow-up when applicable.

Status updates are also written to the event log for historical traceability.

### Automated Follow-Ups

CareerOps automatically creates and schedules follow-ups based on application stage.

For newly created applications, the system creates application check follow-ups at:

- 3 days
- 7 days
- 14 days

Additional stage-specific follow-ups are created when an application moves forward:

- Shortlisted check-in after shortlisting.
- Interview feedback follow-up after interview stage.
- Offer follow-up after offer stage.
- General status checks where applicable.

Follow-ups are stored in the database and scheduled through Redis-backed BullMQ queues. Before sending an email, the worker validates that the follow-up is still relevant. For example, a follow-up is cancelled if the application has been rejected, ghosted, deleted, or moved to a status where that follow-up type no longer applies.

### Follow-Up Alerts

Users can retrieve upcoming and due-soon follow-ups. Due-soon alerts are controlled by user settings.

Configurable settings:

- Enable or disable follow-up alerts.
- Set the alert window from 0 to 2 days.

This allows users to surface near-term actions without receiving unnecessary reminders.

### Email Automation

CareerOps uses email automation for two important workflows:

- Account verification emails.
- Professional follow-up emails to recruiter or HR contacts.

Follow-up email content is adapted to the application stage. The system uses different templates for application checks, shortlisted check-ins, interview feedback, offer follow-ups, and general status checks.

Email jobs use retry behavior with exponential backoff so transient failures do not immediately fail the workflow.

### Interview Management

CareerOps includes interview tracking for applications that have reached the interviewing stage.

Users can:

- View all interviews across their applications.
- Create interviews for applications in the interviewing stage.
- Track interview round number and optional round name.
- Record interview type, interviewer, and scheduled date.
- Update interview status, feedback, and schedule.
- Record interview results.

Supported interview types:

- DSA
- Technical
- System Design
- HR
- Managerial
- Behavioral
- Take Home
- Other

Supported interview statuses:

- Scheduled
- Completed
- Cancelled

Supported interview results:

- Passed
- Failed
- Pending

When an interview result is marked as failed, the related application is treated as rejected by the interview workflow. Any follow-ups that are no longer valid are cancelled and removed from the queue when possible.

### Ghosting Detection

CareerOps includes ghost detection to help identify stale applications with low recruiter response activity.

The ghost scoring service evaluates factors such as:

- Days since application date.
- Whether the application has received a response.
- Days since the latest response.
- Current application status.

The confidence score is a number between 0 and 1 that represents how likely an application is to be ghosted. CareerOps calculates it from signals such as time since applying, whether the user has received a response, time since the latest response, and the current application status. A higher score means the application appears more stale, so the system checks it more frequently and may eventually mark it as ghosted.


The score is capped between 0 and 1. Applications with high scores are marked as ghosted when the confidence threshold is reached. Ghost detection jobs also reschedule future checks dynamically:

- High confidence applications are checked more frequently.
- Medium confidence applications are checked periodically.
- Low confidence applications are checked less frequently.

When an application is detected as ghosted, the system updates the application status, stores the ghosted timestamp, updates the ghost detection record, and writes a ghost detection event.

### Analytics and Statistics

CareerOps exposes application statistics for authenticated users. The data model also supports analytics snapshots that can store daily totals for applied jobs, interviews, offers, and ghosted applications.

Current product statistics are designed to help users understand their job search pipeline at a glance.

### Event Logging

The platform records important lifecycle events including:

- Application created.
- Status updated.
- Follow-up sent.
- Interview scheduled.
- Ghost detected.

Event logs provide a foundation for audit history, activity timelines, analytics, and future user-facing insight features.

## API Surface

The backend exposes REST-style endpoints grouped by product domain.

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Register a local user and enqueue email verification. |
| GET | `/auth/verify-email` | Verify a user email address through a tokenized link. |
| POST | `/auth/login` | Authenticate a verified local user. |
| POST | `/auth/refresh` | Rotate refresh token and issue a new access token. |
| POST | `/auth/logout` | Revoke the current refresh token and clear auth cookies. |
| GET | `/auth/me` | Return the current authenticated user from the refresh token. |
| GET | `/auth/google` | Start Google OAuth login. |
| GET | `/auth/google/callback` | Complete Google OAuth login and redirect to the frontend dashboard. |

### Applications

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/applications/create` | Create a job application and schedule initial follow-ups and ghost checks. |
| GET | `/applications` | List active applications for the authenticated user. |
| GET | `/applications/stats` | Return application statistics for the user. |
| GET | `/applications/:id` | Retrieve a single application with related data. |
| PATCH | `/applications/:id/status` | Update application status and schedule stage follow-ups. |
| PATCH | `/applications/update/:id` | Update editable application and company fields. |
| DELETE | `/applications/delete/:id` | Soft delete an application and cancel pending follow-ups. |
| GET | `/applications/:id/ghost` | Retrieve ghost detection data for an application. |

### Follow-Ups

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/followups` | List follow-ups for the authenticated user. |
| GET | `/followups/upcoming` | List the next valid upcoming follow-up per application. |
| GET | `/followups/due-soon` | List follow-ups inside the user's alert window. |
| GET | `/followups/application/:applicationId` | List follow-ups for a specific application. |
| GET | `/applications/upcoming-followups` | Legacy route for upcoming follow-ups. |
| GET | `/applications/:id/followups` | Legacy route for application follow-ups. |
| GET | `/applications/due-soon` | Legacy route for due-soon follow-ups. |

### Interviews

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/interviews` | List all interviews for the authenticated user. |
| POST | `/interviews` | Create an interview for an interviewing application. |
| GET | `/interviews/application/:applicationId` | List interviews for a specific application. |
| PATCH | `/interviews/:id` | Update interview details, status, schedule, or feedback. |
| PATCH | `/interviews/:id/result` | Mark interview result and complete the interview. |

### Settings

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/settings/followup-alerts` | Retrieve follow-up alert settings. |
| PATCH | `/settings/followup-alerts` | Update follow-up alert settings. |

## Data Model

The product is organized around the following main entities:

- `User`: Owns applications, settings, event logs, tokens, and analytics snapshots.
- `Company`: Stores company and HR contact details.
- `JobApplication`: Represents a user's application for a specific role at a company.
- `FollowUp`: Represents scheduled or completed follow-up actions.
- `Interview`: Represents interview rounds and outcomes.
- `GhostDetection`: Stores ghosting confidence and check scheduling data.
- `EventLog`: Stores lifecycle events for history and analytics.
- `AnalyticsSnapshot`: Stores aggregate job search metrics by date.
- `RefreshToken`: Stores hashed refresh tokens with expiry and revocation state.
- `EmailVerificationToken`: Stores email verification tokens with expiry.
- `UserSettings`: Stores user-level follow-up alert preferences.

## Background Job Architecture

CareerOps uses BullMQ and Redis for asynchronous work.

Queues:

- `email-queue`: Sends email verification messages.
- `followup-queue`: Sends scheduled follow-up emails.
- `ghost-detection`: Evaluates stale applications and updates ghost status.

Workers:

- `email.worker.js`: Processes verification email jobs.
- `followup.worker.js`: Validates and sends follow-up emails.
- `ghost.worker.js`: Scores applications, updates ghost detection records, triggers follow-ups when useful, and schedules the next ghost check.

This architecture keeps request-response API calls fast while allowing email and scoring workflows to run independently.

## Security and Privacy

The backend includes the following security practices:

- Passwords are hashed using bcrypt.
- JWT access tokens are signed with a server-side secret.
- Refresh tokens are generated with cryptographically secure random bytes.
- Refresh tokens are hashed before database storage.
- Refresh token rotation reduces replay risk.
- Logout revokes the active refresh token.
- Protected routes require valid authentication.
- CORS is restricted to the configured frontend origin.
- Auth cookies are HTTP-only and use secure cookies in production.
- Request payloads are validated with Zod schemas.

## Operational Requirements

CareerOps requires:

- Node.js runtime.
- PostgreSQL database.
- Redis server for BullMQ queues.
- Gmail-compatible email credentials for Nodemailer.
- Google OAuth credentials if Google login is enabled.

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | API server port. Defaults to `3000`. |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | Secret used to sign and verify JWT access tokens. |
| `FRONTEND_URL` | Frontend origin used for CORS and auth redirects. |
| `BACKEND_URL` | Backend base URL used to build verification links. |
| `EMAIL_USER` | Email account used by Nodemailer. |
| `EMAIL_PASS` | Email password or app password used by Nodemailer. |
| `REDIS_HOST` | Redis host. Defaults to `127.0.0.1`. |
| `REDIS_PORT` | Redis port. Defaults to `6379`. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `NODE_ENV` | Enables production cookie behavior when set to `production`. |

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with Nodemon. |
| `npm start` | Start the API with Node. |
| `npm run worker:email` | Start the email verification worker. |
| `npm run worker:followup` | Start the follow-up email worker. |
| `npm run worker:ghost` | Start the ghost detection worker. |
| `npm test` | Run the Jest test suite. |
| `npm run test:workers` | Run worker-focused tests. |
| `npm run test:controllers` | Run controller-focused tests. |

## Quality and Test Coverage

The project includes automated tests for services, controllers, workers, middleware, and utility logic. The test suite covers core product behavior such as authentication, application lifecycle operations, follow-up handling, interview workflows, settings, ghost worker behavior, and application utilities.

## Product Roadmap Opportunities

The current backend provides a strong operational foundation. Future product improvements could include:

- A user-facing activity timeline powered by event logs.
- Dashboard charts based on analytics snapshots.
- Configurable follow-up templates.
- Manual follow-up creation and cancellation.
- Richer ghosting signals based on recruiter responses.
- Calendar integration for interviews.
- Import workflows from LinkedIn, Naukri, CSV, or email.
- Notification channels beyond email.

## Summary

CareerOps is a structured job search operations platform. It helps users manage applications, maintain timely recruiter communication, track interview progress, detect stale opportunities, and understand their overall application pipeline. The backend is designed around clear domain modules, validated APIs, durable persistence, secure authentication, and asynchronous background jobs for email and ghost detection workflows.
