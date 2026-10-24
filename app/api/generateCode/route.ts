import { getCodingPrompt } from '@/lib/prompt';
import { NAPKINS_MODEL } from '@/lib/model';

import Together from 'together-ai';
import { z } from 'zod';

let together = new Together();

export async function POST(req: Request) {
  let json = await req.json();
  let result = z
    .object({
      imageUrl: z.string(),
      shadcn: z.boolean().default(false),
    })
    .safeParse(json);

  if (result.error) {
    return new Response(result.error.message, { status: 422 });
  }

  let { imageUrl, shadcn } = result.data;
  let codingPrompt = getCodingPrompt(shadcn);

  const res = await (together.chat.completions.create as Function)({
    model: NAPKINS_MODEL.id,
    temperature: NAPKINS_MODEL.temperature,
    top_p: NAPKINS_MODEL.topP,
    max_tokens: 65536,
    stream: true,
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
