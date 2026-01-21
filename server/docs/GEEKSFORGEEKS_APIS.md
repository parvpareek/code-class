### GeeksforGeeks endpoints (internal notes)

This project integrates with GeeksforGeeks **without cookies** (handle-only) to detect whether a student has solved an assigned GFG problem. We currently do **not** have reliable per-problem timestamps from the public endpoint, so completion time is recorded as the time we detect the solve.

## Endpoints

- **Profile (requires cookie; not usable for us)**
  - **URL**: `https://utilapi.geeksforgeeks.org/api/user/profile/`
  - **Auth**: Requires the user’s GeeksforGeeks cookie.
  - **Usefulness**: Confirms logged-in user + returns decoded payload (`handle`, `uuid`, etc).

- **User problem submissions (no cookie; used by us)**
  - **URL**: `https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/`
  - **Auth**: No cookie required (handle-based).
  - **Request**:
    - **Body**:
      - `{ "handle": "<gfg_handle>", "requestType": "", "year": "", "month": "" }`
      - Optional year-wise:
        - `{ "handle": "<gfg_handle>", "requestType": "getYearwiseUserSubmissions", "year": "2026", "month": "" }`
  - **Response (shape)**:
    - `result` groups solved items by difficulty (e.g. `Basic`, `Easy`, `Medium`, `Hard`, `School`).
    - Each entry contains `{ slug, pname, lang }`.

- **User params info (requires cookie; not usable for us)**
  - **URL**: `https://authapi.geeksforgeeks.org/api-get/user-params-info/?handle=<handle>&params=email,handle_update_count,email_change_count,login_source,handle,name,personalized_ads_info`
  - **Auth**: Requires the user’s GeeksforGeeks cookie.
  - **Usefulness**: Returns `email`, `handle`, and other account metadata.

## Where this is used in code

- **Solved detection**: `server/src/services/submission.service.ts` (`getAllGfgSolvedSlugs`)

