# EARNPESA Full Platform Plan

## Goal
Build a Kenya-first opportunities marketplace with public discovery, secure user and business portals, an administration workspace, and manual M-Pesa withdrawal processing. The experience will use a restrained red, gold, white, and charcoal fintech design with mobile-first navigation.

## Release areas

### Public experience
- Home page with EARNPESA identity, core offer, real platform statistics, featured/latest campaigns, trust messaging, FAQs, and registration prompts.
- Dedicated pages for Opportunities, Refer & Earn, Businesses, Learn, Help, Trust Center, Terms, Privacy, and Withdrawal Policy.
- Searchable Learn and Help content with SEO metadata on every public page.
- Email/password and Google sign-in, registration, email confirmation, password recovery, and role-aware redirects.

### User portal
- Dashboard with balances, earnings, withdrawals, opportunities, completed tasks, and recent transactions.
- Opportunity marketplace and detail flow: Available → Started → Submitted → Verification → Approved → Rewarded.
- Referral center with unique codes, share actions, click/signup/qualified/conversion metrics, and verified reward release.
- Wallet, rewards, full transaction history, notifications, profile, verification, fraud reporting, disputes, and support tickets.
- Manual M-Pesa withdrawal request flow with phone validation, review status, reference IDs, and immutable transaction records.

### Business portal
- Business profile and verification workflow.
- Campaign creation with audience, budget, reward, limits, dates, requirements, and verification method.
- Campaign workflow: Draft → Submitted → Admin Review → Approved → Live → Completed.
- Funding records, participant review, conversion tracking, and campaign analytics.

### Admin portal
- Role-protected areas for users, businesses, campaigns, opportunities, transactions, withdrawals, referrals, fraud alerts, support, announcements, Learn content, analytics, and settings.
- Manual withdrawal processing with approval/rejection/completion states and audit records.
- Live database-backed totals and activity analytics.

## Security and data rules
- Store roles separately from profiles: user, business, admin, and super admin.
- Enforce row-level access for personal, business, and administrative data.
- Run reward calculations, eligibility checks, campaign limits, referral qualification, wallet ledger changes, and withdrawal validation on the server.
- Use append-only ledger and audit records for money-related events.
- Add protections and review signals for duplicate identities, self-referrals, repeated claims, bots, suspicious referrals, and suspicious withdrawals.
- Validate all forms in the browser and on the server.
- Show “Verified Campaign” only when an approved verification record exists.

## Data foundation
- Profiles, roles, account verification, businesses, business verification.
- Campaigns, opportunities, participation/submissions, verification decisions, campaign funding.
- Referral codes/events/qualifications/rewards.
- Wallets, ledger transactions, rewards, withdrawal requests.
- Notifications, support tickets/messages, disputes, fraud reports/signals, audit events.
- Learn articles, FAQs, announcements, and platform settings.
- Seed realistic public campaigns, FAQs, Learn articles, and demonstration statistics so the first screen is populated.

## Design and navigation
- Distinctive editorial-fintech visual system: crisp white canvas, deep charcoal typography, controlled Kenyan red actions, warm gold reward accents, compact 8px cards, subtle elevation, and data-rich layouts.
- Mobile bottom navigation for signed-in users; compact desktop sidebars for user, business, and admin workspaces.
- Clear status labels, balance typography, accessible forms, empty/loading/error states, charts, and reduced-motion support.

## Delivery sequence
1. Create the design system, shared navigation, metadata, authentication, and database schema.
2. Build public pages and populated opportunity discovery.
3. Build authenticated user, referral, wallet, notification, profile, and support flows.
4. Build business campaign creation and analytics.
5. Build admin review, payout, fraud, support, content, and analytics tools.
6. Verify access control, key workflows, mobile and desktop layouts, build health, and database security checks.

## Technical notes
- Use the project’s TanStack Start architecture and Lovable Cloud rather than introducing a second framework.
- Use typed server functions for internal operations and PostgreSQL transactions/functions for atomic reward and wallet updates.
- Keep M-Pesa manual in this release: the system records and validates requests; administrators process transfers externally and record the M-Pesa receipt/reference.
- Structure payment and partner integrations behind provider adapters so live M-Pesa, survey, affiliate, and advertiser services can be added later.
