import shadcnDocs from '@/lib/shadcn-docs';
import dedent from 'dedent';
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
  let codingPrompt = getCodingPrompt(shadcn);

  const res = await together.chat.completions.create({
    model,
    temperature: 0.2,
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
      'Cache-Control': 'no-cache',
    }),
  });
}

function getCodingPrompt(shadcn: boolean) {
  let systemPrompt = `
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
  `;

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
      .join('\n')}
    `;
  }

  systemPrompt += `
    NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.
  `;

  systemPrompt += `
  Here are some examples of good outputs:


${examples
  .map(
    (example) => `
      <example>
      <input>
      ${example.input}
      </input>
      <output>
      ${example.output}
      </output>
      </example>
  `
  )
  .join('\n')}
  `;

  return dedent(systemPrompt);
}

export const runtime = 'edge';

let examples = [
  {
    input: `A landing page screenshot`,
    output: `
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
    `,
  },
];
