# Applications — 2026-10-01

<!--
MCP feature fixture (MCP-09). Synthetic entries only: no real companies, jobs or answers.
Part A (automated smoke) sends the three `applied` entries through the official MCP SDK client,
using the same values as mcp-daily-applications.json. Part B (owner, Antigravity): copy this file to
the automation repo as applied/2026-10-01/applications.md, adjust field labels to the repo's real
template if they differ, then ask the agent: "sync Career Companion for 2026-10-01" (twice).
Expected: Fabrikam created, Northwind Traders linked, Contoso needs review, Skipped Labs never sent.
Answers below are fixture text and must never reach Career Companion.
-->

### 09:15:00 — Fabrikam — Backend Engineer
- Platform: company_direct
- Application destination: careers.fabrikam.example
- Company: Fabrikam
- Job title: Backend Engineer
- Location: Pune
- Work mode: hybrid
- Job URL: https://careers.fabrikam.example/jobs/123?utm_source=fixture#apply
- Portal job ID: FAB-123
- Discovery source: we_work_remotely
- Resume: resume-fixture.pdf
- Submitted answers: Expected salary FIXTURE-SECRET-ANSWER; notice period 30 days
- Status: applied
- Confirmation: Thank you for applying to Fabrikam.

### 09:32:10 — Northwind Traders Ltd. — Data Engineer
- Platform: linkedin
- Application destination: www.linkedin.com
- Company: Northwind Traders Ltd.
- Job title: Data Engineer
- Location: Remote
- Work mode: remote
- Job URL: https://www.linkedin.com/jobs/view/987/?currentJobId=987&refId=fixture
- Portal job ID: 987
- Discovery source: linkedin
- Resume: resume-fixture.pdf
- Submitted answers: Sponsorship FIXTURE-SECRET-ANSWER
- Status: applied
- Confirmation: Your application was sent to Northwind Traders.

### 10:05:45 — Contoso — Frontend Engineer
- Platform: workday
- Application destination: contoso.wd1.myworkdayjobs.example
- Company: Contoso
- Job title: Frontend Engineer
- Location: Bengaluru
- Work mode: onsite
- Job URL: https://contoso.wd1.myworkdayjobs.example/careers/job/R-55
- Portal job ID: R-55
- Discovery source: indeed
- Resume: resume-fixture.pdf
- Submitted answers: Notice period FIXTURE-SECRET-ANSWER
- Status: applied
- Confirmation: Application submitted.

### 10:20:00 — Skipped Labs — QA Engineer
- Platform: indeed
- Company: Skipped Labs
- Job title: QA Engineer
- Status: skipped
- Reason: Requires on-site work in another city
