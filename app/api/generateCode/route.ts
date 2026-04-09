import { getCodingPrompt } from '@/lib/prompt';

import Together from 'together-ai';
import { z } from 'zod';

let options: ConstructorParameters<typeof Together>[0] = {};

if (process.env.HELICONE_API_KEY) {
  options.baseURL = 'https://together.helicone.ai/v1';
  options.defaultHeaders = {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  };
}

let together = new Together(options);

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
  if (imageUrl.startsWith('/')) {
    imageUrl = new URL(imageUrl, req.url).toString();
  }
  let codingPrompt = getCodingPrompt(shadcn);

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
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  let sentThinking = false;
  let sentDoneThinking = false;
  let textStream = res
    .toReadableStream()
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (chunk) {
            try {
              let parsed = JSON.parse(chunk);
              let choice = parsed.choices?.[0];
              if (!choice) return;

              if (choice.finish_reason) {
                console.log('Stream finished:', choice.finish_reason);
              }

              let reasoning = choice.delta?.reasoning_content || choice.delta?.reasoning;
              if (reasoning) {
                if (!sentThinking) {
                  sentThinking = true;
                  controller.enqueue('__THINKING__');
                }
                controller.enqueue('__REASON__' + reasoning);
                return;
              }

              let text = choice.delta?.content || choice.text;
              if (text) {
                if (sentThinking && !sentDoneThinking) {
                  sentDoneThinking = true;
                  controller.enqueue('__DONE_THINKING__');
                }
                controller.enqueue(text);
              }
            } catch (error) {
              console.error(error);
            }
          }
        },
      })
    )
    .pipeThrough(new TextEncoderStream());

  return new Response(textStream, {
    headers: new Headers({
      'Cache-Control': 'no-cache',
    }),
  });
}

export const runtime = 'edge';
