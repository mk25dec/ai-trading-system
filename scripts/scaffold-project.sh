#!/usr/bin/env bash
# Scaffold a product repo from agent-development library.
# Usage: ./scripts/scaffold-project.sh --profile minimal --target ../my-product

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="minimal"
TARGET=""

usage() {
  echo "Usage: $0 --profile <name> --target <path>"
  echo "Profiles: docs/profiles/*.yaml"
  exit 1
}

copy_skill() {
  local name="$1"
  if [[ -d "$ROOT/.cursor/skills/$name" ]]; then
    cp -R "$ROOT/.cursor/skills/$name" "$TARGET/.cursor/skills/"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown: $1"; usage ;;
  esac
done

[[ -n "$TARGET" ]] || usage
[[ -f "$ROOT/docs/profiles/${PROFILE}.yaml" ]] || { echo "Profile not found: $PROFILE"; exit 1; }

echo "Scaffolding profile '$PROFILE' → $TARGET"

mkdir -p "$TARGET"/{docs/project/issues,docs/project/feedback,docs/project/retrospectives,docs/adr,.cursor/rules,.cursor/agents,.cursor/skills,.github/workflows,.github/ISSUE_TEMPLATE}

# Core alwaysApply rules (minimal profile)
CORE_RULES=(
  orchestration.mdc
  harness-discipline.mdc
  agent-behavior.mdc
  security.mdc
  testing.mdc
  agents.mdc
  observability.mdc
  github-issues-workflow.mdc
  lifecycle-change.mdc
  harness-artifacts.mdc
  coding-style.mdc
  code-review.mdc
)
for r in "${CORE_RULES[@]}"; do
  [[ -f "$ROOT/.cursor/rules/$r" ]] && cp "$ROOT/.cursor/rules/$r" "$TARGET/.cursor/rules/"
done

# Core agents
CORE_AGENTS=(planner.md architect.md generator.md code-reviewer.md frontend-evaluator.md doc-updater.md)
for a in "${CORE_AGENTS[@]}"; do
  cp "$ROOT/.cursor/agents/$a" "$TARGET/.cursor/agents/"
done

# Profile-specific agents
if [[ "$PROFILE" == "nextjs-app" ]]; then
  for a in api-reviewer.md security-reviewer.md performance-evaluator.md database-reviewer.md; do
    cp "$ROOT/.cursor/agents/$a" "$TARGET/.cursor/agents/"
  done
  mkdir -p "$TARGET/.cursor/rules/typescript" "$TARGET/.cursor/rules/web"
  cp "$ROOT/.cursor/rules/typescript/"*.mdc "$TARGET/.cursor/rules/typescript/" 2>/dev/null || true
  cp "$ROOT/.cursor/rules/web/"*.mdc "$TARGET/.cursor/rules/web/" 2>/dev/null || true
  for s in nextjs-turbopack frontend-patterns api-design postgres-patterns database-migrations security-review coding-standards; do
    copy_skill "$s"
  done
fi

if [[ "$PROFILE" == "mcp-server" ]]; then
  for a in api-reviewer.md mcp-reviewer.md security-reviewer.md; do
    cp "$ROOT/.cursor/agents/$a" "$TARGET/.cursor/agents/"
  done
  mkdir -p "$TARGET/.cursor/rules/typescript"
  cp "$ROOT/.cursor/rules/typescript/"*.mdc "$TARGET/.cursor/rules/typescript/" 2>/dev/null || true
  for s in mcp-server-patterns api-design security-review; do
    copy_skill "$s"
  done
fi

# Core workflow skills (all profiles)
CORE_SKILLS=(
  subagent-driven-development
  test-driven-development
  verification-before-completion
  receiving-code-review
  systematic-debugging
  architecture-decision-records
  git-workflow
  github-issues-workflow
  documentation-lookup
  mcp-server-patterns
)
for s in "${CORE_SKILLS[@]}"; do
  copy_skill "$s"
done
[[ -f "$ROOT/.cursor/skills/README.md" ]] && cp "$ROOT/.cursor/skills/README.md" "$TARGET/.cursor/skills/"

# Hooks
cp -R "$ROOT/.cursor/hooks" "$TARGET/.cursor/"
cp "$ROOT/.cursor/hooks.json" "$TARGET/.cursor/"
chmod +x "$TARGET/.cursor/hooks/"*.py 2>/dev/null || true

# MCP template → product .cursor/mcp.json (user fills env)
if [[ -f "$ROOT/.cursor/mcp.json.template" ]]; then
  cp "$ROOT/.cursor/mcp.json.template" "$TARGET/.cursor/mcp.json"
  echo "Copied MCP template → .cursor/mcp.json — set CONTEXT7_API_KEY and GITHUB_TOKEN in env."
fi

# Docs templates (library dogfood under docs/project/*.md is NOT copied)
cp -R "$ROOT/docs/project/templates" "$TARGET/docs/project/"
cp "$ROOT/docs/project/templates/CHANGELOG.md" "$TARGET/CHANGELOG.md"
cp "$ROOT/docs/project/templates/eval-rubric.md" "$TARGET/docs/project/eval-rubric.md"
cp "$ROOT/docs/adr/README.md" "$ROOT/docs/adr/template.md" "$TARGET/docs/adr/"
cp "$ROOT/docs/project/README.md" "$TARGET/docs/project/"
cp "$ROOT/docs/project/feedback/README.md" "$TARGET/docs/project/feedback/"
[[ -f "$ROOT/docs/project/DOGFOOD.md" ]] && cp "$ROOT/docs/project/DOGFOOD.md" "$TARGET/docs/project/DOGFOOD.md"

# GitHub
[[ -f "$ROOT/.github/pull_request_template.md" ]] && cp "$ROOT/.github/pull_request_template.md" "$TARGET/.github/"
if [[ -d "$ROOT/.github/ISSUE_TEMPLATE" ]]; then
  cp -R "$ROOT/.github/ISSUE_TEMPLATE/"* "$TARGET/.github/ISSUE_TEMPLATE/"
fi
if [[ -f "$ROOT/.github/workflows/ci.yml.template" ]]; then
  cp "$ROOT/.github/workflows/ci.yml.template" "$TARGET/.github/workflows/ci.yml"
fi

# Root files (AGENTS.md; no workflow.md in product repos)
cp "$ROOT/AGENTS.md" "$ROOT/GETTING_STARTED.md" "$TARGET/"
cp "$ROOT/.env.example" "$TARGET/"

echo "Done. Next:"
echo "  cd $TARGET"
echo "  NOTE: Library dogfood (docs/project/project.md etc. in agent-development) was NOT copied."
echo "  Fill docs/project/project.md from docs/project/templates/project.md"
echo "  Fill docs/project/setup.md from docs/project/templates/setup.md"
echo "  Edit .github/workflows/ci.yml to match setup.md CI commands"
echo "  Configure .cursor/mcp.json env vars (Context7, GitHub, Playwright for UI profiles)"