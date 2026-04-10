/**
 * Eval script — uses the same Together AI SDK, prompt, and streaming
 * pipeline as the production route (/api/generateCode).
 *
 * Usage: npx tsx scripts/eval.ts
 */

import Together from "together-ai";
import shadcnDocs from "../lib/shadcn-docs";
import dedent from "dedent";
import * as fs from "fs";
import * as path from "path";

// ── Config ──────────────────────────────────────────────────────────
const MODELS = [
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "meta-llama/Llama-4-Scout-17B-16E-Instruct",
  "moonshotai/Kimi-K2.5",
  "zai-org/GLM-5",
  "MiniMaxAI/MiniMax-M2.5",
];
const DATA_DIR = path.join(__dirname, "../fixtures");
const RUNS_PER_IMAGE = 4; // 4 images × 4 runs × 3 models ≈ 48 runs
const SHADCN = false; // match default in the app

// ── Together client (same setup as route.ts) ────────────────────────
let options: ConstructorParameters<typeof Together>[0] = {};
if (process.env.HELICONE_API_KEY) {
  options.baseURL = "https://together.helicone.ai/v1";
  options.defaultHeaders = {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  };
}
const together = new Together(options);

// ── Prompt (copied verbatim from route.ts) ──────────────────────────
function getCodingPrompt(shadcn: boolean) {
  let systemPrompt = `
You are an expert frontend frontend React developer. You will be given a screenshot of a website from the user, and then you will return code for it using React and Tailwind CSS. Follow the instructions carefully, it is very important for my job. I will tip you $1 million if you do a good job:

- Think carefully step by step about how to recreate the UI described in the prompt.
- Create a React component for whatever the user asked you to create and make sure it can run by itself by using a default export
- Feel free to have multiple components in the file, but make sure to have one main component that uses all the other components
- Make sure the website looks exactly like the screenshot described in the prompt.
- Pay close attention to background color, text color, font size, font family, padding, margin, border, etc. Match the colors and sizes exactly.
- Make sure to code every part of the description including any headers, footers, etc.
- Use the exact text from the description for the UI elements.
- Do not add comments in the code such as "<!-- Add other navigation links as needed -->" and "<!-- ... other news items ... -->" in place of writing the full code. WRITE THE FULL CODE.
- Repeat elements as needed to match the description. For example, if there are 15 items, the code should have 15 items. DO NOT LEAVE comments like "<!-- Repeat for each news item -->" or bad things will happen.
- For all images, please use an svg with a white, gray, or black background and don't try to import them locally or from the internet.
- Make sure the React app is interactive and functional by creating state when needed and having no required props
- If you use any imports from React like useState or useEffect, make sure to import them directly
- Use TypeScript as the language for the React component
- Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`). Make sure to use a consistent color palette.
- Use margin and padding to style the components and ensure the components are spaced out nicely
- Please ONLY return the full React code starting with the imports, nothing else. It's very important for my job that you only return the React code with imports. DO NOT START WITH \`\`\`typescript or \`\`\`javascript or \`\`\`tsx or \`\`\`.
- ONLY IF the user asks for a dashboard, graph or chart, the recharts library is available to be imported, e.g. \`import { LineChart, XAxis, ... } from "recharts"\` & \`<LineChart ...><XAxis dataKey="name"> ...\`. Please only use this when needed.
- If you need an icon, please create an SVG for it and use it in the code. DO NOT IMPORT AN ICON FROM A LIBRARY.
- Make the design look nice and don't have borders around the entire website even if that's described
  `;

  if (shadcn) {
    systemPrompt += `
    There are some prestyled components available for use. Please use your best judgement to use any of these components if the app calls for one.

    Here are the components that are available, along with how to import them, and how to use them:

    ${shadcnDocs
      .map(
        (component) => `
          <component>
          <name>
          ${component.name}
          </name>
          <import-instructions>
          ${component.importDocs}
          </import-instructions>
          <usage-instructions>
          ${component.usageDocs}
          </usage-instructions>
          </component>
        `
      )
      .join("\n")}
    `;
  }

  systemPrompt += `
    NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.
  `;

  systemPrompt += `
  Here are some examples of good outputs:

${examples
  .map(
    (example) => `
      <example>
      <input>
      ${example.input}
      </input>
      <output>
      ${example.output}
      </output>
      </example>
  `
  )
  .join("\n")}
  `;

  return dedent(systemPrompt);
}

