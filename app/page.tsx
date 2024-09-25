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
  let [status, setStatus] = useState<
    "initial" | "uploading" | "uploaded" | "creating" | "created"
  >("initial");
  let [model, setModel] = useState("nltpt/90b-instruct-turbo");
  const [generatedCode, setGeneratedCode] = useState("");
  const [shadcn, setShadcn] = useState(true);

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

  async function createApp() {
    setStatus("creating");
    setGeneratedCode("");

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

  return (
    <div className="flex justify-center mt-5 mx-10 gap-5 sm:flex-row flex-col grow">
      {status === "initial" ||
      status === "uploading" ||
      status === "uploaded" ? (
        <div className="flex-1 w-full flex-col flex justify-center items-center text-center mx-auto">
          <div className="max-w-xl text-center">
            <img src="/hero-2.svg" alt="Hero" className="mx-auto mb-6" />
            <h1 className="text-4xl font-bold">
              Turn your wireframe into an app
            </h1>
            <div className="max-w-md text-center mx-auto">
              <p className="text-lg text-gray-500 mt-4 text-center">
                Upload a screenshot or UI mockup of a website and we’ll build it
                for you with React + Tailwind.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 w-full overflow-hidden">
          <div className="isolate h-full">
            <CodeViewer code={generatedCode} showEditor />
          </div>

          <AnimatePresence>
            {status === "creating" && (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: "0%" }}
                exit={{ x: "100%" }}
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: 0.85,
                  delay: 0.1,
                }}
                className="absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center rounded-r border border-gray-400 bg-gradient-to-br from-gray-100 to-gray-300 md:inset-y-0 md:left-1/2 md:right-0"
              >
                <p className="animate-pulse text-3xl font-bold">
                  {status === "creating"
                    ? "Building your app..."
                    : "Updating your app..."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="w-full max-w-xs gap-4 flex flex-col">
        {imageUrl ? (
          <div className="relative mt-2">
            <div className="rounded-xl">
              <img
                alt="Screenshot"
                src={imageUrl}
                className="w-full group object-cover relative"
              />
            </div>
            <button className="absolute size-10 text-gray-900 bg-white hover:text-gray-500 rounded-full -top-3 z-10 -right-3">
              <XCircleIcon onClick={() => setImageUrl("")} />
            </button>
          </div>
        ) : (
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
                    <div>Upload a screenshot / sketch</div>
                    <p className="font-normal text-gray-600 text-xs mt-1">
                      or drag and drop
                    </p>
                  </label>
                </div>
              </div>
            </div>
          </FileUploader>
        )}
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap">AI Model:</label>
          <Select value={model} onValueChange={setModel} defaultValue={model}>
            <SelectTrigger className="">
              <img src="/meta.svg" alt="Meta" className="size-5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="nltpt/11b-instruct-turbo"
                className="flex items-center justify-center gap-3"
              >
                Llama 3.2 11B Vision
              </SelectItem>
              <SelectItem
                value="nltpt/90b-instruct-turbo"
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
                  className="shadow-2xl disabled:cursor-not-allowed w-full relative"
                  onClick={createApp}
                  disabled={
                    status === "initial" ||
                    status === "uploading" ||
                    status === "creating"
                  }
                >
                  <span
                    className={`${status === "creating" ? "opacity-0" : "opacity-100"} whitespace-pre-wrap text-center font-semibold leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10`}
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

            {status === "initial" && (
              <TooltipContent>
                <p>Please upload an image first</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
