import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function* readStream(response: ReadableStream) {
  let reader = response.pipeThrough(new TextDecoderStream()).getReader();
  let done = false;

  while (!done) {
    let { value, done: streamDone } = await reader.read();
    done = streamDone;

    if (value) yield value;
  }

  reader.releaseLock();
}

export const TOGETHER_LINK =
  "https://togetherai.link/?utm_source=napkins&utm_medium=referral&utm_campaign=example-app";
