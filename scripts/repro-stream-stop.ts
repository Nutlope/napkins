/**
 * Reproduce the mid-stream stop issue.
 *
 * Runs the same streaming pipeline as the API route and tracks:
 *  - JSON parse failures (chunks silently dropped)
 *  - finish_reason != "stop"
 *  - incomplete code (unbalanced braces, missing default export)
 *
 * Usage: npx tsx scripts/repro-stream-stop.ts [image] [model] [runs]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { together } from '../lib/together-stream';
import { stripFences, countDelimiters } from '../lib/code-utils';
import { getCodingPrompt } from '../lib/prompt';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const imageName = process.argv[2] || 'appointment-booking.png';
const model = process.argv[3] || 'moonshotai/Kimi-K2.5';
const totalRuns = parseInt(process.argv[4] || '3', 10);

const imageBase64 = `data:image/png;base64,${fs
  .readFileSync(path.join(FIXTURES_DIR, imageName))
  .toString('base64')}`;

const codingPrompt = getCodingPrompt(false);

interface RunResult {
  run: number;
  finishReason: string | null;
  totalChunks: number;
  parseFails: number;
  codeLength: number;
  braces: number;
  parens: number;
  hasDefaultExport: boolean;
  compiles: boolean;
  compileError?: string;
  truncated: boolean;
  elapsed: number;
}

async function singleRun(run: number): Promise<RunResult> {
  const start = Date.now();
  let code = '';
  let finishReason: string | null = null;
  let totalChunks = 0;
  let parseFails = 0;

  const res = await (together.chat.completions.create as Function)({
    model,
    temperature: 0.2,
    max_tokens: 65536,
    stream: true,
    reasoning: { enabled: false },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: codingPrompt },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ],
  });

  // Mirror the exact same read path as together-stream.ts
  const reader = res
    .toReadableStream()
    .pipeThrough(new TextDecoderStream())
    .getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalChunks++;

    try {
      const parsed = JSON.parse(value);
      const choice = parsed.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const text = choice.delta?.content || choice.text || '';
      if (text) code += text;
    } catch {
      parseFails++;
      // Log the raw chunk that failed parsing
      if (parseFails <= 5) {
        console.log(
          `  [run ${run}] JSON parse fail #${parseFails}, raw (first 200 chars): ${JSON.stringify(value.slice(0, 200))}`
        );
      }
    }
  }

  const elapsed = Date.now() - start;
  const stripped = stripFences(code);
  const { braces, parens } = countDelimiters(stripped);
  const hasDefaultExport = stripped.includes('export default');

  let compiles = false;
  let compileError: string | undefined;
  try {
    esbuild.transformSync(stripped, { loader: 'tsx' });
    compiles = true;
  } catch (e: any) {
    compileError = e.message?.split('\n')[0] || 'esbuild_error';
  }

  return {
    run,
    finishReason,
    totalChunks,
    parseFails,
    codeLength: code.length,
    braces,
    parens,
    hasDefaultExport,
    compiles,
    compileError,
    truncated: finishReason !== 'stop',
    elapsed,
  };
}

async function main() {
  console.log(`Model: ${model}`);
  console.log(`Image: ${imageName}`);
  console.log(`Runs: ${totalRuns}\n`);

  const results: RunResult[] = [];

  for (let i = 1; i <= totalRuns; i++) {
    console.log(`--- Run ${i}/${totalRuns} ---`);
    try {
      const result = await singleRun(i);
      results.push(result);

      const status = [];
      if (result.truncated) status.push('TRUNCATED');
      if (result.parseFails > 0) status.push(`${result.parseFails} PARSE_FAILS`);
      if (result.braces !== 0) status.push(`braces=${result.braces}`);
      if (result.parens !== 0) status.push(`parens=${result.parens}`);
      if (!result.hasDefaultExport) status.push('NO_DEFAULT_EXPORT');
      if (!result.compiles) status.push('COMPILE_ERROR');

      const label = status.length > 0 ? `ISSUES: ${status.join(', ')}` : 'OK';
      console.log(
        `  finish=${result.finishReason} chunks=${result.totalChunks} chars=${result.codeLength} ${(result.elapsed / 1000).toFixed(1)}s => ${label}`
      );
      if (result.compileError) {
        console.log(`  compile: ${result.compileError}`);
      }
    } catch (e: any) {
      console.log(`  FATAL: ${e.message?.slice(0, 200)}`);
      results.push({
        run: i,
        finishReason: null,
        totalChunks: 0,
        parseFails: 0,
        codeLength: 0,
        braces: 0,
        parens: 0,
        hasDefaultExport: false,
        compiles: false,
        compileError: e.message?.slice(0, 200),
        truncated: true,
        elapsed: 0,
      });
    }
  }

  console.log('\n=== SUMMARY ===');
  const ok = results.filter((r) => !r.truncated && r.compiles && r.parseFails === 0);
  const broken = results.filter((r) => r.truncated || !r.compiles || r.parseFails > 0);
  console.log(`OK: ${ok.length}/${results.length}`);
  console.log(`Broken: ${broken.length}/${results.length}`);

  if (broken.length > 0) {
    console.log('\nBroken runs:');
    for (const r of broken) {
      console.log(
        `  Run ${r.run}: finish=${r.finishReason} parseFails=${r.parseFails} braces=${r.braces} parens=${r.parens} compiles=${r.compiles}`
      );
    }
  }

  const totalParseFails = results.reduce((s, r) => s + r.parseFails, 0);
  if (totalParseFails > 0) {
    console.log(`\n⚠️  Total JSON parse failures across all runs: ${totalParseFails}`);
    console.log('   This means the SDK toReadableStream() yields concatenated/partial JSON chunks.');
    console.log('   Tokens in those chunks are silently dropped, causing incomplete code.');
  }
}

main().catch(console.error);
