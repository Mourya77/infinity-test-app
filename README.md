# Infinity Classes — Mini Online Test App

A mini online test application built with the **MERN stack** (MongoDB, Express, React, Node.js) as a take-home assignment for Infinity Classes.

## Live demo / deployment status
- **Target GitHub repo:** https://github.com/Mourya77/infinity-test-app (to be created — see note)
- **Deploy-ready:** this repo contains everything needed for a one-service deploy (`npm install && npm run build`, then `npm start`; `render.yaml` included for Render free tier). An Antideploy application (`infinity-test-app`) has also been created for it.

> Deployment note (honest status at time of writing): the app is fully built and verified locally end-to-end, but the public live link is pending two account steps — (1) the GitHub repository must be created under the owner account (the automation's GitHub App lacks repo-creation permission), and (2) a hosting slot: the Antideploy free plan's single live-server slot is in use by another app, so either that plan/slot situation changes or the repo is deployed to Render from GitHub (free tier, ~30–60s cold start after idle).

### Demo accounts (seeded automatically)
| Role | Email | Password |
|---|---|---|
| Student | `demo@infinityclasses.test` | `Demo@123` |
| Admin | `admin@infinityclasses.test` | `Admin@123` |

You can also sign up with your own email and password.

## Features
- **Auth** — email + password sign-up / login. Passwords are hashed with bcrypt; sessions use JWT (7-day expiry).
- **Test screen** — exactly **10 MCQs** served from the database, with a **10-minute countdown timer** that **auto-submits** when it reaches 00:00. Question palette shows answered / current state; previous / next navigation.
- **Results screen** — instant score, plus a per-question review showing your answer, the correct answer and an explanation.
- **Attempt history** — every attempt for the logged-in user, with date, score, percentage and time taken.
- **Admin** — users with the admin flag (seeded admin account above) get an **Add Question** page to grow the question bank (question, 4 options, correct option, explanation, category). Tests serve 10 questions at random from the bank (12 seeded).
- Seed data: 12 MCQs (general aptitude + basic programming).

## Tech / architecture
- `server/` — Express REST API (`/api/auth`, `/api/test`, `/api/attempts`, `/api/questions`), Mongoose models `User`, `Question`, `Attempt`.
- `client/` — React + Vite single-page app. In production the Express server serves the built client, so the whole app deploys as **one service**.
- **Database:** if `MONGO_URI` is set, the app uses that MongoDB. If not, it starts an ephemeral `mongodb-memory-server` instance behind the same Mongoose models, and if that binary cannot be fetched it falls back to a plain in-memory store with the same API — so the public demo runs with **no DB credentials required**. In fallback modes data is ephemeral and resets on restart (seed accounts and questions are recreated on boot). For a persistent deployment, set `MONGO_URI` (e.g. MongoDB Atlas free tier).

## Run locally
```bash
npm install          # API dependencies
npm run build        # installs client deps and builds the React app
npm start            # serves API + app on http://localhost:4000
```
Optional env vars: `PORT`, `JWT_SECRET`, `MONGO_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Verify
```bash
npm run test:e2e     # with the server running: register → login → test → submit → history → admin add-question
```

## Project structure
```
server/index.js    Express API + static serving
server/models.js   Mongoose schemas (User, Question, Attempt)
server/store.js    Data layer (Mongo / memory-server / in-memory fallback) + seeding
server/seedData.js 12 seeded MCQs
client/src/        React app (auth, test + timer, results, history, admin)
scripts/e2e.mjs    End-to-end smoke test against a running server
render.yaml        Optional Render free-tier deploy config
```
