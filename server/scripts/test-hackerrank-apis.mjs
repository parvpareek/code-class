/**
 * Quick HackerRank API probe script.
 *
 * Usage:
 *   HR_USER=parvpareek node server/scripts/test-hackerrank-apis.mjs
 *   HR_USER=parvpareek HR_COOKIE="<value>" node server/scripts/test-hackerrank-apis.mjs
 *
 * Notes:
 * - This script sends `_hrank_session=<HR_COOKIE>` as the Cookie header (same pattern as the server integration).
 * - Many endpoints will return 401/403 without a valid session cookie.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HR_USER = process.env.HR_USER || "parvpareek";
// NOTE: never hardcode `_hrank_session` in the repo; pass it via HR_COOKIE env var instead.
const HR_COOKIE = process.env.HR_COOKIE || "";

const endpoints = [
  {
    name: "profile",
    url: `https://www.hackerrank.com/rest/contests/master/hackers/${HR_USER}/profile`,
  },
  {
    name: "badges",
    url: `https://www.hackerrank.com/rest/hackers/${HR_USER}/badges`,
  },
  {
    name: "scores_elo",
    url: `https://www.hackerrank.com/rest/hackers/${HR_USER}/scores_elo`,
  },
  {
    name: "hacker_companies",
    url: `https://www.hackerrank.com/community/v1/hackers/${HR_USER}/hacker_companies`,
  },
  {
    name: "hacker_schools",
    url: `https://www.hackerrank.com/community/v1/hackers/${HR_USER}/hacker_schools`,
  },
  {
    name: "links",
    url: `https://www.hackerrank.com/rest/hackers/${HR_USER}/links`,
  },
  {
    name: "skills",
    url: `https://www.hackerrank.com/rest/hackers/${HR_USER}/skills`,
  },
  {
    name: "challenges_unsolved_algorithms",
    url: "https://www.hackerrank.com/rest/contests/master/tracks/algorithms/challenges?offset=0&limit=10&filters%5Bstatus%5D%5B%5D=unsolved&track_login=true",
  },
  {
    name: "challenges_graph_theory_algorithms",
    url: "https://www.hackerrank.com/rest/contests/master/tracks/algorithms/challenges?offset=20&limit=10&filters%5Bsubdomains%5D%5B%5D=graph-theory&track_login=true",
  },
];

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeJson(obj) {
  if (obj === null || obj === undefined) return { type: "null" };
  if (Array.isArray(obj)) {
    return {
      type: "array",
      length: obj.length,
      sampleKeys: obj[0] && typeof obj[0] === "object" ? Object.keys(obj[0]).slice(0, 12) : undefined,
    };
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    const summary = { type: "object", keys: keys.slice(0, 25) };
    for (const k of ["model", "models", "data", "result", "errors", "message", "status"]) {
      if (k in obj) summary[`has_${k}`] = true;
    }
    if (Array.isArray(obj.models)) summary.models_length = obj.models.length;
    if (obj.model && typeof obj.model === "object") summary.model_keys = Object.keys(obj.model).slice(0, 20);
    if (obj.data && typeof obj.data === "object") summary.data_keys = Object.keys(obj.data).slice(0, 20);
    return summary;
  }
  return { type: typeof obj };
}

async function fetchOne({ name, url }) {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Referer: "https://www.hackerrank.com/",
    Origin: "https://www.hackerrank.com",
  };

  if (HR_COOKIE) {
    headers.Cookie = `_hrank_session=${HR_COOKIE}`;
  }

  const res = await fetch(url, { headers, redirect: "follow" });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  const json = contentType.includes("application/json") ? safeJsonParse(text) : safeJsonParse(text);

  return {
    name,
    url,
    status: res.status,
    ok: res.ok,
    contentType,
    summary: json ? summarizeJson(json) : { type: "non-json", bytes: text.length },
    json,
    rawTextSample: json ? undefined : text.slice(0, 300),
  };
}

async function main() {
  const outDir = path.join(__dirname, "out", `hackerrank-${HR_USER}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`HR_USER=${HR_USER}`);
  console.log(`HR_COOKIE=${HR_COOKIE ? "[set]" : "[not set]"}`);
  console.log(`Saving responses under: ${outDir}`);

  const results = [];
  for (const e of endpoints) {
    try {
      const r = await fetchOne(e);
      results.push(r);
      console.log(`- ${e.name}: ${r.status} ${r.ok ? "OK" : "FAIL"} (${r.contentType || "no content-type"})`);
      console.log(`  summary: ${JSON.stringify(r.summary)}`);
      fs.writeFileSync(path.join(outDir, `${e.name}.json`), JSON.stringify(r.json ?? { raw: r.rawTextSample }, null, 2));
    } catch (err) {
      console.log(`- ${e.name}: ERROR ${(err && err.message) || String(err)}`);
      results.push({ name: e.name, url: e.url, error: (err && err.message) || String(err) });
    }
  }

  fs.writeFileSync(path.join(outDir, `index.json`), JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


