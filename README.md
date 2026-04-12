# ClearWave

> Field service management for pool cleaning companies in Australia.

ClearWave is a mobile-first SaaS app built for small pool cleaning businesses (1–5 technicians). It helps technicians organize their day, complete checklists, log water tests, generate invoices, and get AI-powered route suggestions — all from their phone.

---

## Why ClearWave

Most field service tools are built for enterprise. ClearWave is built for the technician in the field:

- **Simple** — designed to be used with one hand, on the go
- **AI-powered** — chemical recommendations and day optimization via Claude API
- **Route-optimized** — Google Routes API reorders your day in real time
- **Nearby visits** — suggests visits from upcoming days that are close to your route
- **Invoicing** — auto-generates invoices from checklist data (chemicals + services)
- **Offline-first** — PWA coming soon

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
| PDF | jsPDF + autotable |
| Cron | Supabase Edge Functions + pg_cron |

---

## Features

### Auth & roles
- Admin / technician roles
- Admin: full access to all features, customers, settings and team management
- Technician: sees only their assigned visits and customers
- Forgot password / reset password flow
- Admin can create technicians from Settings → Team

### Customers & properties
- Customer list with search (filtered by role)
- Properties with pool details (type, volume, equipment)
- Address autocomplete with Google Places API
- Automatic geocoding (lat/lng) on save

### Service plans
- Weekly / fortnightly / monthly recurrence
- Automatic visit generation 42 days ahead
- Cron job (Supabase Edge Function) extends visits weekly automatically
- Pool equipment tracking (pump, filter, chlorinator)
- One active plan per property
- Assign technician per plan

### Visits
- Day / month calendar view with visit dots
- Week strip with navigation
- Start / complete / skip with reason
- Backlog of overdue visits
- Contextual back navigation (← Route / ← Customer / ← Visits)
- Invoice badge (pending / paid) in visit list

### Checklist
- Tasks from product catalog (services)
- Water test: pH, free chlorine, alkalinity, stabiliser, salt, calcium hardness
- Live color indicators (green/amber/red) against ideal ranges
- AI chemical recommendations (Claude API) based on test results + pool volume
- Chemicals added with quantity and real-time price calculation
- Custom chemicals with manual pricing
- Photo upload (Supabase Storage)
- Notes

### Route
- Weekly strip to navigate between days
- Daily map with visit pins and status colors
- One-tap route optimization (Google Routes API)
- Navigate to each property via Google Maps
- AI "What should I do next?" button (Claude API)
- Nearby visits — find pending visits in the next 3 days within 20km of your route

### Invoicing
- Auto-generated from checklist (services + chemicals × unit price)
- Preview before saving
- Download PDF (jsPDF)
- Send by email (mailto with pre-filled subject and body)
- Mark as paid
- Invoice badge visible in visits list and property history

### Products & pricing
- Admin manages a catalog of services and chemicals with unit prices
- Custom sort order (↑↓)
- Chemicals appear in checklist with quantity input and live price calculation

### Settings (admin only)
- Products & Pricing
- Team management (create / delete technicians)

---

## Project structure

```
src/
├── routes/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (app)/
│   │   ├── visits/
│   │   │   └── [id]/
│   │   │       ├── checklist/
│   │   │       └── invoice/
│   │   ├── route/
│   │   │   └── nearby-visits/
│   │   ├── customers/
│   │   │   └── [id]/
│   │   │       └── properties/
│   │   │           └── [propertyId]/
│   │   │               └── plans/
│   │   └── settings/
│   │       ├── products/
│   │       └── team/
│   └── api/
│       ├── ai-suggest/     ← Claude: water test recommendations
│       ├── ai-day/         ← Claude: day optimizer
│       └── nearby-visits/  ← visits within radius
├── lib/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
└── supabase/
    └── functions/
        └── extend-visits/  ← weekly cron
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
git clone https://github.com/ro-agusti/pool-service.git
cd pool-service
npm install
cp .env.example .env
# Fill in your keys
npm run dev
```

### Environment variables

```bash
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
PUBLIC_GOOGLE_MAPS_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Roadmap

| Feature | Status |
|---|---|
| Setup: SvelteKit + Supabase + Tailwind + Auth | ✅ |
| Customers + properties + geocoding | ✅ |
| Service plans + visits + checklist + AI water test | ✅ |
| Daily route map + Google Routes optimization | ✅ |
| AI day optimizer ("What should I do next?") | ✅ |
| Visit history in property detail | ✅ |
| Nearby visits feature | ✅ |
| Products catalog + auto-pricing in checklist | ✅ |
| Invoicing + PDF + email | ✅ |
| Cron for automatic visit extension | ✅ |
| Auth + roles (admin / technician) | ✅ |
| Forgot password / reset password | ✅ |
| Landing page + home dashboard | ✅ |
| Deploy to Cloudflare Pages | ✅ |
| PWA + offline sync | ⬜ |
| Billing / multi-tenant onboarding | ⬜ |

---

## License

Private — all rights reserved.