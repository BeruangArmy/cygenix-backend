# CyGenix Backend

Backend API for **CyGenix**, a gamified mobile cybersecurity awareness platform. Employees learn to spot phishing, smishing, vishing, malware, weak passwords, pretexting and other social-engineering attacks through short lessons, quizzes, daily drills and boss encounters. They earn XP, levels, badges and leaderboard ranks along the way. Admins use the same app to approve accounts, manage content, monitor progress and export reports.

The Flutter app reads most data straight from Firestore. This service handles the work that has to be **trusted**: anything that grades an answer, awards XP or badges, ranks users, or touches another person's account. Firestore security rules alone can't safely express that logic, so it runs here with the Firebase Admin SDK.

> Final Year Project, Bachelor of Information Technology (Hons) Cyber Security, Universiti Poly-Tech Malaysia (UPTM).

## Tech stack

| Layer | Tool |
| --- | --- |
| Runtime | Node.js 22 |
| Web framework | Express 4 |
| Database and auth | Firebase Auth and Cloud Firestore (via `firebase-admin`) |
| Push notifications | Firebase Cloud Messaging |
| Reports | PDFKit (PDF) and ExcelJS (`.xlsx`) |
| Hosting | Render (free web service, see `render.yaml`) |
| Tests | Node's built-in test runner |

## Features

**For employees**
- Learning modules and lessons, with XP awarded when a lesson is completed
- Three-level module quizzes (Easy, Medium, Hard), graded on the server so answers and XP can't be faked
- The Loop: a daily drill, rematches on missed questions, module bosses, the PhishBack scorer and a swap mini-game
- XP curve and levels (200 XP for the first level, then 50 XP more for each level after that)
- Crest rank tiers: Iron, Bronze, Silver, Gold, Ruby, Diamond, Obsidian
- Automatic badge awards
- Leaderboards: all-time, weekly, monthly and per department
- In-app notifications that follow each user's notification setting
- Reporting suspicious messages to admins

**For admins**
- Account approval: new sign-ups wait for an admin to approve or reject them, with bulk approve and undo
- Employee roster, per-employee detail and dashboard stats
- Content stats, daily drill pool management and boss editing
- Nudges to inactive employees, sent as an in-app notification plus a push
- Progress reset for a single user
- Per-employee and all-employee reports in **PDF** and **Excel**
- Review of reports that employees submit

## How auth works

The app signs in with Firebase Auth and sends the ID token with every request:

```
Authorization: Bearer <Firebase ID token>
```

`src/middleware/auth.js` checks every request in this order:

1. `verifyToken` verifies the token, loads `users/{uid}`, and blocks accounts that are still **pending** or were **rejected**. Older accounts with no `status` field count as approved, and admins are never blocked.
2. `adminOnly` is added on admin routes and requires `role: "admin"` on the user document.

This server never stores or checks passwords. Firebase Auth is the only identity provider.

## Project structure

```
server.js                  Express app: CORS, routes, 404 and error handlers
src/
  firebaseAdmin.js         Admin SDK setup from environment variables
  middleware/auth.js       verifyToken and adminOnly
  routes/                  One file per feature area (see API below)
  xpCurve.js               XP needed for each level
  rankTiers.js             Crest ladder (mirrors the Flutter client)
  quizLevels.js            Easy / Medium / Hard progress helpers
  badges.js                Badge criteria and awarding
  notifications.js         In-app notifications (respects notifOn)
  push.js                  FCM push, best effort
  reportData.js            Data and ranks for reports
  reportPdf.js             PDF report builder
  reportExcel.js           Excel report builder
firestore.rules            Firestore security rules
firestore.indexes.json     Composite indexes
postman/                   Postman collection for the API
rebalance/                 Rewritten quiz options used by apply-rebalance.js
test/unit.test.js          Unit tests (in-memory Firestore fake)
*.js (root)                One-off seed, backfill, migration and audit scripts
```

## Getting started

