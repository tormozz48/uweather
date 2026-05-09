---
name: evaluate-solutions
description: "Use after alternatives are identified. Research and verify each solution against requirements: functional fit, operational fit, security/compliance fit, technical verification. Does NOT cover financial analysis — that's cost-model."
license: Apache-2.0
metadata:
  author: numica
  version: '1.0.0'
  tags: [decision-making, evaluation, adr]
compatibility: Any
allowed-tools: Read, Write, Edit
---

# evaluate-solutions

Research and verify each solution against requirements. Focuses on functional, operational, and compliance fit. Financial analysis is handled by `cost-model`.

## Process

1. For each alternative, evaluate against every requirement from `extract-requirements`
2. Verify every claim against actual data (not memory, not blog posts)
3. Flag repo-specific assumptions explicitly
4. Record unknowns

## Evidence Quality Hierarchy

Use higher-ranked sources first:

1. Actual repo config, actual metrics, actual billing data
2. Official documentation, pricing pages, policy documents
3. Direct experiments (test it yourself)
4. All other sources — mark as secondary

## Verification Rules

- Monorepo behavior → check actual lockfile and workspace structure
- Feature support → check official documentation
- Pricing → check current pricing page
- CI integration → check actual workflow files
- If you can't verify → mark ⚠️ UNVERIFIED

## Missing Evidence Rules

- If a **must-have** requirement remains unverified for an option → that option cannot be recommended without explicit assumption + mitigation
- If multiple must-haves remain unverified across all options → frame the decision as **Provisional**

## Unknowns / Assumptions

If critical claims remain unverified, record them explicitly:

- In **Context** — if it's an assumption the whole decision rests on
- In **Trade-offs** — if it's a risk of the chosen option
- In **Next Steps** — if it can be verified during implementation

## Operational Concerns Checklist

Always run through before finalizing:

- [ ] Debuggability — can you tell what broke?
- [ ] Failure isolation — does one failure block everything?
- [ ] Rollback granularity — can you revert one change without all?
- [ ] Grouping strategy — separate by type, not "one mega-group"
- [ ] Backlog handling — what happens on first install?
- [ ] Compliance — does the solution work from our locations and revenue level?

## Output

Verified claims, unverified claims with assumptions, per-requirement evaluation matrix draft
