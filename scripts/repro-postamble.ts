/**
 * Repro: Together AI's Kimi K2.5 sometimes leaks reasoning/self-reflection
 * text after valid code output. Fireworks does not.
 *
 * Run: npx tsx scripts/repro-postamble.ts
 */
import Together from "together-ai";
import * as fs from "fs";
import * as path from "path";

const FIREWORKS_KEY = process.env.FIREWORKS_API_KEY || "fw_3ZSdVXSjCTMCXx7XXTL8dAJH";
const together = new Together();
const imgPath = path.join(__dirname, "../data/appointment-booking.png");
const base64 = `data:image/png;base64,${fs.readFileSync(imgPath).toString("base64")}`;

import dedent from "dedent";

const prompt = dedent`
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

async function runTogether(): Promise<string> {
  const res = await (together.chat.completions.create as Function)({
    model: "moonshotai/Kimi-K2.5",
    temperature: 0.2,
    max_tokens: 65536,
    stream: true,
    reasoning: { enabled: false },
    messages: [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: base64 } },
    ]}],
  });
  let code = "";
  for await (const chunk of res) {
    const text = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.text || "";
    if (text) code += text;
  }
  return code;
}

async function runFireworks(): Promise<string> {
  const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${FIREWORKS_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "accounts/fireworks/models/kimi-k2p5",
      temperature: 0.2,
      max_tokens: 65536,
      stream: true,
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: base64 } },
      ]}],
    }),
  });
  let code = "", buffer = "";
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.slice(6) === "[DONE]") continue;
      try { code += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ""; } catch {}
    }
  }
  return code;
}

function analyze(label: string, code: string) {
  const lines = code.split("\n");
  const lastExportLine = lines.findLastIndex(l => /^}/.test(l.trim()));
  const trailingLines = lines.slice(lastExportLine + 1).filter(l => l.trim());

  console.log(`\n=== ${label} ===`);
  console.log(`Total chars: ${code.length} | Total lines: ${lines.length}`);

  if (trailingLines.length === 0) {
    console.log(`Trailing content after last '}': NONE (clean)`);
  } else {
    console.log(`Trailing content after last '}': ${trailingLines.length} non-empty lines`);
    console.log(`--- First 5 trailing lines ---`);
    trailingLines.slice(0, 5).forEach(l => console.log(`  | ${l}`));
    const hasReasoning = trailingLines.some(l =>
      /^(Wait|Let me|I need|I should|Actually|Note[:\s]|\d+\.\s)/.test(l.trim())
    );
    const hasFence = trailingLines.some(l => l.trim().startsWith("```"));
    if (hasReasoning) console.log(`\n⚠️  REASONING LEAK DETECTED — model emitted self-reflection after code`);
    if (hasFence) console.log(`⚠️  EMBEDDED MARKDOWN FENCE — model started a second code block`);
  }
}

async function main() {
  const RUNS = 20;
  console.log(`Running ${RUNS} CONCURRENT calls per provider to detect postamble leaks...\n`);

  function checkLeak(code: string) {
    const lines = code.split("\n");
    const lastBrace = lines.findLastIndex(l => /^}/.test(l.trim()));
    const trailing = lines.slice(lastBrace + 1).filter(l => l.trim());
    return { leaked: trailing.length > 2, trailingLines: trailing.length, trailing };
  }

  // Run all Together calls concurrently
  console.log(`Launching ${RUNS} concurrent Together AI calls...`);
  const togetherResults = await Promise.all(
    Array.from({ length: RUNS }, (_, i) =>
      runTogether().then(code => {
        const { leaked, trailingLines } = checkLeak(code);
        const status = leaked ? "LEAK" : "clean";
        console.log(`  Together #${i+1}: ${code.length} chars (${status}${leaked ? `, ${trailingLines} trailing lines` : ""})`);
        return { code, leaked };
      }).catch(e => {
        console.log(`  Together #${i+1}: ERROR ${e.message?.slice(0, 100)}`);
        return { code: "", leaked: false };
      })
    )
  );

  // Run all Fireworks calls concurrently
  console.log(`\nLaunching ${RUNS} concurrent Fireworks calls...`);
  const fireworksResults = await Promise.all(
    Array.from({ length: RUNS }, (_, i) =>
      runFireworks().then(code => {
        const { leaked, trailingLines } = checkLeak(code);
        const status = leaked ? "LEAK" : "clean";
        console.log(`  Fireworks #${i+1}: ${code.length} chars (${status}${leaked ? `, ${trailingLines} trailing lines` : ""})`);
        return { code, leaked };
      }).catch(e => {
        console.log(`  Fireworks #${i+1}: ERROR ${e.message?.slice(0, 100)}`);
        return { code: "", leaked: false };
      })
    )
  );

  const togetherLeaks = togetherResults.filter(r => r.leaked).length;
  const fireworksLeaks = fireworksResults.filter(r => r.leaked).length;

  // Show detail on first Together leak
  const firstLeak = togetherResults.find(r => r.leaked);
  if (firstLeak) analyze("FIRST TOGETHER LEAK (detail)", firstLeak.code);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Together AI leaks: ${togetherLeaks}/${RUNS} (${(togetherLeaks/RUNS*100).toFixed(0)}%)`);
  console.log(`Fireworks leaks:   ${fireworksLeaks}/${RUNS} (${(fireworksLeaks/RUNS*100).toFixed(0)}%)`);
}

main().catch(console.error);
