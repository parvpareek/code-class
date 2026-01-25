### HackerRank endpoints (findings from local probe)

This repo currently uses HackerRank primarily for **submission verification** (did the student solve a specific challenge, and when). In addition, several public endpoints can enrich a user profile and provide track/domain statistics.

These notes are based on running `server/scripts/test-hackerrank-apis.mjs` against handle `parvpareek` on 2026-01-21.

## How we tested

- **Script**: `server/scripts/test-hackerrank-apis.mjs`
- **Command**:
  - `HR_USER=parvpareek node server/scripts/test-hackerrank-apis.mjs`
  - Optional cookie: `HR_COOKIE="<value>"` (sent as `Cookie: _hrank_session=<HR_COOKIE>`)
- **Saved outputs**: `server/scripts/out/hackerrank-<handle>/`

## Summary: auth/cookie requirement (observed)

All 8 endpoints listed below returned **HTTP 200** without providing a cookie in our run. That implies they are **handle-public** (at least for this account / at the time of test). Do not assume this is permanent—HackerRank can change access controls.

## Endpoints and data details

### 1) Profile

- **URL**: `https://www.hackerrank.com/rest/contests/master/hackers/<handle>/profile`
- **Response shape**: `{ "model": { ... } }`
- **Useful fields observed** (non-exhaustive):
  - **Identity / display**: `id`, `username`, `name`, `personal_first_name`, `personal_last_name`
  - **Profile meta**: `created_at`, `level`, `title`, `avatar`, `has_avatar_url`
  - **Location / education**: `country`, `school`, `local_language`
  - **Counters**: `username_change_count`, `event_count`, `followers_count`
  - **Other**: `website`, `short_bio`, `company`
- **What we can do with it**
  - Validate that a handle exists and fetch basic public profile metadata.
  - Show profile card in UI (name/avatar/school/country).
  - Not suitable for “proof of ownership” (it’s public).

### 2) Badges

- **URL**: `https://www.hackerrank.com/rest/hackers/<handle>/badges`
- **Response shape**: `{ "status": true, "models": [ ... ], "version": ... }`
- **Each badge model typically includes**
  - **Domain**: `badge_type`, `badge_name`, `url`
  - **Progress**: `solved`, `total_challenges`, `stars`, `level`
  - **Scoring/rank**: `total_points`, `current_points`, `hacker_rank`
  - **Progress-to-next**: `progress_to_next_star`, `upcoming_level`
- **What we can do with it**
  - Build a high-level progress dashboard (domain-wise solves, points, stars).
  - Display “strengths” by domain/language.
  - Not suitable for per-problem completion timestamps.

### 3) Scores / ELO (track-wise)

- **URL**: `https://www.hackerrank.com/rest/hackers/<handle>/scores_elo`
- **Response shape**: `[ { track_id, name, slug, practice: {...}, contest: {...} }, ... ]`
- **Useful fields observed**
  - `name`, `slug` (track identifier)
  - `practice.score`, `practice.rank`
  - `contest.score`, `contest.rank`, `contest.percentile`, `contest.competitions`
- **What we can do with it**
  - Track-wise leaderboard panels (Algorithms rank, SQL rank, etc).
  - Compare practice vs contest performance.
  - Not per-problem solve history.

### 4) Hacker companies

- **URL**: `https://www.hackerrank.com/community/v1/hackers/<handle>/hacker_companies`
- **Response shape**: JSON:API style `{ data: [...], meta: {...}, links: {...} }`
- **Data**:
  - `attributes.name`, `job_title`, `start_month/year`, `end_month/year`, `current`
  - `description`, `location`
  - `company_profile` (name/logo/website/uuid)
- **What we can do with it**
  - Profile enrichment (resume-like info).
  - Not useful for assignment verification.

### 5) Hacker schools

- **URL**: `https://www.hackerrank.com/community/v1/hackers/<handle>/hacker_schools`
- **Response shape**: JSON:API style `{ data: [...], meta: {...}, links: {...} }`
- **Data**:
  - `attributes.degree`, `program`, `start_month/year`, `end_month/year`, `current`
  - `attributes.score`, `score_type`
  - `school.name` and `unique_id`
- **What we can do with it**
  - Profile enrichment.
  - Not used for submission verification.

### 6) Links

- **URL**: `https://www.hackerrank.com/rest/hackers/<handle>/links`
- **Response shape**: `{ linkedin, github, portfolio }`
- **What we can do with it**
  - Profile enrichment and quick-linking to external portfolios.

### 7) Skills

- **URL**: `https://www.hackerrank.com/rest/hackers/<handle>/skills`
- **Response shape**: `[ "AWS", "Docker", ... ]`
- **What we can do with it**
  - Tagging / profile enrichment.
  - Potentially map “skills” to track recommendations (not submission verification).

### 8) Track challenges list (unsolved + filtered by subdomain)

- **Unsolved**:
  - **URL**: `https://www.hackerrank.com/rest/contests/master/tracks/algorithms/challenges?offset=0&limit=10&filters%5Bstatus%5D%5B%5D=unsolved&track_login=true`
- **Filtered by subdomain (example)**:
  - **URL**: `https://www.hackerrank.com/rest/contests/master/tracks/algorithms/challenges?offset=20&limit=10&filters%5Bsubdomains%5D%5B%5D=graph-theory&track_login=true`
- **Response shape**: `{ models: [...], total: <number>, ... }`
- **Each challenge model includes (high-signal fields)**
  - Challenge identity: `id`, `slug`, `name`, `kind`, `category`
  - Editorial availability flags: `is_editorial_available`, `is_solution_unlocked`
  - Popularity: `total_count`, `solved_count`, `success_ratio`
  - Track metadata: `track.{id,name,slug,track_id,track_name,track_slug}`
  - Dates: `created_at`, `updated_at`
  - **Onboarding templates/solutions** (large): `onboarding.<lang>.template/solution/hint`
- **What we can do with it**
  - Build a “browse / recommend” experience (unsolved lists, topic filters).
  - Use `slug` to construct canonical challenge URLs and to match assignments.
  - **Caution**: this is a catalog endpoint; it doesn’t prove a specific user’s accepted submission history.

## Important: what we still need cookies for (current repo behavior)

Even though the above endpoints worked without cookies, the repo’s **submission checking** relies on cookie-authenticated endpoints that return the user’s actual submission history:

- `GET https://www.hackerrank.com/rest/contests/master/submissions?offset=0&limit=N`
  - Requires `Cookie: _hrank_session=<session>` in our implementation.
  - Provides submission `created_at` timestamps for accepted solutions.

## Where submission checking is implemented

- `server/src/services/hackerrank.service.ts`
  - `fetchHackerRankSubmissions()` fetches accepted submissions using `_hrank_session`.
  - `processHackerRankSubmissions()` matches submissions to assigned problems by slug/name normalization and writes `completed/submissionTime` to DB.

