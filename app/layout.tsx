import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/biglogo.svg";
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon, TwitterLogoIcon } from "@radix-ui/react-icons";
import PlausibleProvider from "next-plausible";

let title = "Napkins.dev – Screenshot to code";
let description = "Generate your next app with a screenshot";
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
              href="https://togetherai.link/llama3.2vision/?utm_source=example-app&utm_medium=napkins&utm_campaign=napkins-app-signup"
              target="_blank"
              className="font-bold hover:underline underline-offset-4"
            >
              Together AI
            </a>{" "}
            and{" "}
            <a
              href="https://togetherai.link/llama3.2vision/?utm_source=example-app&utm_medium=napkins&utm_campaign=napkins-app-signup"
              target="_blank"
              className="font-bold hover:underline underline-offset-4"
            >
              Llama 3.2 Vision
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
              <Link href="https://twitter.com/nutlope" target="_blank">
                <TwitterLogoIcon className="size-4" />
                Twitter
              </Link>
            </Button>
          </div>
        </footer>
      </body>
    </html>
  );
}
