import { getCodingPrompt } from '@/lib/prompt';

import { runGenerateCodeStream } from '@/lib/together-stream';
import { z } from 'zod';

export async function POST(req: Request) {
  let json = await req.json();
  let result = z
    .object({
      model: z.string(),
      imageUrl: z.string(),
      shadcn: z.boolean().default(false),
    })
    .safeParse(json);

  if (result.error) {
    return new Response(result.error.message, { status: 422 });
  }

  let { model, imageUrl, shadcn } = result.data;
  let codingPrompt = getCodingPrompt(shadcn);
  let encoder = new TextEncoder();
  let textStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runGenerateCodeStream({
          model,
          codingPrompt,
          imageUrl,
          onChunk(chunk) {
            controller.enqueue(encoder.encode(chunk));
          },
          onFinishReason(reason) {
            if (reason) {
              console.log('Stream finished:', reason);
            }
          },
          onRetry(attempt, error) {
            console.log(
              `Retrying generateCode: attempt ${attempt}/3 for ${model}`,
              error
            );
          },
        });
        controller.close();
      } catch (error) {
        console.error(error);
        controller.error(error);
      }
    },
  });

  return new Response(textStream, {
    headers: new Headers({
      'Cache-Control': 'no-cache',
    }),
  });
}

export const runtime = 'edge';
