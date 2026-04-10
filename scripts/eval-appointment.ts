/**
 * Focused eval for the appointment-booking PNG across candidate models.
 *
 * Usage:
 *   npx tsx scripts/eval-appointment.ts
 *   npx tsx scripts/eval-appointment.ts 5
 *   npx tsx scripts/eval-appointment.ts 5 "zai-org/GLM-5"
 *   npx tsx scripts/eval-appointment.ts 2 "moonshotai/Kimi-K2.5" "zai-org/GLM-5"
 */
import Together from "together-ai";
import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { getCodingPrompt } from "../lib/prompt";
import { stripFences } from "../lib/code-utils";

const DATA_DIR = path.join(__dirname, "../fixtures");
const DEFAULT_IMAGE_NAME = process.env.IMAGE_NAME || "appointment-booking.png";
const RUNS = parseInt(process.argv[2] || "5", 10);
const CLI_MODELS = process.argv.slice(3);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "5", 10);
const REQUEST_TIMEOUT_MS = parseInt(
  process.env.REQUEST_TIMEOUT_MS || "180000",
  10
);
const OUTFILE = process.env.OUTFILE || "eval-appointment-results.json";
const ALL_IMAGES = process.env.ALL_IMAGES === "1";
const IMAGE_NAMES = ALL_IMAGES
  ? fs
      .readdirSync(DATA_DIR)
      .filter((file) => /\.(png|jpg|jpeg)$/i.test(file))
      .sort()
  : [DEFAULT_IMAGE_NAME];
const CANDIDATE_MODELS = [
  "MiniMaxAI/MiniMax-M2.5",
  "zai-org/GLM-5",
  "moonshotai/Kimi-K2.5",
  "Qwen/Qwen3.5-397B-A17B",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "deepseek-ai/DeepSeek-V3.1",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
];
const MODELS = CLI_MODELS.length > 0 ? CLI_MODELS : CANDIDATE_MODELS;

const together = new Together();
const codingPrompt = getCodingPrompt(false);

function getImageBase64(imageName: string) {
  return `data:image/png;base64,${fs
    .readFileSync(path.join(DATA_DIR, imageName))
    .toString("base64")}`;
}

interface Result {
  model: string;
  image: string;
  run: number;
  raw_has_fence: boolean;
  raw_compiles: boolean;
  stripped_compiles: boolean;
  has_default_export: boolean;
  issues: string[];
  finish_reason: string | null;
  char_count: number;
  duration_ms: number;
  error?: string;
}

function validate(code: string) {
  const issues: string[] = [];
  const trimmed = code.trim();
  const rawHasFence = trimmed.startsWith("```") || trimmed.endsWith("```");
  const stripped = stripFences(code);

  const rawCompile = tryCompile(trimmed);
  const strippedCompile = tryCompile(stripped);
  const hasDefaultExport = stripped.includes("export default");

  if (rawHasFence) issues.push("markdown_fence");
  if (!hasDefaultExport) issues.push("missing_default_export");
  if (!strippedCompile.ok) {
    issues.push(`compile_error: ${strippedCompile.error}`);
  }

  return {
    rawHasFence,
    rawCompiles: rawCompile.ok,
    strippedCompiles: strippedCompile.ok,
    hasDefaultExport,
    issues,
  };
}

function tryCompile(source: string) {
  try {
    esbuild.transformSync(source, { loader: "tsx" });
    return { ok: true as const };
  } catch (error: any) {
    const message = (error.message || "esbuild_error")
      .split("\n")
      .slice(0, 2)
      .join(" | ");
    return { ok: false as const, error: message };
  }
}

