import Together from 'together-ai';

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [0, 750, 2000];

let options: ConstructorParameters<typeof Together>[0] = {};

if (process.env.HELICONE_API_KEY) {
  options.baseURL = 'https://together.helicone.ai/v1';
  options.defaultHeaders = {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  };
}

export const together = new Together(options);

export function isRetryableError(error: unknown) {
  let status =
    typeof error === 'object' && error
      ? (error as { status?: number; statusCode?: number }).status ||
        (error as { status?: number; statusCode?: number }).statusCode
      : undefined;
  let message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: string }).message)
      : String(error || '');

  if (status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }

  return /premature close|timeout|timed out|fetch failed|network|socket hang up|econnreset|overloaded/i.test(
    message
  );
}

export async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface RunGenerateCodeStreamParams {
  codingPrompt: string;
  imageUrl: string;
  maxAttempts?: number;
  model: string;
  onChunk: (chunk: string) => void;
  onFinishReason?: (reason: string | null) => void;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function runGenerateCodeStream({
  model,
  codingPrompt,
  imageUrl,
  onChunk,
  onFinishReason,
  onRetry,
  maxAttempts = MAX_ATTEMPTS,
}: RunGenerateCodeStreamParams) {
  let sentThinking = false;
  let sentDoneThinking = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let bufferedCode = '';
      let finishReason: string | null = null;
      let res = await (together.chat.completions.create as Function)({
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

      let reader = res
        .toReadableStream()
        .pipeThrough(new TextDecoderStream())
        .getReader();

      while (true) {
        let { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        try {
          let parsed = JSON.parse(value);
          let choice = parsed.choices?.[0];
          if (!choice) continue;

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
            onFinishReason?.(choice.finish_reason);
          }

          let reasoning =
            choice.delta?.reasoning_content || choice.delta?.reasoning;
          if (reasoning) {
            if (!sentThinking) {
              sentThinking = true;
              onChunk('__THINKING__');
            }
            onChunk('__REASON__' + reasoning);
            continue;
          }

          let text = choice.delta?.content || choice.text;
          if (text) {
            bufferedCode += text;
          }
        } catch (error) {
          console.error(error);
        }
      }

      if (finishReason !== 'stop') {
        throw new Error(`stream_incomplete_finish_${finishReason ?? 'null'}`);
      }

      if (bufferedCode) {
        if (sentThinking && !sentDoneThinking) {
          sentDoneThinking = true;
          onChunk('__DONE_THINKING__');
        }
        onChunk(bufferedCode);
      }

      return { attemptsUsed: attempt };
    } catch (error) {
      let canRetry = attempt < maxAttempts && isRetryableError(error);

      if (!canRetry) {
        throw error;
      }

      onRetry?.(attempt + 1, error);
      await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS.at(-1) || 0);
    }
  }

  return { attemptsUsed: maxAttempts };
}
