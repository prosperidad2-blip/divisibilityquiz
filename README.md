# ARAL Math Grade 6 — Divisibility Rules Interactive Game (Worksheet 4)

Production-ready **Express.js + Firebase Firestore** web application for **Sta. Irene Central Elementary School (Division of Agusan del Sur)** — *Created by: Mel John C. Alvar*.

## Features
- **Persistent Firebase Firestore Storage**: All registered learner profiles, worksheet responses, and scores are stored in Cloud Firestore so records remain intact across **Render redeployments** and container restarts.
- **Privacy-First Shared Device Registration**: Never exposes previously saved accounts on shared classroom tablets or laptops.
- **Deferred Grading & Answer Key**: Scores and item feedback stay hidden during Stages 1–3 and unlock immediately after final submission.
- **PIN-Protected Teacher Gradebook**: Real-time KPI cards, item analysis, individual student breakdown, CSV export, and batch delete protected by server-side Admin PIN validation.

## Quick Local Setup
```bash
npm install
cp .env.example .env
# Place your Firebase serviceAccountKey.json in the root folder or set FIREBASE_SERVICE_ACCOUNT_JSON in .env
npm start
```

## Deploying to Render.com
1. Push this repository to **GitHub**.
2. Create a new **Web Service** on [Render](https://render.com) connected to your GitHub repository.
3. Configure service settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add the following **Environment Variables** in Render:
   - `ADMIN_PIN`: Your teacher PIN (e.g., `1234`)
   - `FIRESTORE_COLLECTION`: `aral_math_g6_w4_records`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Paste the full contents of your Firebase Service Account JSON key.
5. Click **Deploy Web Service**. Your student records will persist permanently across every future deployment!
