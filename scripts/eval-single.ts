/**
 * Run a single eval and print the full output for debugging.
 * Usage: npx tsx scripts/eval-single.ts [image-name] [model]
 */
import Together from "together-ai";
import dedent from "dedent";
import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { autoClose, stripFences } from "../lib/code-utils";

const DATA_DIR = path.join(__dirname, "../data");
const imageName = process.argv[2] || "appointment-booking.png";
const model = process.argv[3] || "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8";

const together = new Together();

const imageBase64 = `data:image/png;base64,${fs
  .readFileSync(path.join(DATA_DIR, imageName))
  .toString("base64")}`;

// Same prompt as route.ts
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

async function main() {
  console.log(`Model: ${model}`);
  console.log(`Image: ${imageName}\n`);

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
          { type: "text", text: systemPrompt },
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
    const text = choice.delta?.content || choice.text || "";
    if (text) code += text;
  }

  // Save full output to file for analysis
  fs.writeFileSync(path.join(__dirname, "../eval-output.tsx"), code);
  console.log("Full output saved to eval-output.tsx");
  console.log("=== LAST 10 LINES (RAW) ===");
  const lines = code.split("\n");
  console.log(lines.slice(-10).join("\n"));
  console.log(`\nFinish reason: ${finishReason}`);
  console.log(`Total chars: ${code.length}`);

  // Diagnostics: check before auto-close
  const beforeCheck = validateCode(code);
  console.log(`\n=== BEFORE AUTO-CLOSE ===`);
  console.log(`Complete: ${beforeCheck.complete}, Issues: ${beforeCheck.issues.join(", ") || "none"}`);

  // Auto-close
  const fixed = autoClose(code);
  const afterCheck = validateCode(fixed);
  console.log(`\n=== AFTER AUTO-CLOSE ===`);
  console.log(`Complete: ${afterCheck.complete}, Issues: ${afterCheck.issues.join(", ") || "none"}`);
  if (fixed !== code) {
    console.log("Auto-close ADDED characters:");
    console.log(fixed.slice(code.length));
    console.log("\n=== LAST 5 LINES (FIXED) ===");
    console.log(fixed.split("\n").slice(-5).join("\n"));
  } else {
    console.log("Auto-close made NO changes");
  }

  // Check if starts with markdown fence
  const trimmed = code.trim();
  if (trimmed.startsWith("```")) {
    console.log("\n⚠️  Output starts with markdown fence!");
    console.log("First 50 chars:", JSON.stringify(trimmed.slice(0, 50)));
  }
  if (trimmed.endsWith("```")) {
    console.log("\n⚠️  Output ends with markdown fence!");
    console.log("Last 50 chars:", JSON.stringify(trimmed.slice(-50)));
  }
}

function validateCode(code: string) {
  const issues: string[] = [];
  let trimmed = code.trim();
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) issues.push("markdown_fence");
  trimmed = stripFences(trimmed);
  if (!trimmed.includes("export default")) issues.push("missing_default_export");

  try {
    esbuild.transformSync(trimmed, { loader: "tsx" });
  } catch (e: any) {
    const msg = e.message?.split("\n")[0] || "esbuild_error";
    issues.push(`compile_error: ${msg}`);
  }

  return { complete: issues.length === 0, issues };
}

main().catch(console.error);
