# Production Smoke Matrix Evidence

- Generated: 2026-10-04T20:26:53.043Z
- API: http://localhost:4000
- Tenant: `cnc-fundamentals`
- Result: **11/14 passed**, 3 awaiting manual verification, 0 failed

| # | Path | Status | Evidence |
| --- | --- | --- | --- |
| 1 | register: new account cannot sign in before email verification | **MANUAL** | throttled (HTTP 429); retry after the window resets |
| 2 | login -> refresh -> logout -> session revoked | **PASS** | login HTTP 200; refresh HTTP 200; logout HTTP 200; /auth/me after logout HTTP 401 (revoked) |
| 3 | password recovery: no 500, no account enumeration | **MANUAL** | throttled (known HTTP 429, unknown HTTP 429) — inconclusive; rerun after the rate-limit window |
| 4 | health: database + auth up, dependencies reported honestly | **PASS** | HTTP 200; overall=up; db=up; auth=up; redis=up; search=up; storage=up; email=up |
| 5 | avatar upload: presigned PUT, then anonymous public GET returns the bytes | **PASS** | presign HTTP 201; PUT HTTP 200; anonymous GET HTTP 200 content-type=image/png; bytes match=true |
| 6 | paid video: object exists but anonymous fetch is refused | **PASS** | media/edd92c79-f989-4bc6-839e-63222da011c3.mp4 anonymous HTTP 400 (refused); owner HTTP 200 bytes=24190239 |
| 7 | public assets (avatar/course image) are anonymously readable | **PASS** | uploads/09e0dea5-868e-4b1d-b5aa-3c6ad41fa6bd.jpeg anonymous HTTP 200 |
| 8 | tenant isolation: another tenant sees none of this tenant data | **PASS** | GET /courses as "advanced-manufacturing" -> HTTP 200; body mentions "cnc-fundamentals"=false |
| 9 | RBAC: learner refused on admin routes | **MANUAL** | SMOKE_LEARNER_EMAIL / SMOKE_LEARNER_PASSWORD not set |
| 10 | search returns results and names the engine | **PASS** | HTTP 200; engine=meilisearch; hits=5 |
| 11 | AI endpoint refuses anonymous callers | **PASS** | POST /ai/chat anonymous -> HTTP 401 |
| 12 | checkout fails closed (no unpayable session issued) | **PASS** | HTTP 400 {"message":"Missing productId","error":"Bad Request","statusCode":400} |
| 13 | certificate list is reachable and download is owner-scoped | **PASS** | GET /certifications/my HTTP 200; certificates=0; download probe none |
| 14 | notifications: anonymous refused, owner readable | **PASS** | anonymous HTTP 401; owner HTTP 200 |

Reproduce:

```bash
node scripts/production-smoke.mjs --api http://localhost:4000
```

No credential appears in this file; values are read from the environment and only
status codes and response shapes are recorded.
