---
name: write-decision-record
description: 'Use to produce the final decision document. Consumes output from all previous skills. Produces ADRs, tool selection memos, buy-vs-build notes, and vendor evaluation docs.'
license: Apache-2.0
metadata:
  author: numica
  version: '1.0.0'
  tags: [decision-making, adr, documentation]
compatibility: Any
allowed-tools: Read, Write, Edit
---

# write-decision-record

Produces the final structured decision document. Consumes output from all previous skills in the pipeline.

## Decision Record Structure

Default — mandatory unless the document type explicitly requires adaptation. Optional sections should be omitted unless they materially improve decision clarity:

1. **Product Case** _(optional)_ — real user story with named actors, numbers, workflows; use for product-driven decisions
2. **Problem** — why this matters (2–3 sentences, quantified when possible)
3. **Context** — repo-specific facts, assumptions, prerequisites, unknowns
4. **Requirements** — table from `extract-requirements` (with priority column)
5. **Decision Drivers** — 2–5 factors that actually differentiated the top options (NOT a repeat of requirements — the specific differentiators that tipped the scales)
6. **Alternatives** — one short paragraph per option (1–2 sentences: what it IS). For rejected options that aren't bad — just wrong for now — add: "When [option] would make sense: [conditions]"
7. **Comparison** — requirements as rows, options as columns
8. **Decision** — which option and WHY
9. **Future Migration Path** _(optional)_ — when to reconsider; explicit trigger condition + what migration looks like
10. **Trade-offs** — what you lose by choosing this option
11. **Out of Scope** — explicit boundaries
12. **Next Steps** — architect-level with validation metrics
13. **Updates** _(optional, for living documents)_ — `### YYYY-MM-DD: [title]` with Problem → Decision → Changes

## Comparison Table Rules

- Every row must be a requirement OR a data point supporting a requirement
- Every cell: ✅ / ⚠️ (short note) / ❌ or a number
- No information that doesn't map to a requirement
- A ❌ on a must-have requirement eliminates the option
- An option with ⚠️ UNVERIFIED on a must-have cannot be selected without explicit assumption and mitigation

## Option Descriptions

- 1–2 sentences: what it IS, one key characteristic
- No implementation details, no pricing — that's in the comparison table

## Decision Section

- Avoid categorical language unless factually verifiable and materially important
- Acknowledge the closest alternative's strengths
- State the specific differentiator(s) — one paragraph
- Tag confidence: **Confirmed** (all must-haves verified) / **High confidence** (minor unknowns) / **Provisional** (unverified must-haves remain)

## Next Steps

- Architect-level: WHAT to do, not HOW
- Each step: action + key configuration + why it matters
- Final step: validation gate with timeframe + specific metrics
- Prerequisites go in Context, not here

## Forbidden Patterns

- Avoid code blocks unless a very small snippet is essential; prefer referencing file names instead
- No verbose table cells
- No info without a corresponding requirement
- No implementation-level detail in Next Steps
- No categorical language ("only option", "impossible")

## Quality Checks

- [ ] Every requirement row has a matching comparison table row
- [ ] Every comparison cell is verifiable
- [ ] Decision Drivers section exists with 2–5 items
- [ ] Trade-offs section exists with ≥2 items
- [ ] Out of Scope section exists with ≥2 items
- [ ] Next Steps has a validation step with numbers
- [ ] Unknowns are recorded explicitly (Context, Trade-offs, or Next Steps)
- [ ] Confidence label present on Decision section

## Output

Final structured decision document
