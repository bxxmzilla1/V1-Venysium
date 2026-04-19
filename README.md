# Venysium CRM

A Progressive Web App (PWA) CRM built on top of the Telegram MTProto API. Log in with your Telegram account, manage conversations, send messages, and add CRM notes and tags — all from a beautiful dark-themed interface.

## Features

- **Telegram Login** — Phone number + OTP (with 2FA support)
- **Conversation List** — All your Telegram chats, groups, and channels
- **Real-time Messaging** — Send and receive messages directly
- **CRM Panel** — Per-contact notes and tags stored locally
- **PWA** — Install on mobile or desktop, works offline
- **Dark UI** — Professional dark theme built for productivity

## Setup

### 1. Get Telegram API Credentials

1. Go to [https://my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Click **API development tools**
4. Create a new application (any name/platform is fine)
5. Copy your **App api_id** and **App api_hash**

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
SESSION_SECRET=your-random-32-char-secret-here
```

Generate a strong `SESSION_SECRET`:
```bash
openssl rand -base64 32
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel
```

Set environment variables when prompted (or in the Vercel dashboard).

### Option B — GitHub Integration

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repository
4. Add environment variables in the Vercel dashboard:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `SESSION_SECRET`
5. Click **Deploy**

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Venysium CRM"
git remote add origin https://github.com/YOUR_USERNAME/venysium-crm.git
git push -u origin main
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── send-code/    ← Send OTP to phone
│   │   │   ├── verify-code/  ← Verify OTP + handle 2FA
│   │   │   └── logout/       ← Logout and clear session
│   │   ├── dialogs/          ← Fetch chat/contact list
│   │   ├── messages/         ← Fetch messages for a chat
│   │   ├── send/             ← Send a message
│   │   └── contacts/         ← Fetch Telegram contacts
│   ├── login/                ← Auth page
│   ├── dashboard/            ← Main CRM page
│   └── layout.tsx
├── components/
│   ├── LoginForm.tsx          ← Multi-step login UI
│   ├── CRMDashboard.tsx       ← Main dashboard
│   └── ServiceWorkerRegistration.tsx
└── lib/
    ├── telegram.ts            ← GramJS client factory
    └── session.ts             ← iron-session helpers
```

## Important Notes

- **Session Security** — User sessions are encrypted via `iron-session` using your `SESSION_SECRET`. Never share this key.
- **API Limits** — Telegram limits how many messages you can send. The app respects this naturally.
- **Vercel Serverless** — Each API call creates a fresh connection to Telegram and disconnects after. This is intentional for serverless compatibility.
- **CRM Data** — Notes and tags are stored in the browser's localStorage (per device). They are not synced across devices.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **GramJS** (Telegram MTProto client)
- **iron-session** (encrypted cookie sessions)
- **Lucide React** (icons)
