/**
 * Trace every raw chunk from Together's stream for Kimi K2.5
 * to find gaps that could trigger Vercel timeouts.
 *
 * Usage: npx tsx scripts/repro-chunk-timing.ts [image]
 */
import * as fs from 'fs';
import * as path from 'path';
import Together from 'together-ai';
// Inline minimal prompt — we just need to trigger a long generation
function getCodingPrompt(_shadcn: boolean) {
  return `You are an expert frontend React developer. You will be given a screenshot of a website from the user, and then you will return code for it using React and Tailwind CSS. Create a React component with a default export. Use TypeScript. Please ONLY return the full React code starting with the imports, nothing else. DO NOT START WITH \`\`\`typescript or \`\`\`tsx or \`\`\`.`;
}

const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const imageName = process.argv[2] || 'appointment-booking.png';
const model = 'moonshotai/Kimi-K2.5';

let options: ConstructorParameters<typeof Together>[0] = {};
if (process.env.HELICONE_API_KEY) {
  options.baseURL = 'https://together.helicone.ai/v1';
  options.defaultHeaders = {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  };
}
const together = new Together(options);

const imageBase64 = `data:image/png;base64,${fs
  .readFileSync(path.join(FIXTURES_DIR, imageName))
  .toString('base64')}`;

const codingPrompt = getCodingPrompt(false);

async function main() {
  console.log(`Model: ${model}`);
  console.log(`Image: ${imageName}\n`);

  const res = await (together.chat.completions.create as Function)({
    model,
    temperature: 0.2,
    max_tokens: 65536,
    stream: true,
    // reasoning: { enabled: false },  // test with reasoning ON
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

  const reader = res
    .toReadableStream()
    .pipeThrough(new TextDecoderStream())
    .getReader();

  const start = Date.now();
  let lastTime = start;
  let chunkNum = 0;
  let parseFails = 0;
  let maxGap = 0;
  let maxGapAt = 0;
  let reasoningChunks = 0;
  let codeChunks = 0;
  let emptyChoiceChunks = 0;
  let finishReason: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunkNum++;
    const now = Date.now();
    const gap = now - lastTime;
    const elapsed = now - start;

    if (gap > maxGap) {
      maxGap = gap;
      maxGapAt = elapsed;
    }

    // Log big gaps
    if (gap > 2000) {
      console.log(`⚠️  GAP ${(gap / 1000).toFixed(1)}s at ${(elapsed / 1000).toFixed(1)}s (chunk #${chunkNum})`);
    }

    try {
      const parsed = JSON.parse(value);
      const choice = parsed.choices?.[0];

      if (!choice) {
        emptyChoiceChunks++;
        if (emptyChoiceChunks <= 3) {
          console.log(`  [${(elapsed / 1000).toFixed(1)}s] empty choice, raw: ${value.slice(0, 100)}`);
        }
        continue;
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
        console.log(`  [${(elapsed / 1000).toFixed(1)}s] finish_reason: ${choice.finish_reason}`);
      }

      const reasoning = choice.delta?.reasoning_content || choice.delta?.reasoning;
      if (reasoning) {
        reasoningChunks++;
        if (reasoningChunks <= 3) {
          console.log(`  [${(elapsed / 1000).toFixed(1)}s] reasoning chunk #${reasoningChunks}: "${reasoning.slice(0, 60)}..."`);
        }
        lastTime = now;
        continue;
      }

      const text = choice.delta?.content || choice.text;
      if (text) {
        codeChunks++;
        if (codeChunks <= 3 || codeChunks % 100 === 0) {
          console.log(`  [${(elapsed / 1000).toFixed(1)}s] code chunk #${codeChunks}: "${text.slice(0, 40)}..."`);
        }
      }
    } catch {
      parseFails++;
      console.log(`  [${(elapsed / 1000).toFixed(1)}s] PARSE FAIL #${parseFails}: "${value.slice(0, 120)}"`);
    }

    lastTime = now;
  }

  const totalElapsed = Date.now() - start;
  console.log(`\n=== TIMING SUMMARY ===`);
  console.log(`Total: ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(`Total chunks: ${chunkNum}`);
  console.log(`  Reasoning: ${reasoningChunks}`);
  console.log(`  Code: ${codeChunks}`);
  console.log(`  Empty choice: ${emptyChoiceChunks}`);
  console.log(`  Parse fails: ${parseFails}`);
  console.log(`Max gap: ${(maxGap / 1000).toFixed(1)}s at ${(maxGapAt / 1000).toFixed(1)}s`);
  console.log(`Finish reason: ${finishReason}`);

  if (maxGap > 25000) {
    console.log(`\n🔴 Max gap ${(maxGap / 1000).toFixed(0)}s exceeds Vercel's 25s edge streaming timeout!`);
    console.log(`   This would kill the connection on a deployed edge function.`);
  } else if (maxGap > 10000) {
    console.log(`\n🟡 Max gap ${(maxGap / 1000).toFixed(0)}s — borderline for edge streaming.`);
  } else {
    console.log(`\n🟢 Max gap under 10s — should be fine for streaming.`);
  }
}

main().catch(console.error);
