/**
 * Focused eval — run just Maverick against all images, 8 times each.
 */
import Together from "together-ai";
import dedent from "dedent";
import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { stripFences } from "../lib/code-utils";

const MODEL = process.argv[2] || "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8";
const DATA_DIR = path.join(__dirname, "../fixtures");
const RUNS = parseInt(process.argv[3] || "8", 10);

const together = new Together();

function getImages() {
  return fs.readdirSync(DATA_DIR)
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .map((f) => ({
      name: f,
      base64: `data:image/png;base64,${fs.readFileSync(path.join(DATA_DIR, f)).toString("base64")}`,
    }));
}

const systemPrompt = dedent`
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
- IMPORTANT: Make sure your code is complete. Every opening brace must have a closing brace, every opening parenthesis must have a closing parenthesis. The code must end with the closing of the default export function. Double check that your JSX is properly closed.

NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.

Here are some examples of good outputs:

<example>
<input>
A landing page screenshot
</input>
<output>
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
</output>
</example>
`;

function validateCode(code: string) {
  const issues: string[] = [];
  let trimmed = stripFences(code);
  if (!trimmed.includes("export default")) issues.push("missing_default_export");

  try {
    esbuild.transformSync(trimmed, { loader: "tsx" });
  } catch (e: any) {
    const lines = (e.message || "esbuild_error").split("\n");
    // First line is summary, subsequent lines have the actual errors
    const details = lines.slice(0, 4).join(" | ");
    issues.push(`compile_error: ${details}`);
  }

  return { complete: issues.length === 0, issues };
}

const MAX_RETRIES = 3;

async function run(image: { name: string; base64: string }, idx: number) {
  const start = Date.now();
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await (together.chat.completions.create as Function)({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 65536,
        stream: true,
        reasoning: { enabled: false },
        messages: [
          { role: "user", content: [
            { type: "text", text: systemPrompt },
            { type: "image_url", image_url: { url: image.base64 } },
          ]},
        ],
      });

      let code = "", finishReason: string | null = null;
      for await (const chunk of res) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const text = choice.delta?.content || choice.text || "";
        if (text) code += text;
      }

      // Retry if stream was truncated (finish_reason != "stop")
      if (finishReason !== "stop" && attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.log(`  ⟳ ${image.name} #${idx} attempt ${attempt} truncated (finish_reason=${finishReason}), retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const { complete, issues } = validateCode(code);
      return { image: image.name, run: idx, complete, issues, finish_reason: finishReason, chars: code.length, ms: Date.now() - start, attempts: attempt };
    } catch (e: any) {
      const status = e.status || e.statusCode;
      if (status >= 500 && attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.log(`  ⟳ ${image.name} #${idx} attempt ${attempt} got ${status}, retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { image: image.name, run: idx, complete: false, issues: ["error: " + e.message], finish_reason: null, chars: 0, ms: Date.now() - start, attempts: attempt };
    }
  }
  // unreachable, but satisfies TS
  return { image: image.name, run: idx, complete: false, issues: ["max_retries_exceeded"], finish_reason: null, chars: 0, ms: Date.now() - start, attempts: MAX_RETRIES };
}

async function main() {
  const images = getImages();
  const total = images.length * RUNS;
  console.log(`${MODEL}\n${images.length} images × ${RUNS} runs = ${total} total\n`);

  let done = 0;
  const results: any[] = [];

  for (const image of images) {
    const batch = Array.from({ length: RUNS }, (_, i) =>
      run(image, i + 1).then((r) => {
        done++;
        const s = r.complete ? "PASS" : "FAIL";
        const iss = r.issues.length ? ` [${r.issues.join(", ")}]` : "";
        const retries = r.attempts > 1 ? ` (${r.attempts} attempts)` : "";
        console.log(`[${done}/${total}] ${s} ${r.image} #${r.run} | ${r.finish_reason} | ${r.chars} chars | ${(r.ms / 1000).toFixed(1)}s${retries}${iss}`);
        return r;
      })
    );
    results.push(...await Promise.all(batch));
  }

  const passed = results.filter((r) => r.complete).length;
  console.log(`\n=== ${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%) ===`);

  const byImage: Record<string, { pass: number; total: number }> = {};
  for (const r of results) {
    if (!byImage[r.image]) byImage[r.image] = { pass: 0, total: 0 };
    byImage[r.image].total++;
    if (r.complete) byImage[r.image].pass++;
  }
  for (const [img, s] of Object.entries(byImage)) {
    console.log(`  ${img}: ${s.pass}/${s.total}`);
  }
}

main().catch(console.error);
