import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/biglogo.svg";
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon, TwitterLogoIcon } from "@radix-ui/react-icons";
import PlausibleProvider from "next-plausible";
import { TOGETHER_LINK } from "@/lib/utils";

let title = "Napkins.dev – Screenshot to code";
let description = "Generate your next app with a screenshot using Llama 4";
let url = "https://www.napkins.dev/";
let ogimage = "https://www.napkins.dev/og-image.png";
let sitename = "napkins.dev";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    images: [ogimage],
    title,
    description,
    url: url,
    siteName: sitename,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: [ogimage],
    title,
    description,
  },
};

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <PlausibleProvider domain="napkins.dev" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col font-sans`}
      >
        <header className="sm:mx-10 mx-4 mt-5">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Image src={Logo} alt="Logo" width={400} height={50} />
            </Link>
            <Button
              asChild
              variant="outline"
              className="hidden sm:inline-flex gap-2"
            >
              <Link href="https://github.com/nutlope/napkins" target="_blank">
                <GitHubLogoIcon className="size-4" />
                GitHub
              </Link>
            </Button>
          </div>
        </header>

        <main className="grow flex flex-col">{children}</main>

        <footer className="flex flex-col sm:flex-row items-center justify-between sm:px-10 px-4 pt-20 pb-6 gap-4 sm:gap-0 sm:py-3 text-gray-600 text-sm">
          <p>
            Powered by{" "}
            <a
              href={TOGETHER_LINK}
              target="_blank"
              className="font-bold hover:underline underline-offset-4"
            >
              Together AI
            </a>{" "}
            and{" "}
            <a
              href={TOGETHER_LINK}
              target="_blank"
              className="font-bold hover:underline underline-offset-4"
            >
              Llama 4
            </a>
          </p>
          <div className="flex gap-4">
            <Button asChild variant="ghost" className="gap-2">
              <Link href="https://github.com/nutlope/napkins" target="_blank">
                <GitHubLogoIcon className="size-4" />
                GitHub
              </Link>
            </Button>
            <Button asChild variant="ghost" className="gap-2">
              <Link href="https://x.com/nutlope" target="_blank">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className="size-4"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.79812 5.34371L9.92041 1.71429H9.18053L6.46944 4.86566L4.3041 1.71429H1.80664L5.08106 6.47972L1.80664 10.2857H2.54657L5.40955 6.95777L7.6963 10.2857H10.1938L6.79812 5.34371ZM5.78469 6.52171L5.45292 6.04718L2.81317 2.2713L5.14308 6.00001L7.71451 9.85715L9.18088 9.75405H8.04439L5.78469 6.52171Z"
                    fill="#62748E"
                  ></path>
                  X/Twitter
                </svg>
              </Link>
            </Button>
          </div>
        </footer>
      </body>
    </html>
  );
}
