"use client";

import { useEffect, useState } from "react";
import CodeViewer from "@/components/code-viewer";
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid";
import Link from "next/link";

export default function PreviewPage() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("napkins-preview-code");
    if (stored) {
      setCode(stored);
    }
  }, []);

  function downloadCode() {
    if (!code) return;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "App.tsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code);
  }

  if (code === null) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        <p>No generated code found. Generate an app first.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Copy code
          </button>
          <button
            onClick={downloadCode}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            <ArrowDownTrayIcon className="size-4" />
            Download
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <CodeViewer code={code} />
      </div>
    </>
  );
}
