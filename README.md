# Experimental Platform v2

Modular browser-based research platform prototype.

## Included

- Admin dashboard
- Experiment Builder
- Publish / draft / archive
- Duplicate experiment
- Stimulus plugin architecture
  - circles
  - vertical lines
  - auditory tone scaffold
- Participant runner
- Physical screen calibration
- Control → break → set → critical flow
- Automatic trial storage
- Supabase-ready database schema + RLS
- Admin results dashboard
- `.xlsx` export with:
  - Participants
  - Trial_Data
  - Experiment_Settings
- Demo Mode using localStorage

## Demo Mode

The package starts with `DEMO_MODE: true`.

Open `admin.html`. One example experiment is seeded automatically:
`Visual Fixed Set — Circles`.

Data stays only in that browser in Demo Mode.

## Connect Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Create the researcher account in Supabase Auth.
4. Copy that Auth user's UUID and run:

   insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');

5. Edit `js/config.js`:

   SUPABASE_URL: "https://YOUR_PROJECT.supabase.co"
   SUPABASE_PUBLISHABLE_KEY: "YOUR_PUBLISHABLE_KEY"
   DEMO_MODE: false

Use only the browser-safe publishable/anon key. Never expose a secret/service-role key.

## GitHub Pages

Upload the entire folder contents to the repository root:
- `index.html`
- `admin.html`
- `run.html`
- `css/`
- `js/`
- `supabase/`

Then enable GitHub Pages from the `main` branch `/ (root)`.

## Architecture

`admin.js`
Researcher UI / builder / results / export

`runner.js`
Experiment engine and protocol flow

`stimuli.js`
Stimulus plugins. New stimulus types can be added here without rewriting the runner.

`db.js`
Storage abstraction. Same app works in Demo Mode or Supabase Mode.

## Important v2 prototype notes

1. Circles are the first complete runnable template.
2. Vertical lines are already rendered by the stimulus plugin and can use the same fixed-set flow.
3. Auditory tones are scaffolded but require us to define the exact auditory paradigm before production.
4. No-asymmetry counterbalancing in this prototype is not yet guaranteed 50/50 across the full sample. Production should assign sides transactionally in the database.
5. The anonymous session completion RPC should receive an additional secret session token before real participant deployment.
6. Excel export is performed in the admin browser using SheetJS.
7. Before real data collection, pilot timing on target browsers/devices and validate the protocol implementation.