const examples = [
  {
    input: `A landing page screenshot`,
    output: `
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-black mr-2"></div>
            <span className="font-bold text-xl">LOGO</span>
          </div>
          <nav className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-700 hover:text-gray-900">Features</a>
            <a href="#about" className="text-gray-700 hover:text-gray-900">About</a>
            <a href="#pricing" className="text-gray-700 hover:text-gray-900">Pricing</a>
          </nav>
          <Button variant="outline" className="rounded-full">Sign up</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-4 py-2 rounded-full bg-gray-200 text-sm text-gray-700 mb-6">
              Used by 100+ companies
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Welcome to your all-in-one AI tool
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Check out all the new features in the 13.2 update in the demo below
            </p>
            <Button className="rounded-full px-8 py-3 bg-black text-white hover:bg-gray-800">
              Get Started
            </Button>
          </div>
          <div className="bg-gray-300 aspect-video rounded-lg flex items-center justify-center">
            <span className="text-gray-600 text-2xl">IMAGE PLACEHOLDER</span>
          </div>
        </div>
      </main>
    </div>
  )
}
    `,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────
function getImages(): { name: string; base64: string }[] {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
  return files.map((f) => ({
    name: f,
    base64: `data:image/png;base64,${fs
      .readFileSync(path.join(DATA_DIR, f))
      .toString("base64")}`,
  }));
}

function isCodeComplete(code: string): {
  complete: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let trimmed = code.trim();

  // Check for markdown fences
  if (trimmed.startsWith("```")) {
    issues.push("starts_with_markdown_fence");
    trimmed = trimmed.replace(/^```\w*\n?/, "");
  }
  if (trimmed.endsWith("```")) {
    issues.push("ends_with_markdown_fence");
    trimmed = trimmed.replace(/```$/, "");
  }

  // Check for default export
  if (!trimmed.includes("export default")) {
    issues.push("missing_default_export");
  }

  // Check balanced braces
  let braces = 0;
  let parens = 0;
  let inString: string | null = null;
  let escaped = false;
  for (const ch of trimmed) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "(") parens++;
    if (ch === ")") parens--;
  }
  if (braces !== 0) issues.push(`unbalanced_braces(${braces})`);
  if (parens !== 0) issues.push(`unbalanced_parens(${parens})`);

  return { complete: issues.length === 0, issues };
}

// ── Run single eval (same API call as route.ts) ─────────────────────
interface EvalResult {
  model: string;
  image: string;
  run: number;
  complete: boolean;
  issues: string[];
  finish_reason: string | null;
  char_count: number;
  duration_ms: number;
  error?: string;
}

async function runEval(
  model: string,
  image: { name: string; base64: string },
  runIndex: number
): Promise<EvalResult> {
  const start = Date.now();
  const codingPrompt = getCodingPrompt(SHADCN);

  try {
    // Same API call as route.ts
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
            { type: "image_url", image_url: { url: image.base64 } },
          ],
        },
      ],
    });

    // Same streaming logic as route.ts
    let code = "";
    let finishReason: string | null = null;

    for await (const chunk of res) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      // Skip reasoning content (same as route.ts)
      const reasoning =
        choice.delta?.reasoning_content || choice.delta?.reasoning;
      if (reasoning) continue;

      const text = choice.delta?.content || choice.text || "";
      if (text) code += text;
    }

    const duration = Date.now() - start;
    const { complete, issues } = isCodeComplete(code);

    return {
      model,
      image: image.name,
      run: runIndex,
      complete,
      issues,
      finish_reason: finishReason,
      char_count: code.length,
      duration_ms: duration,
    };
  } catch (e: any) {
    return {
      model,
      image: image.name,
      run: runIndex,
      complete: false,
      issues: ["error"],
      finish_reason: null,
      char_count: 0,
      duration_ms: Date.now() - start,
      error: e.message,
    };
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const images = getImages();
  const totalRuns = images.length * MODELS.length * RUNS_PER_IMAGE;
  console.log(
    `Found ${images.length} images, ${MODELS.length} models, ${RUNS_PER_IMAGE} runs each`
  );
  console.log(`Total runs: ${totalRuns}\n`);

  const results: EvalResult[] = [];
  let total = 0;

  for (const model of MODELS) {
    for (const image of images) {
      // Run RUNS_PER_IMAGE concurrently per model+image combo
      const batch = Array.from({ length: RUNS_PER_IMAGE }, (_, i) =>
        runEval(model, image, i + 1).then((r) => {
          total++;
          const status = r.complete ? "PASS" : "FAIL";
          const issues = r.issues.length ? ` [${r.issues.join(", ")}]` : "";
          console.log(
            `[${total}/${totalRuns}] ${status} ${r.model} | ${r.image} #${r.run} | finish=${r.finish_reason} | ${r.char_count} chars | ${(r.duration_ms / 1000).toFixed(1)}s${issues}`
          );
          return r;
        })
      );
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.complete).length;
  console.log(
    `${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%)\n`
  );

  for (const model of MODELS) {
    const mr = results.filter((r) => r.model === model);
    const mp = mr.filter((r) => r.complete).length;
    console.log(`${model}: ${mp}/${mr.length} passed`);

    const issueCounts: Record<string, number> = {};
    for (const r of mr)
      for (const issue of r.issues)
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    if (Object.keys(issueCounts).length > 0)
      console.log("  Issues:", issueCounts);

    const finishReasons: Record<string, number> = {};
    for (const r of mr) {
      const reason = r.finish_reason || "null";
      finishReasons[reason] = (finishReasons[reason] || 0) + 1;
    }
    console.log("  Finish reasons:", finishReasons);
    console.log();
  }

  // Write full results
  const outPath = path.join(__dirname, "../eval-results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Full results written to ${outPath}`);
}

main().catch(console.error);
