// orca-tamagotchi.ts — cute orca character for the orcastrator CLI

import chalk from "chalk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrcaMood = "happy" | "working" | "sleeping" | "excited" | "thinking";

// ─── Palette ──────────────────────────────────────────────────────────────────

const p = {
  body:   chalk.bold.white,
  eye:    chalk.bold.cyan,
  belly:  chalk.dim.white,
  fin:    chalk.bold.white,
  dim:    chalk.dim.white,
  zz:     chalk.dim.blue,
  gear:   chalk.yellow,
  spark:  chalk.bold.cyan,
};

// ─── Mood variants ───────────────────────────────────────────────────────────

interface MoodParts {
  eye:    string;
  mouth:  string;
}

const MOODS: Record<OrcaMood, MoodParts> = {
  happy:    { eye: p.eye("◉"),  mouth: p.body("‿‿")  },
  excited:  { eye: p.eye("★"),  mouth: p.body("▽▽")  },
  working:  { eye: p.eye("◈"),  mouth: p.body("──")  },
  sleeping: { eye: p.dim("–"),  mouth: p.dim("___") },
  thinking: { eye: p.eye("◉"),  mouth: p.body("··")  },
};

// ─── Character renderer ──────────────────────────────────────────────────────
// Returns raw (unboxed) lines — the orca ASCII art only.
// Each line is roughly 20 visible chars. The caller is responsible for
// margins, boxes, or surrounding decoration.

export function renderOrcaCharacter(mood: OrcaMood = "happy"): string[] {
  const { eye, mouth } = MOODS[mood];
  const bd = p.body;
  const fn = p.fin;
  const bl = p.belly;

  return [
    `       ${fn("▲")}           `,
    `      ${fn("█")}${bd("██")}          `,
    `   ${bd("████████████")}    `,
    `   ${bd("█")} ${eye} ${bd("      █")}${bd("▶")}  `,
    `   ${bd("█")}  ${mouth}${bl("   ")}${bd("█")}    `,
    `   ${bd("████████████")}    `,
    `      ${bd("█")}  ${bd("█")}          `,
  ];
}

// ─── Chat greeting — compact character + message ─────────────────────────────

export function renderOrcaGreeting(name = "orcastrator"): string {
  const orca  = renderOrcaCharacter("happy");
  const title = chalk.bold.cyan(`  ✦ ${name} ✦`);
  const sub   = chalk.dim("  Type /help for commands, Ctrl+C to quit.");

  const lines = [
    ...orca,
    title,
    sub,
  ];
  return lines.join("\n");
}
