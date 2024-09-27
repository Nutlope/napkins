import FirecrawlApp from "@mendable/firecrawl-js";

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return new Response(JSON.stringify({ message: "No URL provided" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

  try {
    const scrapeResponse = await app.scrapeUrl(url, {
      formats: [ "rawHtml","screenshot" ],
    });
    
    const screenshotUrl = scrapeResponse.success ? scrapeResponse.screenshot : null;

    console.log("scrapeResponse:", scrapeResponse);
    if (!screenshotUrl) {
      console.error("Failed to get screenshot:", scrapeResponse.error || "Unknown error");
      return new Response(JSON.stringify({ message: "Failed to get screenshot" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // screenshotData is a base64 encoded string
    return new Response(JSON.stringify({ screenshotUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Error getting screenshot" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}