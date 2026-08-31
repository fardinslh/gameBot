import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const projectDocs = [
  "INDEX.md",
  "PRODUCT.md",
  "ARCHITECTURE.md",
  "CURRENT_STATE.md",
  "GAME_SYSTEMS.md",
  "KINGDOM.md",
  "ECONOMY.md",
  "HEROES.md",
  "ARMY_AND_COMMANDERS.md",
  "RAID_AND_BATTLE.md",
  "REVENGE_AND_NOTIFICATIONS.md",
  "PROGRESSION.md",
  "BUILDING_EVOLUTION.md",
  "RETENTION_ROADMAP.md",
  "DATA_MODEL.md",
  "API_REFERENCE.md",
  "ANALYTICS.md",
  "PLAYER_EXPERIENCE.md",
  "AUDIO.md",
  "AUDIO_AUDITION.md",
  "FRONTEND.md",
  "ASSETS_AND_VISUALS.md",
  "LOCAL_DEVELOPMENT.md",
  "TESTING.md",
  "SECURITY_AND_INTEGRITY.md",
  "DECISIONS.md",
  "ROADMAP.md",
  "KNOWN_ISSUES.md",
  "PLANNER_HANDOFF.md",
  "AI_HANDOFF.md",
];

const failures = [];
const readRequiredFile = (relativePath) => {
  const absolutePath = resolve(repositoryRoot, relativePath);

  try {
    if (!statSync(absolutePath).isFile()) {
      throw new Error("not a file");
    }

    const content = readFileSync(absolutePath, "utf8");
    if (!content.trim()) {
      failures.push(`${relativePath} is empty`);
    }
    return content;
  } catch {
    failures.push(`${relativePath} is missing`);
    return "";
  }
};

for (const fileName of projectDocs) {
  const relativePath = `docs/project/${fileName}`;
  const content = readRequiredFile(relativePath);

  if (content && !content.startsWith("---\n")) {
    failures.push(`${relativePath} is missing YAML frontmatter`);
  }
  if (/\b(?:TODO|TBD|PLACEHOLDER)\b/.test(content)) {
    failures.push(`${relativePath} contains an unfinished marker`);
  }

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) {
      continue;
    }

    const linkedPath = resolve(repositoryRoot, dirname(relativePath), decodeURI(target));
    if (!existsSync(linkedPath)) {
      failures.push(`${relativePath} links to missing target ${target}`);
    }
  }
}

const index = readRequiredFile("docs/project/INDEX.md");
const baselineCommit = "7c67d1b5f1ccc7be220655c829ec9e1a011f2d0f";
if (!index.includes("Last verified against commit") || !index.includes(baselineCommit)) {
  failures.push("docs/project/INDEX.md does not identify the verified gameplay baseline");
}

const requiredLinks = new Map([
  ["README.md", ["docs/project/INDEX.md"]],
  ["docs/project/INDEX.md", ["PLANNER_HANDOFF.md", "AI_HANDOFF.md"]],
  ["AGENTS.md", ["docs/project/INDEX.md", "docs/project/AI_HANDOFF.md"]],
  ["CLAUDE.md", ["docs/project/INDEX.md", "docs/project/AI_HANDOFF.md"]],
  ["GEMINI.md", ["docs/project/INDEX.md", "docs/project/AI_HANDOFF.md"]],
]);

for (const [relativePath, links] of requiredLinks) {
  const content = readRequiredFile(relativePath);
  for (const link of links) {
    if (!content.includes(link)) {
      failures.push(`${relativePath} does not link to ${link}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Project documentation validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Project documentation validation passed (${projectDocs.length} canonical files).`);
}
