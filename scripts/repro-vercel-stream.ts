/**
 * Hit a deployed Vercel URL to test stream behavior.
 * Usage: BASE_URL=https://... npx tsx scripts/repro-vercel-stream.ts [image-path]
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://napkins-cy9sy2kgp-together-ai-0f0e15af.vercel.app';
const imageName = process.argv[2] || 'appointment-booking.png';
const FIXTURES_DIR = path.join(__dirname, '../fixtures');

const imageBase64 = `data:image/png;base64,${fs
  .readFileSync(path.join(FIXTURES_DIR, imageName))
  .toString('base64')}`;

async function main() {
  console.log(`Target: ${BASE_URL}/api/generateCode`);
  console.log(`Image: ${imageName}\n`);

  const start = Date.now();
  let lastChunkTime = start;
  let chunkNum = 0;
  let totalChars = 0;
  let maxGap = 0;
  let maxGapAt = 0;
  let code = '';

  const res = await fetch(`${BASE_URL}/api/generateCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'moonshotai/Kimi-K2.5',
      shadcn: false,
      imageUrl: imageBase64,
    }),
  });

  console.log(`HTTP ${res.status}`);
  if (!res.ok) {
    console.log(`Error: ${await res.text()}`);
    return;
  }
  if (!res.body) {
    console.log('No body');
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunkNum++;
    const now = Date.now();
    const gap = now - lastChunkTime;
    const elapsed = now - start;
    totalChars += value.length;

    if (gap > maxGap) {
      maxGap = gap;
      maxGapAt = elapsed;
    }

    if (gap > 2000) {
      console.log(`⚠️  GAP ${(gap / 1000).toFixed(1)}s at ${(elapsed / 1000).toFixed(1)}s (chunk #${chunkNum})`);
    }

    // Separate thinking markers from code
    let text = value;
    if (text.includes('__THINKING__') || text.includes('__DONE_THINKING__') || text.startsWith('__REASON__')) {
      if (chunkNum <= 5 || text.includes('__DONE_THINKING__')) {
        console.log(`  [${(elapsed / 1000).toFixed(1)}s] marker: ${text.slice(0, 80)}`);
      }
    } else {
      code += text;
      if (chunkNum <= 5 || chunkNum % 100 === 0) {
        console.log(`  [${(elapsed / 1000).toFixed(1)}s] chunk #${chunkNum} (${value.length} chars): "${text.slice(0, 50)}..."`);
      }
    }

    lastChunkTime = now;
  }

  const totalElapsed = Date.now() - start;
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(`Chunks: ${chunkNum}`);
  console.log(`Code chars: ${code.length}`);
  console.log(`Max gap: ${(maxGap / 1000).toFixed(1)}s at ${(maxGapAt / 1000).toFixed(1)}s`);
  console.log(`Has default export: ${code.includes('export default')}`);

  if (chunkNum <= 3) {
    console.log(`\n🔴 Only ${chunkNum} chunks — stream is being buffered, not streamed incrementally!`);
  }
  if (maxGap > 25000) {
    console.log(`\n🔴 Max gap ${(maxGap / 1000).toFixed(0)}s — likely hitting Vercel timeout!`);
  }
}

main().catch(console.error);
