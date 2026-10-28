import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleRoot } from "@/components/locale-root";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/logo";
import "./globals.css";

const sans = Figtree({ variable: "--font-sans", subsets: ["latin"] });
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "StudyBuddy", template: "%s · StudyBuddy" },
  description:
    "Upload your course material and study it with a patient AI tutor.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf6" },
    { media: "(prefers-color-scheme: dark)", color: "#16191f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            <Suspense fallback={<HeaderFallback />}>
              <LocaleRoot>
                <SiteHeader />
                <main className="flex flex-1 flex-col">{children}</main>
              </LocaleRoot>
            </Suspense>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </div>
    </header>
  );
}
