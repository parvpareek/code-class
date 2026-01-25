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
  - **Auth**: Requires the user's GeeksforGeeks cookie.
  - **Usefulness**: Returns `email`, `handle`, and other account metadata.

- **Per-problem submissions (requires cookie; provides timestamps)**
  - **URL**: `https://practiceapi.geeksforgeeks.org/api/latest/problems/<problem-slug>/submissions/user/`
  - **Auth**: Requires `gfguserName` cookie (contains JWT token with user auth).
  - **Minimal cookie**: Only `gfguserName` is needed (contains JWT: `handle/JWT_TOKEN`).
  - **Request**: GET request with cookie header.
  - **Response (shape)**:
    ```json
    {
      "results": {
        "id": 700131,
        "problem_name": "Delete in a Doubly Linked List",
        "slug": "delete-node-in-doubly-linked-list",
        "problem_level": 0,
        "problem_level_text": "Easy",
        "submissions": [
          {
            "submission_id": "b6a9514b-f76f-46ab-8512-56b21872a5a2",
            "subtime": "2025-07-20 17:31:58",
            "lang": "cpp",
            "exec_status": "1",
            "exec_status_text": "Correct",
            "testcase_passed": "1111",
            "total_testcase_count": "1111",
            "user_score": "2",
            "correct_submission_sequence": "1"
          }
        ]
      }
    }
    ```
  - **Usefulness**: 
    - ✅ Provides **exact submission timestamps** (`subtime` field)
    - ✅ Shows all submissions (correct + incorrect) for a specific problem
    - ✅ Includes language, test case counts, and submission sequence
    - ⚠️ Requires user's `gfguserName` cookie (JWT token)
  - **Note**: This endpoint can replace the bulk submissions endpoint when we need accurate timestamps, but requires storing user cookies.

## Cookie Authentication

For endpoints requiring authentication, the minimal cookie needed is:
- **`gfguserName`**: Contains JWT token in format `handle/JWT_TOKEN`. This cookie alone is sufficient for authenticated requests.

Example:
```
gfguserName=technophyle%2FeyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...
```

## Where this is used in code

- **Solved detection**: `server/src/services/submission.service.ts` 
  - `processGfgSubmissions()`: Main submission checking logic
    - **With cookie** (`gfgCookieStatus === 'LINKED'`): Uses per-problem API for exact timestamps
    - **Without cookie**: Falls back to bulk API (no timestamps, uses detection time)
  - `getGfgProblemSubmission()`: Fetches single problem submission with timestamp (requires cookie)
  - `getAllGfgSolvedSlugs()`: Bulk API fallback (cookie-less)
  
- **Profile management**: `server/src/api/auth/profile.controller.ts`
  - `linkGfgCredentials()`: Validates and stores user's `gfguserName` cookie
  - `POST /api/auth/gfg-credentials`: Endpoint to link GFG account

## Implementation notes

- Database fields: `gfgCookie` (stores gfguserName value), `gfgCookieStatus` (LINKED/EXPIRED/NOT_LINKED)
- Cookie expiry handling: If per-problem API returns 401/403, automatically marks cookie as EXPIRED and falls back to bulk API
- Submission time accuracy: Cookie-based checks provide exact timestamps; bulk API uses current detection time

