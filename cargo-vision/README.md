# Cargo Vision

This is a code export of the Lovable project **Cargo Vision** (internal name `cube-packer-pro`), pulled into this repository on **2026-09-10**.

- **Stack**: [TanStack Start](https://tanstack.com/start) (React + TypeScript), Tailwind CSS, shadcn/ui, Three.js (`@react-three/fiber`) for the 3D container/cargo visualization, and [Supabase](https://supabase.com) for authentication and the Postgres database.
- **What it does**: simulates loading cube-shaped materials (lotes) into a 40HC shipping container / vehicle, with a 3D view of the packing result, weight/volume checks, per-axle weight distribution, and PDF/image report export. Interface is in Portuguese (pt-BR).
- **Before it will run**: environment variables must be reconfigured and a Supabase project connected — this export contains **no secrets**, only source code. See `.env.example` for the required variable names (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` and their `VITE_`-prefixed client-side equivalents). The database schema lives in `supabase/migrations/`.
- **Original Lovable project**: https://lovable.dev/projects/a9bc9086-a290-4630-925d-84461929fc26

See `AGENTS.md` for a note on this project's Lovable git-sync behavior, and `src/routes/README.md` for the TanStack Start file-routing conventions used here.

---
