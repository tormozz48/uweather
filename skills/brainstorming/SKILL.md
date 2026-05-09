---
name: brainstorming
description: 'Use BEFORE any creative work - creating features, building components, adding functionality, or modifying behavior in the Numica Platform. Explores user intent, requirements and design before implementation through collaborative dialogue.'
license: Apache-2.0
metadata:
  author: numica
  version: '1.0.0'
  tags: brainstorming planning design requirements
compatibility: Requires filesystem access
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right.

## The Process

### Understanding the Idea

- Check current project state first (files, docs, recent commits)
- Review relevant sections of `AGENTS.md` for the affected area
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible
- Only one question per message
- Focus on: purpose, constraints, success criteria

### Exploring Approaches

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation
- Lead with recommended option and explain why
- Consider existing patterns in the Numica monorepo

### Presenting the Design

- Present in sections of 200-300 words
- Ask after each section whether it looks right
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify

## After the Design

### Documentation

- Write validated design to `plans/YYYY-MM-DD-<topic>-design.md`
- Commit the design document to git

### Implementation Planning

- Ask: "Ready to set up for implementation?"
- Break down into specific tasks
- Identify which apps/packages are affected

## Numica-Specific Considerations

### Where Does It Belong?

```
Feature type -> Location
+-- Shared UI component -> packages/ui/
+-- Shared logic/hook -> packages/web-kit/
+-- API contract -> packages/sdk/
+-- Backend domain -> apps/core/src/domains/
+-- Client feature -> apps/client-web/
+-- Agent feature -> apps/agent-web/
+-- AI workflow -> apps/ai-agent-office/
```

### Architecture Checklist

- Does it follow `AGENTS.md` monorepo structure?
- Are API contracts defined in `@numica/sdk`?
- Does it reuse existing `@numica/ui` components?
- Is it consistent with existing domain patterns?
- Have you checked `packages/ui/` for existing components?

## Key Principles

- **One question at a time** - Don't overwhelm
- **Multiple choice preferred** - Easier to answer
- **YAGNI ruthlessly** - Remove unnecessary features
- **Explore alternatives** - Always propose 2-3 approaches
- **Incremental validation** - Present design in sections
- **Follow existing patterns** - Check `AGENTS.md` and existing code
- **Be flexible** - Go back and clarify when needed
