// orca-animation.ts — underwater dive-in transition for chat welcome
// Bubbles rise, waves wash over, then settle — like submerging into the session.

import chalk from "chalk";

const ESC         = "\x1b";
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE  = `${ESC}[2K`;
const MOVE_UP     = (n: number) => `${ESC}[${n}A`;

// ─── Palette ──────────────────────────────────────────────────────────────────
const wave   = chalk.cyan;
const waveD  = chalk.dim.cyan;
const bub    = chalk.bold.cyan;
const bubD   = chalk.dim.cyan;
const sparkW = chalk.bold.white;
const dot    = chalk.dim.magenta;

// ─── Terminal width helper ─────────────────────────────────────────────────────
const MARGIN = 2; // left padding ("  ")

function getContentWidth(): number {
  const cols = process.stdout.columns || 80;
  return cols - MARGIN;
}

// Visual width of a single character (﹏ is East Asian Wide = 2 columns)
function charWidth(ch: string): number {
  return ch === "﹏" ? 2 : 1;
}

// ─── Wave tape (scrolling water surface) ──────────────────────────────────────
const TAPE     = "﹏﹏⊹˖﹏﹏·﹏﹏˖﹏﹏·﹏⊹﹏﹏˖·⊹˖﹏﹏";
const TAPE_LEN = TAPE.length;

function colorWaveChar(ch: string): string {
  switch (ch) {
    case "⊹": return sparkW(ch);
    case "˖": return waveD(ch);
    case "·": return dot(ch);
    default:  return wave(ch);
  }
}

function waveRow(offset: number): string {
  const targetW = getContentWidth();
  const norm = ((offset % TAPE_LEN) + TAPE_LEN) % TAPE_LEN;
  const src  = TAPE.repeat(Math.ceil((targetW + TAPE_LEN) / TAPE_LEN));
  const chars: string[] = [];
  let vis = 0;
  for (let i = norm; vis < targetW && i < src.length; i++) {
    const ch = src[i];
    const w  = charWidth(ch);
    if (vis + w > targetW) break;
    chars.push(colorWaveChar(ch));
    vis += w;
  }
  return chars.join("");
}

// ─── Bubble patterns ─────────────────────────────────────────────────────────
// Bubble positions are defined as fractional offsets (0–1) within the row width.
// Each entry is [fraction, char]. Generated at render time to fit terminal width.
const BUBBLE_SEEDS: Array<Array<[number, string]>> = [
  [[0.22, "◦"], [0.55, "°"]],
  [[0.08, "°"], [0.36, "○"], [0.61, "◦"], [0.86, "°"]],
  [[0.28, "◦"], [0.53, "°"], [0.78, "○"]],
  [[0.14, "○"], [0.39, "◦"], [0.64, "°"], [0.83, "◦"]],
  [[0.06, "◦"], [0.28, "°"], [0.53, "○"], [0.78, "◦"]],
  [[0.19, "°"], [0.42, "◦"], [0.64, "○"], [0.89, "°"]],
  [[0.08, "○"], [0.31, "◦"], [0.58, "°"], [0.81, "○"]],
  [[0.22, "°"], [0.47, "○"], [0.69, "◦"], [0.89, "°"]],
];

function colorBubbleChar(ch: string): string {
  switch (ch) {
    case "○": return bub(ch);
    case "◦": return bubD(ch);
    case "°": return bubD(ch);
    default:  return " ";
  }
}

function bubbleRow(index: number, tick: number): string {
  const w = getContentWidth();
  const seed = BUBBLE_SEEDS[(index + tick) % BUBBLE_SEEDS.length];
  const row = Array(w).fill(" ");
  for (const [frac, ch] of seed) {
    const pos = Math.min(Math.floor(frac * w), w - 1);
    row[pos] = ch;
  }
  return row.map(colorBubbleChar).join("");
}

// ─── Frame assembly ──────────────────────────────────────────────────────────
// The "dive" effect: waves at top, then bubble rows fill in from bottom to top
// as if the viewport is sinking underwater.

const TOTAL_ROWS = 8; // visible height of the animation region

interface Frame {
  lines: string[];
}

function buildFrame(tick: number, waveCount: number, bubbleCount: number): Frame {
  const lines: string[] = [];
  const M = " ".repeat(MARGIN);

  // Wave rows at the top
  for (let i = 0; i < waveCount; i++) {
    lines.push(M + waveRow(tick * 2 + i * 3));
  }

  // Bubble rows fill remaining space
  for (let i = 0; i < bubbleCount; i++) {
    lines.push(M + bubbleRow(i, tick));
  }

  return { lines };
}

// ─── In-place renderer ────────────────────────────────────────────────────────
let frameHeight = 0;

function renderFrame(lines: string[]): void {
  if (frameHeight > 0) process.stdout.write(MOVE_UP(frameHeight));
  for (const line of lines) {
    process.stdout.write(CLEAR_LINE + line + "\n");
  }
  // Clear leftover lines from the previous (taller) frame
  const extra = frameHeight - lines.length;
  for (let i = 0; i < extra; i++) {
    process.stdout.write(CLEAR_LINE + "\n");
  }
  // Move back up past the blank lines so subsequent frames stay anchored
  if (extra > 0) process.stdout.write(MOVE_UP(extra));
  frameHeight = lines.length;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function playOrcaAnimation(): Promise<void> {
  process.stdout.write(HIDE_CURSOR + "\n");
  frameHeight = 0;

  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // Phase 1: Bubbles rise from nothing (0 → TOTAL_ROWS bubble rows)
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    renderFrame(buildFrame(i, 0, i).lines);
    await delay(50);
  }

  // Phase 2: Waves crash in from top, pushing bubbles down
  for (let w = 1; w <= 3; w++) {
    const b = TOTAL_ROWS - w;
    renderFrame(buildFrame(w + TOTAL_ROWS, w, b).lines);
    await delay(70);
  }

  // Phase 3: Underwater — waves scroll, bubbles drift (~1s)
  for (let tick = 0; tick < 14; tick++) {
    renderFrame(buildFrame(tick + TOTAL_ROWS + 3, 3, TOTAL_ROWS - 3).lines);
    await delay(70);
  }

  // Phase 4: Settle — fade out rows from bottom to top
  for (let remove = 1; remove <= TOTAL_ROWS; remove++) {
    const remaining = TOTAL_ROWS - remove;
    const w = Math.min(3, remaining);
    const b = remaining - w;
    if (remaining > 0) {
      renderFrame(buildFrame(remove + 30, w, b).lines);
    } else {
      renderFrame([""]);
    }
    await delay(40);
  }

  // Clear residual
  if (frameHeight > 0) {
    process.stdout.write(MOVE_UP(frameHeight));
    for (let i = 0; i < frameHeight; i++) {
      process.stdout.write(CLEAR_LINE + "\n");
    }
    process.stdout.write(MOVE_UP(frameHeight));
    frameHeight = 0;
  }

  process.stdout.write(SHOW_CURSOR);
}
