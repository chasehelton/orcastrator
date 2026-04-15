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

// ─── Wave tape (scrolling water surface) ──────────────────────────────────────
const TAPE     = "﹏﹏⊹˖﹏﹏·﹏﹏˖﹏﹏·﹏⊹﹏﹏˖·⊹˖﹏﹏";
const TAPE_LEN = TAPE.length;
const ROW_W    = 36;

function colorWaveChar(ch: string): string {
  switch (ch) {
    case "⊹": return sparkW(ch);
    case "˖": return waveD(ch);
    case "·": return dot(ch);
    default:  return wave(ch);
  }
}

function waveRow(offset: number): string {
  const norm = ((offset % TAPE_LEN) + TAPE_LEN) % TAPE_LEN;
  const src  = TAPE + TAPE + TAPE;
  return [...src.slice(norm, norm + ROW_W)].map(colorWaveChar).join("");
}

// ─── Bubble patterns ─────────────────────────────────────────────────────────
// Each pattern is ROW_W wide; spaces are empty water.
const BUBBLE_ROWS = [
  "        ◦               °           ",
  "   °          ○       ◦        °    ",
  "          ◦        °        ○       ",
  "     ○         ◦          °     ◦   ",
  "  ◦        °         ○         ◦    ",
  "       °        ◦        ○         °",
  "   ○       ◦          °       ○     ",
  "        °        ○       ◦         °",
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
  const row = BUBBLE_ROWS[(index + tick) % BUBBLE_ROWS.length];
  return [...row].map(colorBubbleChar).join("");
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
  const M = "  ";

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
