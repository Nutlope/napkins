/**
 * End-to-end stream repro — hits the actual Next.js API route
 * exactly like the browser does, tracking:
 *
 *  1. Chunks received vs time (detect stalls)
 *  2. Whether the stream closes cleanly
 *  3. Whether the resulting code compiles
 *  4. Simulates abort scenarios (tab close, network drop)
 *
 * Usage: npx tsx scripts/repro-e2e-stream.ts [image] [runs] [scenario]
 *   scenarios: normal, abort-mid, abort-late, slow-read
 */
import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { stripFences, countDelimiters } from '../lib/code-utils';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const imageName = process.argv[2] || 'control-panel.png';
const totalRuns = parseInt(process.argv[3] || '2', 10);
const scenario = process.argv[4] || 'normal';

// We need a public URL for the image. Encode as data URI for local testing.
const imageBase64 = `data:image/png;base64,${fs
  .readFileSync(path.join(FIXTURES_DIR, imageName))
  .toString('base64')}`;

interface StreamEvent {
  time: number; // ms since start
  bytes: number;
  cumBytes: number;
}

interface RunResult {
  run: number;
  scenario: string;
  events: StreamEvent[];
  totalBytes: number;
  totalChars: number;
  code: string;
  httpStatus: number;
  streamError: string | null;
  compiles: boolean;
  compileError?: string;
  hasDefaultExport: boolean;
  braces: number;
  parens: number;
  elapsed: number;
  stalls: { afterMs: number; stallMs: number }[];
  abortedAt?: number;
}

