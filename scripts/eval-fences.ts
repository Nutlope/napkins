/**
 * Fence eval — tests how often models return markdown fences that break Sandpack.
 * Uses the exact same prompt as production (imported from lib/prompt.ts).
 *
 * Usage:
 *   npx tsx scripts/eval-fences.ts              # all prod models, 3 runs each
 *   npx tsx scripts/eval-fences.ts 5             # all prod models, 5 runs each
 *   npx tsx scripts/eval-fences.ts 3 "moonshotai/Kimi-K2.5"  # single model
 */
import Together from "together-ai";
import * as esbuild from "esbuild";
import * as fs from "fs";
import { getCodingPrompt } from "../lib/prompt";
import { stripFences } from "../lib/code-utils";

const PROD_MODELS = [
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "moonshotai/Kimi-K2.5",
  "zai-org/GLM-5",
  "MiniMaxAI/MiniMax-M2.5",
];

const IMAGE_URL =
  "https://napkinsdev.s3.us-east-1.amazonaws.com/next-s3-uploads/be191fc8-149b-43eb-b434-baf883986c2c/appointment-booking.png";
const RUNS = parseInt(process.argv[2] || "3", 10);
const SINGLE_MODEL = process.argv[3];
const MODELS = SINGLE_MODEL ? [SINGLE_MODEL] : PROD_MODELS;

const together = new Together();
const codingPrompt = getCodingPrompt(false);

interface Result {
  model: string;
  run: number;
  raw_has_fence: boolean;
  fence_position: "start" | "end" | "both" | "none";
  raw_first_50: string;
  raw_last_50: string;
  stripped_compiles: boolean;
  compile_error?: string;
  has_default_export: boolean;
  finish_reason: string | null;
  char_count: number;
  duration_ms: number;
  error?: string;
}

async function runOnce(model: string, runIdx: number): Promise<Result> {
  const start = Date.now();

  try {
    const res = await (together.chat.completions.create as Function)({
      model,
      temperature: 0.2,
      max_tokens: 65536,
      stream: true,
      reasoning: { enabled: false },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: codingPrompt },
            { type: "image_url", image_url: { url: IMAGE_URL } },
          ],
        },
      ],
    });

    let code = "";
    let finishReason: string | null = null;

    for await (const chunk of res) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const reasoning =
        choice.delta?.reasoning_content || choice.delta?.reasoning;
      if (reasoning) continue;
      const text = choice.delta?.content || choice.text || "";
      if (text) code += text;
    }

    const trimmed = code.trim();
    const startsWithFence = trimmed.startsWith("```");
    const endsWithFence = trimmed.endsWith("```");
    const fencePosition =
      startsWithFence && endsWithFence
        ? "both"
        : startsWithFence
          ? "start"
          : endsWithFence
            ? "end"
            : "none";

    const stripped = stripFences(code);
    let compiles = false;
    let compileError: string | undefined;
    try {
      esbuild.transformSync(stripped, { loader: "tsx" });
      compiles = true;
    } catch (e: any) {
      compileError = (e.message || "").split("\n").slice(0, 2).join(" | ");
    }

    return {
      model,
      run: runIdx,
      raw_has_fence: startsWithFence || endsWithFence,
      fence_position: fencePosition,
      raw_first_50: JSON.stringify(trimmed.slice(0, 50)),
      raw_last_50: JSON.stringify(trimmed.slice(-50)),
      stripped_compiles: compiles,
      compile_error: compileError,
      has_default_export: stripped.includes("export default"),
      finish_reason: finishReason,
      char_count: code.length,
      duration_ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      model,
      run: runIdx,
      raw_has_fence: false,
      fence_position: "none",
      raw_first_50: "",
      raw_last_50: "",
      stripped_compiles: false,
      compile_error: e.message,
      has_default_export: false,
      finish_reason: null,
      char_count: 0,
      duration_ms: Date.now() - start,
      error: e.message,
    };
  }
}

async function main() {
  const total = MODELS.length * RUNS;
  console.log(`Image: ${IMAGE_URL.split("/").pop()}`);
  console.log(`Models: ${MODELS.join(", ")}`);
  console.log(`Runs per model: ${RUNS}`);
  console.log(`Total runs: ${total}\n`);

  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
  const results: Result[] = [];
  let done = 0;

  for (const model of MODELS) {
    for (let batchStart = 0; batchStart < RUNS; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, RUNS);
      const batchLen = batchEnd - batchStart;
      console.log(`\n--- batch ${batchStart + 1}–${batchEnd} of ${RUNS} for ${model.split("/").pop()} ---`);

      const batch = Array.from({ length: batchLen }, (_, i) =>
        runOnce(model, batchStart + i + 1).then((r) => {
          done++;
          const fenceTag = r.raw_has_fence ? "FENCE" : "clean";
          const compileTag = r.stripped_compiles ? "compiles" : "COMPILE_FAIL";
          console.log(
            `[${done}/${total}] ${fenceTag} ${compileTag} | ${r.model.split("/").pop()} #${r.run} | fence=${r.fence_position} | finish=${r.finish_reason} | ${r.char_count} chars | ${(r.duration_ms / 1000).toFixed(1)}s`
          );
          if (r.raw_has_fence) {
            console.log(`         first: ${r.raw_first_50}`);
            console.log(`         last:  ${r.raw_last_50}`);
          }
          if (r.compile_error) {
            console.log(`         error: ${r.compile_error.slice(0, 120)}`);
          }
          return r;
        })
      );
      results.push(...(await Promise.all(batch)));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("FENCE EVAL SUMMARY");
  console.log("=".repeat(70));

  for (const model of MODELS) {
    const mr = results.filter((r) => r.model === model);
    const fenced = mr.filter((r) => r.raw_has_fence).length;
    const compiles = mr.filter((r) => r.stripped_compiles).length;
    const exports = mr.filter((r) => r.has_default_export).length;
    const shortName = model.split("/").pop();

    console.log(`\n${shortName}:`);
    console.log(`  Markdown fences: ${fenced}/${mr.length} (${((fenced / mr.length) * 100).toFixed(0)}%)`);
    console.log(`  Compiles after strip: ${compiles}/${mr.length}`);
    console.log(`  Has default export: ${exports}/${mr.length}`);

    const fencePositions: Record<string, number> = {};
    for (const r of mr) {
      fencePositions[r.fence_position] =
        (fencePositions[r.fence_position] || 0) + 1;
    }
    console.log(`  Fence positions: ${JSON.stringify(fencePositions)}`);
  }

  const totalFenced = results.filter((r) => r.raw_has_fence).length;
  console.log(`\nOVERALL: ${totalFenced}/${results.length} returned fences (${((totalFenced / results.length) * 100).toFixed(0)}%)`);

  const outPath = "eval-fences-results.json";
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results: ${outPath}`);
}

main().catch(console.error);