async function runOnce(
  model: string,
  imageName: string,
  run: number
): Promise<Result> {
  const start = Date.now();

  try {
    const { code, finishReason } = await Promise.race([
      (async () => {
        const imageBase64 = getImageBase64(imageName);
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
                { type: "image_url", image_url: { url: imageBase64 } },
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

        return { code, finishReason };
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`request_timeout_${REQUEST_TIMEOUT_MS}ms`)),
          REQUEST_TIMEOUT_MS
        )
      ),
    ]);

    const validation = validate(code);
    return {
      model,
      image: imageName,
      run,
      raw_has_fence: validation.rawHasFence,
      raw_compiles: validation.rawCompiles,
      stripped_compiles: validation.strippedCompiles,
      has_default_export: validation.hasDefaultExport,
      issues: validation.issues,
      finish_reason: finishReason,
      char_count: code.length,
      duration_ms: Date.now() - start,
    };
  } catch (error: any) {
    return {
      model,
      image: imageName,
      run,
      raw_has_fence: false,
      raw_compiles: false,
      stripped_compiles: false,
      has_default_export: false,
      issues: ["request_error"],
      finish_reason: null,
      char_count: 0,
      duration_ms: Date.now() - start,
      error: error.message,
    };
  }
}

async function main() {
  const total = MODELS.length * IMAGE_NAMES.length * RUNS;
  const results: Result[] = [];
  let done = 0;

  console.log(`Images: ${IMAGE_NAMES.join(", ")}`);
  console.log(`Models: ${MODELS.join(", ")}`);
  console.log(`Runs per model: ${RUNS}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
  console.log(`Total runs: ${total}\n`);

  for (const model of MODELS) {
    for (const imageName of IMAGE_NAMES) {
      for (let batchStart = 1; batchStart <= RUNS; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, RUNS);
        console.log(
          `--- batch ${batchStart}-${batchEnd} of ${RUNS} for ${model.split("/").pop()} on ${imageName} ---`
        );

        const batch = Array.from(
          { length: batchEnd - batchStart + 1 },
          (_, index) => batchStart + index
        ).map((run) =>
          runOnce(model, imageName, run).then((result) => {
            done++;
            const pass = result.stripped_compiles && result.has_default_export;
            const status = pass ? "PASS" : "FAIL";
            const issues = result.issues.length
              ? ` [${result.issues.join(", ")}]`
              : "";
            console.log(
              `[${done}/${total}] ${status} ${model.split("/").pop()} | ${imageName} #${run} | finish=${result.finish_reason} | raw_compile=${result.raw_compiles} | stripped_compile=${result.stripped_compiles} | ${result.char_count} chars | ${(result.duration_ms / 1000).toFixed(1)}s${issues}`
            );
            if (result.error) {
              console.log(`         error: ${result.error}`);
            }
            return result;
          })
        );

        results.push(...(await Promise.all(batch)));
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("APPOINTMENT BOOKING SUMMARY");
  console.log("=".repeat(70));

  for (const model of MODELS) {
    const modelResults = results.filter((result) => result.model === model);
    const passes = modelResults.filter(
      (result) => result.stripped_compiles && result.has_default_export
    ).length;
    const rawCompiles = modelResults.filter((result) => result.raw_compiles).length;
    const strippedCompiles = modelResults.filter(
      (result) => result.stripped_compiles
    ).length;
    const fences = modelResults.filter((result) => result.raw_has_fence).length;
    const shortName = model.split("/").pop();

    console.log(`\n${shortName}:`);
    console.log(
      `  Passes: ${passes}/${modelResults.length} (${((passes / modelResults.length) * 100).toFixed(0)}%)`
    );
    console.log(`  Raw compiles: ${rawCompiles}/${modelResults.length}`);
    console.log(
      `  Compiles after stripFences: ${strippedCompiles}/${modelResults.length}`
    );
    console.log(`  Markdown fences: ${fences}/${modelResults.length}`);

    for (const imageName of IMAGE_NAMES) {
      const imageResults = modelResults.filter(
        (result) => result.image === imageName
      );
      const imagePasses = imageResults.filter(
        (result) => result.stripped_compiles && result.has_default_export
      ).length;
      console.log(`  ${imageName}: ${imagePasses}/${imageResults.length}`);
    }
  }

  const outPath = path.join(__dirname, `../${OUTFILE}`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results: ${path.basename(outPath)}`);
}

main().catch(console.error);
