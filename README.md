# ClearWave

> Field service management for pool cleaning companies in Australia.

ClearWave is a mobile-first SaaS app built for small pool cleaning businesses (1–5 technicians). It helps technicians organize their day, complete checklists, log water tests, and get AI-powered route suggestions — all from their phone, even offline.

---

## Why ClearWave

Most field service tools are built for enterprise. ClearWave is built for the technician in the field:

- **Simple** — designed to be used with one hand, on the go
- **AI-powered** — chemical recommendations and day optimization via Claude API
- **Offline-first** — works without internet signal (coming soon)
- **Route-optimized** — Google Routes API reorders your day in real time

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + Backend | SvelteKit 5 (Svelte 5 Runes) |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| Styling | Tailwind CSS v4 |
| Deploy | Cloudflare Pages |
| Maps + Routes | Google Maps API + Routes API |
| AI | Claude API (claude-sonnet-4-20250514) |
| Storage | Supabase Storage |
| PDF | jsPDF + autotable (coming soon) |
| PWA | @vite-pwa/sveltekit (coming soon) |

---

## Features

### Customers & properties
- Customer list with search
- Properties with pool details (type, volume, equipment)
- Address autocomplete with Google Places API
- Automatic geocoding (lat/lng) on save

### Service plans
- Weekly / fortnightly / monthly recurrence
- Automatic visit generation 6 weeks ahead
- Pool equipment tracking (pump, filter, chlorinator)
- One active plan per property

### Visits
- Weekly calendar strip with visit dots
- Start / complete / skip with reason
- Visit detail with pool info and equipment
- Last visit banner with checklist history

### Checklist
- Tasks: general clean, SpinDisk water test
- Water test: pH, free chlorine, alkalinity, stabiliser, salt, calcium hardness
- Live color indicators (green/amber/red) against ideal ranges
- AI chemical recommendations (Claude API) based on test results + pool volume
- Chemicals added with product, quantity and unit
- Photo upload (Supabase Storage)
- Notes

### Route (coming soon)
- Daily map with all visit pins
- One-tap route optimization (Google Routes API)
- Navigate to each property via Google Maps
- Real-time reordering as visits are completed

### AI day optimizer (coming soon)
- "What should I do next?" button
- Considers current location, pending visits, backlog, and time of day
- Suggests the single best next action

---

## Project structure

```
src/
├── routes/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── visits/
│   │   │   └── [id]/
│   │   │       └── checklist/
│   │   ├── customers/
│   │   │   └── [id]/
│   │   │       └── properties/
│   │   │           └── [propertyId]/
│   │   │               └── plans/
│   │   └── route/         ← coming soon
│   └── api/
│       └── ai-suggest/    ← Claude API endpoint
├── lib/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
```

---

## Getting started

### Prerequisites
- Node.js 18+
- Supabase account
- Google Cloud account (Maps + Places + Routes + Geocoding APIs enabled)
- Anthropic API key

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/clearwave.git
cd clearwave

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your keys (see below)

# Run dev server
npm run dev
```

### Environment variables

```bash
# Supabase
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google Maps
PUBLIC_GOOGLE_MAPS_KEY=AIza...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Database setup

Run the SQL files in order from `/supabase/migrations/` (coming soon) or copy the schema from the Supabase SQL Editor.

---

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 0 | Setup: SvelteKit + Supabase + Tailwind + Auth | ✅ Done |
| 1 | Customers + properties + geocoding | ✅ Done |
| 2 | Service plans + visits + checklist + AI water test | ✅ Done |
| 3 | Daily route map + Google Routes optimization | 🔄 In progress |
| 4 | AI day optimizer ("What should I do next?") | ⬜ Planned |
| 5 | Quotes + invoices + PDF | ⬜ Planned |
| 6 | PWA + offline sync | ⬜ Planned |
| 7 | Multi-tenant onboarding + settings + billing | ⬜ Planned |

---

## License

Private — all rights reserved.