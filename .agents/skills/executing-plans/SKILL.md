---
name: executing-plans
description: Use when you have a written implementation plan to execute. Each step ends with a verification gate — no gate pass, no next step.
---

# Executing Plans

## Overview

Load plan, verify each step has a defined **verification gate**, execute step by step, run the gate after each step, report when all gates pass.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## Verification Gate Protocol

Every step in the plan MUST define its **verification gate** — the concrete check that proves the step is correct. Standard gates:

| Gate | When | Example |
|------|------|---------|
| **COMPILE** | After type/interface/structure changes | `mvn -q compile`, `pnpm tsc --noEmit` |
| **TEST** | After logic/behavior changes | `mvn -q verify`, `pnpm vitest run` |
| **LINT** | After code style / naming changes | `pnpm lint` |
| **E2E** | After integration / route / API changes | `pnpm playwright test` |
| **JOURNEY** | After E2E spec changes in plans with `journeys[]` | `make journey-coverage` (P0=100%) |
| **MANUAL** | Unavoidable manual verification (rare) | Open browser, check X renders |

**Rule:** If a step's gate fails, **stop and fix**. Do not proceed to the next step.

**Rule:** If a step exceeds ~5 files or ~200 lines changed, **it is too large**. Split the step.

## The Process

### Step 1: Load and Review Plan

1. Read plan file
2. Verify every step has a defined **verification gate**. If not, flag it before starting.
3. Verify step granularity: no step should touch >5 files or >200 lines. If steps are too coarse, call them out.
4. If concerns: raise with your human partner before starting
5. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks with Verification Gates

For each task:

1. **Mark as in_progress**
2. **Read the step's verification gate** from the plan — know what "done" means before starting
3. **Implement** following the plan exactly
4. **Run the verification gate**
   - Gate passes → mark done, proceed to next task
   - Gate fails → **stop**. Fix the issue. Re-run gate. Do NOT start next task.
5. If the step was dispatched to a sub-agent: after merging sub-agent output, run the full verification gate again in main context.
6. **Mark as completed**

**During implementation:**
- Use sub-agents for isolated work (each sub-agent starts with clean context)
- After each sub-agent returns, apply changes and run verification before dispatching the next
- Keep main context lean: contract + current step + verification results. Purge implementation details of completed steps via `/compact` when needed.

### Step 3: Complete Development

After all tasks complete AND all verification gates pass:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- A verification gate keeps failing and root cause is unclear
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking
- A verification gate failure reveals a flaw in the plan itself

**Don't force through blockers** - stop and ask.

## Remember

- Review plan critically first — ensure every step has a gate
- Follow plan steps exactly
- **Never skip a verification gate** — gate pass is the only definition of "done"
- Verification fails → fix NOW, not later. "Fix later" = will be forgotten.
- One red test blocks the next step. No exceptions.
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
- `/compact` between steps when context feels heavy — keep only: plan contract, current step, gate results

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - Ensures isolated workspace (creates one or verifies existing)
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks
