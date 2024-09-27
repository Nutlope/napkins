/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useS3Upload } from "next-s3-upload";
import { PhotoIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { FileUploader } from "react-drag-drop-files";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CodeViewer from "@/components/code-viewer";
import { AnimatePresence, motion } from "framer-motion";
import ShimmerButton from "@/components/ui/shimmerbutton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import LoadingDots from "@/components/loading-dots";
import { readStream } from "@/lib/utils";

export default function UploadComponent() {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isFetchingScreenshot, setIsFetchingScreenshot] = useState(false);
  let [status, setStatus] = useState<
    "initial" | "uploading" | "uploaded" | "creating" | "created"
  >("initial");
  let [model, setModel] = useState(
    "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo"
  );
  const [generatedCode, setGeneratedCode] = useState("");
  const [shadcn, setShadcn] = useState(true);
  const [buildingMessage, setBuildingMessage] = useState(
    "Reading the image..."
  );

  let loading = status === "creating";

  useEffect(() => {
    let el = document.querySelector(".cm-scroller");
    if (el && loading) {
      let end = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: end });
    }
  }, [loading, generatedCode]);

  const { uploadToS3 } = useS3Upload();

  const handleFileChange = async (file: File) => {
    let objectUrl = URL.createObjectURL(file);
    setStatus("uploading");
    setImageUrl(objectUrl);
    const { url } = await uploadToS3(file);
    setImageUrl(url);
    setStatus("uploaded");
  };

  async function fetchScreenshotFromUrl(url: string) {
    setIsFetchingScreenshot(true);
    setStatus("uploading");
    try {
      const res = await fetch("/api/firecrawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to get screenshot");
      }

      const data = await res.json();
      console.log("data:", data);
      const { screenshotUrl } = data;
      console.log("screenshotUrl:", screenshotUrl);

      if (screenshotUrl) {
        setImageUrl(screenshotUrl);
        setStatus("uploaded");
      } else {
        throw new Error("No screenshot URL received");
      }
    } catch (error) {
      console.error("Error fetching screenshot:", error);
      setStatus("initial");
      alert(error instanceof Error ? error.message : "Failed to get screenshot from the website URL.");
    } finally {
      setIsFetchingScreenshot(false);
    }
  }

  // Removed the useEffect hook that automatically fetched screenshots

  async function createApp() {
    if (!imageUrl) {
      alert("Please upload an image or enter a valid website URL.");
      setStatus("initial");
      return;
    }

    setStatus("creating");
    setGeneratedCode("");
    setBuildingMessage("Analyzing the image...");

    // Set a timeout to change the message after 10 seconds
    setTimeout(() => {
      setBuildingMessage("Building your app...");
    }, 10000);

    let res = await fetch("/api/generateCode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        shadcn,
        imageUrl,
      }),
    });

    if (!res.ok) throw new Error(res.statusText);
    if (!res.body) throw new Error("No response body");

    for await (let chunk of readStream(res.body)) {
      setGeneratedCode((prev) => prev + chunk);
    }

    setStatus("created");
  }

  function handleSampleImage() {
    setImageUrl(
      "https://napkinsdev.s3.us-east-1.amazonaws.com/next-s3-uploads/be191fc8-149b-43eb-b434-baf883986c2c/appointment-booking.png"
    );
    setStatus("uploaded");
  }

  return (
    <div className="flex justify-center mt-5 mx-10 gap-5 sm:flex-row flex-col grow">
      {status === "initial" ||
      status === "uploading" ||
      status === "uploaded" ? (
        <div className="flex-1 w-full flex-col flex justify-center items-center text-center mx-auto">
          <div className="max-w-xl text-center">
            <img src="/hero-3.svg" alt="Hero" className="mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-balance tracking-tight">
              Turn your wireframe into an app
            </h1>
            <div className="max-w-md text-center mx-auto">
              <p className="text-lg text-gray-500 mt-4 text-center">
                Upload an image of your website design or enter a website URL, and we'll build it for
                you with React + Tailwind.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 w-full h-[80vh] overflow-x-hidden">
          <div className="isolate h-full">
            <CodeViewer code={generatedCode} showEditor />
          </div>

          <AnimatePresence>
            {status === "creating" && (
              <motion.div
                initial={{ x: "80%" }}
                animate={{ x: "0%" }}
                exit={{ x: "80%" }}
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: 0.85,
                  delay: 0.1,
                }}
                className="absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center rounded-r border border-gray-400 bg-gradient-to-br from-gray-100 to-gray-300 md:inset-y-0 md:left-1/2 md:right-0"
              >
                <p className="animate-pulse text-3xl font-bold">
                  {status === "creating" && buildingMessage}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="w-full max-w-xs gap-4 flex flex-col mx-auto">
        {imageUrl ? (
          <div className="relative mt-2">
            <div className="rounded-xl">
              <img
                alt="Screenshot"
                src={imageUrl}
                className="w-full group object-cover relative"
              />
            </div>
            <button
              className="absolute size-10 text-gray-900 bg-white hover:text-gray-500 rounded-full -top-3 z-10 -right-3"
              onClick={() => {
                setImageUrl("");
                setWebsiteUrl("");
                setStatus("initial");
              }}
            >
              <XCircleIcon />
            </button>
          </div>
        ) : (
          <>
            <FileUploader
              handleChange={handleFileChange}
              name="file"
              label="Upload or drop an image here"
              types={["png", "jpg", "jpeg"]}
              required={true}
              multiple={false}
              hoverTitle="Drop here"
            >
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 cursor-pointer">
                <div className="text-center">
                  <PhotoIcon
                    className="mx-auto h-12 w-12 text-gray-300"
                    aria-hidden="true"
                  />
                  <div className="mt-4 flex text-sm leading-6 text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative rounded-md bg-white font-semibold text-black focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-gray-700"
                    >
                      <div>Upload a screenshot</div>
                      <p className="font-normal text-gray-600 text-xs mt-1">
                        or drag and drop
                      </p>
                    </label>
                  </div>
                </div>
              </div>
            </FileUploader>
            
            <div className="flex items-center justify-center my-2">
              <div className="w-full border-t border-gray-300"></div>
              <span className="bg-white px-3 text-sm text-gray-500">or</span>
              <div className="w-full border-t border-gray-300"></div>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="Enter website URL"
                className="w-full px-3 py-2 pr-10 border rounded-md"
              />
              <button
                onClick={() => fetchScreenshotFromUrl(websiteUrl)}
                disabled={isFetchingScreenshot || !websiteUrl}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 bg-gray-700 text-white rounded-md disabled:bg-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {isFetchingScreenshot && (
              <div className="flex items-center mt-2">
                <LoadingDots color="#000" style="small" />
                <span className="ml-2 text-sm text-gray-600">
                  Fetching screenshot with Firecrawl...
                </span>
              </div>
            )}
            <div className="text-center mt-2">
              <button
                className="font-medium text-blue-400 text-sm underline decoration-transparent hover:decoration-blue-200 decoration-2 underline-offset-4 transition hover:text-blue-500"
                onClick={handleSampleImage}
              >
                Need an example image? Try ours.
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap">AI Model:</label>
          <Select
            value={model}
            onValueChange={setModel}
            defaultValue={model}
          >
            <SelectTrigger className="">
              <img src="/meta.svg" alt="Meta" className="size-5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"
                className="flex items-center justify-center gap-3"
              >
                Llama 3.2 11B Vision
              </SelectItem>
              <SelectItem
                value="meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo"
                className="flex items-center justify-center gap-3"
              >
                Llama 3.2 90B Vision
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ShimmerButton
                  className="shadow-2xl disabled:cursor-not-allowed w-full relative disabled:opacity-50"
                  onClick={createApp}
                  disabled={
                    status === "creating" ||
                    !imageUrl ||
                    isFetchingScreenshot
                  }
                >
                  <span
                    className={`${
                      loading ? "opacity-0" : "opacity-100"
                    } whitespace-pre-wrap text-center font-semibold leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 `}
                  >
                    Generate app
                  </span>

                  {loading && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <LoadingDots color="#fff" style="medium" />
                    </span>
                  )}
                </ShimmerButton>
              </div>
            </TooltipTrigger>

            {(!imageUrl || isFetchingScreenshot) && (
              <TooltipContent>
                {isFetchingScreenshot ? (
                  <p>Fetching screenshot...</p>
                ) : (
                  <p>Please upload an image or enter a website URL first</p>
                )}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
