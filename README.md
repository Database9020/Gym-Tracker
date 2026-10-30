# Gym Journal

A personal workout tracker. It's an installable PWA built with Vite and vanilla JS, uses Supabase for storage and sign-in, and deploys on Netlify.

- **Edit exercises:** `src/config/exercises.js`
- **Database schema:** `supabase/schema.sql`

## One-time setup

### 1. Supabase
1. Go to [supabase.com](https://supabase.com) → **New project**. Name it `gym-tracker`, pick a region near you, and save the database password somewhere safe.
2. Once it's ready, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql` and click **Run**.
3. **Authentication → Users → Add user → Create new user**. Enter your email and a password, and tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up", so you're the only account.
5. **Project Settings → API** (or the **Connect** button): copy the **Project URL** and the **anon / public** key.

### 2. Netlify
1. **Add new site → Import an existing project → GitHub** and pick this repo. The build settings come from `netlify.toml`.
2. **Site configuration → Environment variables → Add a variable**:
   - `VITE_SUPABASE_URL`: the Project URL
   - `VITE_SUPABASE_ANON_KEY`: the anon public key
3. **Deploys → Trigger deploy → Deploy site**. The variables are built into the app, so redeploy whenever you change them.

### 3. Phone
Open the Netlify URL and sign in.
- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ → **Install app**

## Local development
```bash
cp .env.example .env   # fill in the two values
npm install
npm run dev
```

## Notes
- Every edit goes into a local outbox first, then syncs to Supabase. If there's no signal, edits wait on the phone and upload when you're back online. The "Offline · will sync" pill tells you when this is happening.
- Empty or half-filled sets (weight without reps, or reps without weight) are ignored in volume and charts.
- Vibration when the timer finishes works on Android. iOS Safari doesn't allow web apps to vibrate, so on iPhone the timer flashes instead.
