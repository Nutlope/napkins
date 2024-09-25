import shadcnDocs from "@/lib/shadcn-docs";
import dedent from "dedent";
import Together from "together-ai";
import { z } from "zod";

let options: ConstructorParameters<typeof Together>[0] = {};

// if (process.env.HELICONE_API_KEY) {
//   options.baseURL = "https://together.helicone.ai/v1";
//   options.defaultHeaders = {
//     "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
//   };
// }

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
  let codingPrompt = getCodingPrompt(shadcn);

  const initialCode = await together.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        // @ts-expect-error Need to fix the TypeScript library type
        content: [
          { type: "text", text: getDescriptionPrompt },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  console.log({ initialCode });

  let descriptionFromLlama = initialCode.choices[0].message?.content;

  let res = await together.chat.completions.create({
    model: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    // max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: codingPrompt,
      },
      {
        role: "user",
        content:
          descriptionFromLlama +
          "\nPlease ONLY return code, NO backticks or language names.",
      },
    ],
    stream: true,
    temperature: 0.2,
  });

  let textStream = res
    .toReadableStream()
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (chunk) {
            try {
              let text = JSON.parse(chunk).choices[0].text;
              if (text) controller.enqueue(text);
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
      "Cache-Control": "no-cache",
    }),
  });
}

let getDescriptionPrompt = `Describe the attached screenshot or UI mockup in detail. I will send what you give me to a developer to recreate the original screenshot that I sent you. Please listen very carefully. It's very important for my job that you follow these instructions:

- Think step by step and describe the UI in great detail.
- Make sure to describe where everything is in the UI so the developer can recreate it
- Pay close attention to background color, text color, font size, font family, padding, margin, border, etc. Match the colors and sizes exactly.
- Make sure to mention every part of the screenshot including any headers, footers, etc.
- Use the exact text from the screenshot.
`;

function getCodingPrompt(shadcn: boolean) {
  let systemPrompt = `
You are an expert frontend React/Tailwind developer. You will be given a description of a reference web page from the user, and then you will return code for a single page app using React and Tailwind CSS. Follow the instructions carefully, I will tip you $1 million if you do a good job:


- Think carefully step by step about how to recreate the UI described in the prompt.
- Create a React component for whatever the user asked you to create and make sure it can run by itself by using a default export
- Feel free to have multiple components in the file, but make sure to have one main component that uses all the other components
- Make sure the react component looks exactly like the UI described in the prompt.
- Pay close attention to background color, text color, font size, font family, padding, margin, border, etc. Match the colors and sizes exactly.
- Make sure to code every part of the description including any headers, footers, etc.
- Use the exact text from the description for the UI elements.
- Do not add comments in the code such as "<!-- Add other navigation links as needed -->" and "<!-- ... other news items ... -->" in place of writing the full code. WRITE THE FULL CODE.
- Repeat elements as needed to match the description. For example, if there are 15 items, the code should have 15 items. DO NOT LEAVE comments like "<!-- Repeat for each news item -->" or bad things will happen.
- For images, use placeholder images and include a detailed description of the image in the alt text so that an image generation AI can generate the image later.
- Make sure the React app is interactive and functional by creating state when needed and having no required props
- If you use any imports from React like useState or useEffect, make sure to import them directly
- Use TypeScript as the language for the React component
- Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`). Make sure to use a consistent color palette.
- Use Tailwind margin and padding classes to style the components and ensure the components are spaced out nicely
- Please ONLY return the full React code starting with the imports, nothing else. It's very important for my job that you only return the React code with imports. DO NOT START WITH \`\`\`typescript or \`\`\`javascript or \`\`\`tsx or \`\`\`.
- ONLY IF the user asks for a dashboard, graph or chart, the recharts library is available to be imported, e.g. \`import { LineChart, XAxis, ... } from "recharts"\` & \`<LineChart ...><XAxis dataKey="name"> ...\`. Please only use this when needed.
- If you need an icon, please create an SVG for it and use it in the code. DO NOT IMPORT AN ICON FROM A LIBRARY.
  `;

  // Removed because it causes too many errors
  // - The lucide-react@0.263.1 library is also available to be imported. If you need an icon, use one from lucide-react. Here's an example of importing and using one: import { Camera } from "lucide-react"\` & \`<Camera color="red" size={48} />\`

  if (shadcn) {
    systemPrompt += `
    There are some prestyled components available for use. Please use your best judgement to use any of these components if the app calls for one.

    Here are the components that are available, along with how to import them, and how to use them:

    ${shadcnDocs
      .map(
        (component) => `
          <component>
          <name>
          ${component.name}
          </name>
          <import-instructions>
          ${component.importDocs}
          </import-instructions>
          <usage-instructions>
          ${component.usageDocs}
          </usage-instructions>
          </component>
        `
      )
      .join("\n")}
    `;
  }

  systemPrompt += `
    NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.
  `;

  return dedent(systemPrompt);
}

export const runtime = "edge";
