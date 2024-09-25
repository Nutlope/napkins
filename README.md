<a href="https://www.napkins.dev">
  <img alt="Napkins" src="./public/og-image.png">
  <h1 align="center">Napkins.dev</h1>
</a>

<p align="center">
  An open source wireframe to app generator. Powered by Llama 3.2 Vision & Together.ai.
</p>

## Tech stack

- [Llama 3.1 405B](https://ai.meta.com/blog/meta-llama-3-1/) from Meta for the LLM
- [Llama 3.2 Vision](https://ai.meta.com/blog/meta-llama-3-1/) from Meta for the Vision model
- [Together AI](https://dub.sh/llama3.2vision/?utm_source=example-app&utm_medium=napkins&utm_campaign=napkins-app-signup) for LLM inference
- [Sandpack](https://sandpack.codesandbox.io/) for the code sandbox
- [S3](https://aws.amazon.com/s3/) for image storage
- Next.js app router with Tailwind
- Helicone for observability
- Plausible for website analytics

## Cloning & running

1. Clone the repo: `git clone https://github.com/Nutlope/napkins`
2. Create a `.env` file and add your [Together AI API key](https://dub.sh/llama3.2vision/?utm_source=example-app&utm_medium=napkins&utm_campaign=napkins-app-signup): `TOGETHER_API_KEY=`
3. Create an S3 bucket and add the credentials to your `.env` file. Follow [this guide](https://next-s3-upload.codingvalue.com/setup) to set them up. All required values are in the `.env.example` file.
4. Run `npm install` and `npm run dev` to install dependencies and run locally

## Future Tasks

- [ ] Make sure it looks nicer and less cluttered on mobile
- [ ] On the sidebar, show the output from the vision model
- [ ] Experiment with making it better through few shot prompts
- [ ] Add a shadcn toggle to allow folks to use or not use it
- [ ] Allow folks to edit the generated app with a prompt
- [ ] Allow folks to choose from different themes
- [ ] Show versions as the user edits the app
