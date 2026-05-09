---
name: extract-requirements
description: 'FOUNDATION — use before any ADR, research, plan, or brainstorm. Converts a vague goal into measurable, prioritized requirements. Always the first skill in the decision-making pipeline.'
license: Apache-2.0
metadata:
  author: numica
  version: '1.0.0'
  tags: [decision-making, requirements, adr]
compatibility: Any
allowed-tools: Read, Write, Edit
---

# extract-requirements

Convert a vague goal into measurable, prioritized requirements before any decision work begins.

## Process

1. Identify the **system boundary** — what's inside, what's outside
2. Identify **hard constraints** — things we cannot change
3. Convert goals into **measurable requirements** — every requirement must have a way to verify it
4. Separate requirements from **preferences** — must-have vs nice-to-have
5. Assign **priority** to each requirement
6. Select from the **requirements catalog** — pick only what can change this decision

## Requirement Quality Rules

- Every requirement MUST be verifiable: "auto-merge" is vague; "all updates merge without manual action when CI passes" is measurable
- Every requirement MUST have a success criterion
- If a requirement can't be measured → it's a preference, move it to trade-offs
- **Quantify the problem** with actual numbers when possible (e.g., "~170 conversion sites across 60 columns" not "many places")
- If a requirement has no defined threshold → **record it as an open question** for the decision maker

## Requirement Priority

| Priority        | Meaning                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Must-have**   | Decision fails without this. Non-negotiable.                                                   |
| **Should-have** | Strongly desired. Would accept a workaround.                                                   |
| **Could-have**  | Nice to have. Does not materially change the decision unless options are otherwise very close. |

A ❌ on a must-have eliminates an option. A ❌ on a could-have does not.

## Requirements Catalog

Do not include catalog items by default — include them only if they can change the decision.

### Cost

| Requirement            | How to measure                                                |
| ---------------------- | ------------------------------------------------------------- |
| Service subscription   | $/month or $/seat/month for the plan we'd use                 |
| Usage/operational cost | CI minutes, API calls, storage — projected monthly spend      |
| Per-transaction cost   | $/transaction at our typical transaction size                 |
| Free tier limits       | What's included; when you start paying                        |
| Cost scaling           | How cost changes when team/usage grows                        |
| Human time cost        | Hours/month of manual work the solution creates or eliminates |
| Migration effort       | Developer-days to switch if we leave this provider            |
| Boilerplate cost       | Lines of code or conversion sites per new field/entity added  |

### Compliance & Security

| Requirement                 | How to measure                                                                   |
| --------------------------- | -------------------------------------------------------------------------------- |
| Geographic restrictions     | Blocked countries/IPs (e.g., Russian IPs, sanctioned regions)                    |
| Revenue thresholds          | Plan changes triggered by company revenue                                        |
| Data residency              | Where data is stored; EU/US/other requirements                                   |
| Access permissions          | Repo/org/infra access the solution needs                                         |
| Security certifications     | SOC 2, ISO 27001, GDPR compliance                                                |
| Regulatory authorization    | Is the provider authorized by the relevant authority (e.g., IRS e-file)          |
| Account approval likelihood | Historical approval rate for companies like ours                                 |
| License compatibility       | Compatible with our usage model (self-hosted, redistributed, etc.)               |
| Supply chain protection     | Quarantine/age-gate for new package versions; defense against malicious releases |

### Technical Fit

| Requirement              | How to measure                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| Stack compatibility      | Works with our specific stack (verify against actual configs)          |
| Monorepo support         | Single lockfile awareness, cross-workspace behavior                    |
| Configuration complexity | Concepts to learn, files to maintain, time to initial setup            |
| API/SDK quality          | Documentation, type safety, examples, error messages                   |
| API completeness         | Covers full lifecycle (CRUD + async operations + corrections)          |
| Webhook support          | Async status updates without polling                                   |
| Documentation quality    | Developer self-service possible without support tickets                |
| Deployment model         | Docker-native vs dedicated VM/instance; compatible with existing infra |

### Operational

| Requirement          | How to measure                                                  |
| -------------------- | --------------------------------------------------------------- |
| Automation level     | Manual steps required in the workflow                           |
| Debuggability        | Can you identify what broke and why without reading source code |
| Failure isolation    | One failure blocks only itself, not everything                  |
| Rollback granularity | Can revert one change independently                             |
| Backlog handling     | Behavior when starting with accumulated debt                    |
| Time to market       | Feedback loop speed (pipeline time, deploy time)                |
| System complexity    | Number of states × layer boundaries; fewer is better            |

### Vendor & Support

| Requirement         | How to measure                                      |
| ------------------- | --------------------------------------------------- |
| Vendor lock-in      | Migration effort in developer-days to switch        |
| Community/support   | Response time, docs quality, active maintenance     |
| Long-term viability | Funding, adoption trajectory, maintenance frequency |

## Output

System boundary, hard constraints, requirements table (with priorities and success criteria)
