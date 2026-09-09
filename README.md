# CogExperiments Platform v2.1

Universal browser-based experiment builder.

## v2.1
- Admin Login + Register with Supabase Auth.
- Registration does **not** automatically grant access. Add approved User UID to `public.admin_users`.
- Universal blocks: names, trial counts, exposure, ISI, breaks, stop rules.
- Upload image/audio/video stimuli.
- Custom response keys.
- Optional Fixed Set template preserves the 1/2/3 response mapping and calibrated physical sizes.
- Excel export:
  - `Participants`: one row per participant, block N, key 1/2/3 counts, percentages, sequences, missing.
  - `Trial_Data`: one row per trial.
  - `Experiment_Settings`: readable experiment settings.

## Production setup
1. Create Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Register the first admin from `admin.html`.
4. In Supabase Authentication > Users copy the user's UUID.
5. Run:
   `insert into public.admin_users(user_id) values ('YOUR-UUID');`
6. Put Project URL and publishable/anon key in `js/config.js`.
7. Set `DEMO_MODE: false`.
8. Commit files to GitHub Pages.

Never put a Supabase service-role/secret key in frontend code.