**Requirements:** Node.js 22, plus a Firebase project with Auth and Firestore enabled.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`. Get them from **Firebase Console → Project Settings → Service Accounts → Generate new private key**. Keep the `\n` escapes in the private key exactly as they are.
3. Run the server:
   ```bash
   npm run dev     # restarts automatically when files change
   npm start       # normal start
   ```
4. Check that it's up:
   ```bash
   curl http://localhost:4000/health
   # {"ok":true,"service":"cygenix-backend"}
   ```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | Service account email |
| `FIREBASE_PRIVATE_KEY` | Yes | Service account private key |
| `PORT` | No | Defaults to `4000` |
| `CORS_ORIGINS` | No | Comma-separated origins allowed to call the API (Flutter web dev). Native Android and iOS builds don't need it. |

**Never commit** `.env` or a service account JSON file. Both are already in `.gitignore`.

## Deployment (Render)

`render.yaml` is a Render Blueprint. To deploy, create a service from this repo with **New + → Blueprint**, then paste the three Firebase values when Render asks for them. Render runs `npm install` and `npm start`, and checks `/health`.

On the free plan the service sleeps when it's idle, so the first request after a quiet period can take around 30 seconds while the server wakes up.

### Firestore rules and indexes

Deploy them with the Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## API overview

Every route except `/health` needs a Bearer token. 🔒 means the route is admin only.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Modules and lessons | `GET /modules`, `GET /modules/:id/lessons`, `POST /lessons/:id/complete` |
| Quizzes | `GET /modules/:moduleId/quiz-state`, `POST …/quiz-state/check`, `POST …/quiz-state/submit`, `POST …/quiz-state/retry-module` |
| Challenges | `GET /challenges/today`, `GET /modules/:moduleId/challenges`, `POST /challenges/:challengeId/attempt` |
| The Loop | `GET /drill/today`, `POST /drill/answer`, `POST /drill/insurance`, `GET /rematch`, `POST /rematch/answer`, `GET /boss/:moduleId`, `POST /boss/:moduleId/play`, `POST /phishback/score`, `GET`/`POST /minigame/swap` |
| Leaderboard | `GET /leaderboard`, `GET /leaderboard/department` |
| Progress | `GET /progress/:userId` |
| Notifications | `POST /notifications/daily-rank` |
| Suspicious-message reports | `GET`/`POST /reports`, 🔒 `GET /admin/reports`, 🔒 `POST /admin/reports/:uid/:reportId` |
| 🔒 Approvals | `GET /admin/approvals`, `GET /admin/approvals/count`, `POST /admin/approvals/:uid/approve`, `POST /admin/approvals/:uid/reject`, `POST /admin/approvals/bulk-approve`, `POST /admin/approvals/revert` |
| 🔒 Employees | `GET /admin/employees`, `GET /admin/employees/:id`, `GET /admin/dashboard-stats`, `GET /admin/content-stats`, `POST /admin/employees/:id/notify`, `POST /admin/modules/:id/notify-published`, `POST /admin/users/:uid/reset-progress` |
| 🔒 Reports | `GET /admin/employees/:id/report` (PDF), `GET /admin/employees/report/all` (PDF), `GET /admin/employees/:id/report/excel`, `GET /admin/employees/report/all/excel` |
| 🔒 Content | `GET`/`POST /admin/drill-items`, `DELETE /admin/drill-items/:id`, `GET`/`PUT /admin/boss/:moduleId` |

The Postman collection in `postman/` lets you try these routes by hand.

## Maintenance scripts

The `.js` files in the repo root are one-off scripts. They connect to the live Firebase project using your `.env`. Each file explains what it does at the top. **Read that comment before you run a script**, because some of them write to production data.

```bash
node <script>.js
```

| Group | Scripts |
| --- | --- |
| Seed content | `seed-lessons-all`, `seed-lesson`, `seed-tells*`, `seed-bosses`, `seed-loop`, `seed-drills-more`, `seed-rank-badges`, `seed-depts` |
| Backfill and fix data | `backfill-*`, `fix-*`, `apply-rebalance`, `reshuffle-tells`, `widen-clean-lines` |
| Migrate and rebrand | `migrate-domain`, `rebrand`, `rebrand-bosses` |
| Read-only checks | `audit-content`, `analyse-answers`, `scan-venator`, `scan-lookalike`, `pick-salt` |
| Admin | `set-admin-pw` (`node set-admin-pw.js <admin-email> '<new-password>'`), `reset-all` (resets **everyone** except admins and the test account) |

## Tests

```bash
node --test test/unit.test.js
```

The tests replace Firebase with an in-memory fake, so they never touch the live project.