async function singleRun(run: number): Promise<RunResult> {
  const start = Date.now();
  const events: StreamEvent[] = [];
  let totalBytes = 0;
  let code = '';
  let streamError: string | null = null;
  let abortedAt: number | undefined;

  const controller = new AbortController();

  // Scenario: abort mid-stream
  let abortTimer: ReturnType<typeof setTimeout> | undefined;
  if (scenario === 'abort-mid') {
    // Abort after 10s — should be mid-generation
    abortTimer = setTimeout(() => {
      abortedAt = Date.now() - start;
      controller.abort();
    }, 10_000);
  } else if (scenario === 'abort-late') {
    // Abort after 60s — near end for small images, mid for large
    abortTimer = setTimeout(() => {
      abortedAt = Date.now() - start;
      controller.abort();
    }, 60_000);
  }

  let httpStatus = 0;
  try {
    const res = await fetch(`${BASE_URL}/api/generateCode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'moonshotai/Kimi-K2.5',
        shadcn: false,
        imageUrl: imageBase64,
      }),
      signal: controller.signal,
    });

    httpStatus = res.status;
    if (!res.ok) {
      streamError = `HTTP ${res.status}: ${await res.text()}`;
    } else if (!res.body) {
      streamError = 'No response body';
    } else {
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let lastChunkTime = Date.now();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        // Scenario: slow-read simulates a slow client
        if (scenario === 'slow-read') {
          await new Promise((r) => setTimeout(r, 100));
        }

        const now = Date.now();
        const bytes = new TextEncoder().encode(value).length;
        totalBytes += bytes;
        events.push({
          time: now - start,
          bytes,
          cumBytes: totalBytes,
        });

        // Filter out thinking markers, collect code
        let text = value;
        text = text.replace(/__THINKING__/g, '');
        text = text.replace(/__DONE_THINKING__/g, '');
        // Skip reasoning lines
        if (!text.startsWith('__REASON__')) {
          code += text;
        }

        lastChunkTime = now;
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      streamError = `aborted at ${abortedAt}ms`;
    } else {
      streamError = e.message?.slice(0, 200) || 'unknown';
    }
  }

  if (abortTimer) clearTimeout(abortTimer);

  const elapsed = Date.now() - start;

  // Detect stalls (>5s between chunks)
  const stalls: { afterMs: number; stallMs: number }[] = [];
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].time - events[i - 1].time;
    if (gap > 5000) {
      stalls.push({ afterMs: events[i - 1].time, stallMs: gap });
    }
  }

  const stripped = stripFences(code);
  const { braces, parens } = countDelimiters(stripped);
  const hasDefaultExport = stripped.includes('export default');

  let compiles = false;
  let compileError: string | undefined;
  if (stripped.length > 0) {
    try {
      esbuild.transformSync(stripped, { loader: 'tsx' });
      compiles = true;
    } catch (e: any) {
      compileError = e.message?.split('\n')[0] || 'esbuild_error';
    }
  }

  return {
    run,
    scenario,
    events,
    totalBytes,
    totalChars: code.length,
    code,
    httpStatus,
    streamError,
    compiles,
    compileError,
    hasDefaultExport,
    braces,
    parens,
    elapsed,
    stalls,
    abortedAt,
  };
}

async function main() {
  console.log(`Target: ${BASE_URL}/api/generateCode`);
  console.log(`Model: moonshotai/Kimi-K2.5`);
  console.log(`Image: ${imageName}`);
  console.log(`Scenario: ${scenario}`);
  console.log(`Runs: ${totalRuns}\n`);

  const results: RunResult[] = [];

  for (let i = 1; i <= totalRuns; i++) {
    console.log(`--- Run ${i}/${totalRuns} (${scenario}) ---`);
    const result = await singleRun(i);
    results.push(result);

    const issues: string[] = [];
    if (result.streamError) issues.push(`STREAM_ERROR: ${result.streamError}`);
    if (result.stalls.length > 0)
      issues.push(`${result.stalls.length} STALLS (${result.stalls.map((s) => `${(s.stallMs / 1000).toFixed(1)}s@${(s.afterMs / 1000).toFixed(0)}s`).join(', ')})`);
    if (result.braces !== 0) issues.push(`braces=${result.braces}`);
    if (result.parens !== 0) issues.push(`parens=${result.parens}`);
    if (!result.hasDefaultExport && result.totalChars > 0) issues.push('NO_DEFAULT_EXPORT');
    if (!result.compiles && result.totalChars > 0) issues.push('COMPILE_ERROR');

    const label = issues.length > 0 ? `ISSUES: ${issues.join(', ')}` : 'OK';
    console.log(
      `  HTTP ${result.httpStatus} | ${result.totalChars} chars | ${result.events.length} chunks | ${(result.elapsed / 1000).toFixed(1)}s => ${label}`
    );
    if (result.compileError) console.log(`  compile: ${result.compileError}`);

    // Save broken outputs for inspection
    if (issues.length > 0 && result.code.length > 0) {
      const outPath = path.join(__dirname, `../repro-broken-run${i}.tsx`);
      fs.writeFileSync(outPath, result.code);
      console.log(`  saved broken output to ${outPath}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  const ok = results.filter(
    (r) => !r.streamError && r.compiles && r.stalls.length === 0 && r.braces === 0 && r.parens === 0
  );
  const broken = results.filter((r) => r !== ok.find((o) => o.run === r.run));
  console.log(`OK: ${ok.length}/${results.length}`);
  console.log(`Broken: ${broken.length}/${results.length}`);

  if (broken.length > 0) {
    console.log('\nBroken breakdown:');
    for (const r of broken) {
      console.log(
        `  Run ${r.run}: error=${r.streamError || 'none'} stalls=${r.stalls.length} braces=${r.braces} parens=${r.parens} compiles=${r.compiles} chars=${r.totalChars}`
      );
    }
  }

  // Timing analysis
  const avgChunkGaps: number[] = [];
  for (const r of results) {
    if (r.events.length < 2) continue;
    const gaps = [];
    for (let i = 1; i < r.events.length; i++) {
      gaps.push(r.events[i].time - r.events[i - 1].time);
    }
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    avgChunkGaps.push(avg);
    const max = Math.max(...gaps);
    console.log(
      `\n  Run ${r.run} timing: avg chunk gap ${avg.toFixed(0)}ms, max gap ${max.toFixed(0)}ms, total ${(r.elapsed / 1000).toFixed(1)}s`
    );
  }
}

main().catch(console.error);
