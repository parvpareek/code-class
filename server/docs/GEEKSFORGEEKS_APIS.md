### GeeksforGeeks endpoints (internal notes)

Assignment **submission checking** uses only the **bulk POST** (handle-based, no cookie). Each solved row can include **`user_subtime`**, which we treat as the solve time. We only mark a problem **completed** when that time is **on or after the assignment’s `createdAt`** (so old solves from before the assignment existed do not count).

## Endpoints

- **Profile (requires cookie; not used for submission sync)**
  - **URL**: `https://utilapi.geeksforgeeks.org/api/user/profile/`
  - **Auth**: User’s GeeksforGeeks cookie.
  - **Usefulness**: Confirms logged-in user + decoded payload (`handle`, `uuid`, etc).

- **User problem submissions (no cookie — used for assignment checks)**
  - **URL**: `https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/`
  - **Auth**: None; **body** carries the handle.
  - **Request**:
    - **Body**:
      - `{ "handle": "<gfg_handle>", "requestType": "", "year": "", "month": "" }`
      - Optional year-wise:
        - `{ "handle": "<gfg_handle>", "requestType": "getYearwiseUserSubmissions", "year": "2026", "month": "" }`
  - **Response (shape)**:
    - `result` groups solved items by difficulty (e.g. `Basic`, `Easy`, `Medium`, `Hard`, `School`).
    - Each entry is keyed by an internal id; typical fields include:
      - **`slug`** — problem slug (matches URL path under `/problems/<slug>/`)
      - **`pname`**, **`lang`**
      - **`user_subtime`** — string timestamp for the solve (e.g. `"2025-07-23 08:33:27"`). Used as **`submissionTime`** when present.
  - **Assignment logic (code)**:
    - One POST per user per batch; build **slug → earliest `Date` from `user_subtime`** (if a slug appears more than once, keep the earliest).
    - Mark **completed** only if `user_subtime` parses and **`submissionTime >= assignment.createdAt`**.
    - If `user_subtime` is missing for a row, that solve is not used for auto-completion (we do not fall back to “now”).
  - **Caveat**: GFG may change the payload; if `user_subtime` disappears for some accounts, fewer problems will auto-complete until we adjust.

- **User params info (requires cookie; not used for submission sync)**
  - **URL**: `https://authapi.geeksforgeeks.org/api-get/user-params-info/?handle=<handle>&params=email,handle_update_count,email_change_count,login_source,handle,name,personalized_ads_info`
  - **Auth**: Cookie.
  - **Usefulness**: Account metadata.

- **Per-problem submissions (requires cookie — not used for assignment auto-check)**
  - **URL**: `https://practiceapi.geeksforgeeks.org/api/latest/problems/<problem-slug>/submissions/user/`
  - **Auth**: `gfguserName` cookie (JWT).
  - **Response**: includes per-submission **`subtime`** and `exec_status`.
  - **Note**: We **do not** use this path for assignment submission sync; it remains documented for debugging or future use. Optional **profile** linking may still validate/store a cookie via `POST /api/auth/gfg-credentials`.

## Cookie authentication (optional)

For endpoints that require it, the minimal cookie is **`gfguserName`** (`handle/JWT_TOKEN`). This is **not** required for bulk submission checks.

## Where this is used in code

- **`server/src/services/submission.service.ts`**
  - **`fetchGfgSlugToSubmissionTime(handle)`** — POST bulk API; maps slug → time from **`user_subtime`**.
  - **`getAllGfgSolvedSlugs(handle)`** — same POST; returns slugs with a known time (used e.g. for connectivity-style checks).
  - **`processGfgSubmissions()`** — uses only the bulk map; gates on **`assignment.createdAt`**; still computes on-time / late vs **`assignDate`** / **`dueDate`** for logging.

- **`server/src/api/auth/profile.controller.ts`**
  - **`linkGfgCredentials`** / **`POST /api/auth/gfg-credentials`** — optional cookie link for the student profile (separate from bulk sync).

## Implementation notes

- **DB**: `gfgUsername` is required for bulk checks; `gfgCookie` / `gfgCookieStatus` are for optional profile linking, not for the assignment submission POST flow described above.
