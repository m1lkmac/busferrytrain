import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "busferrytrain.com | Find Bus, Ferry & Train Routes",
  description:
    "Search and compare bus, ferry, and train routes across Southeast Asia. Find the best prices and schedules for your journey.",
  keywords: [
    "bus tickets",
    "ferry tickets",
    "train tickets",
    "Thailand travel",
    "Southeast Asia transport",
    "travel booking",
  ],
  openGraph: {
    title: "busferrytrain.com | Find Bus, Ferry & Train Routes",
    description:
      "Search and compare bus, ferry, and train routes across Southeast Asia.",
    type: "website",
    locale: "en_US",
    siteName: "busferrytrain.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "busferrytrain.com",
              url: "https://busferrytrain.com",
              description:
                "Meta-search for bus, ferry, and train routes in Southeast Asia",
              potentialAction: {
                "@type": "SearchAction",
                target:
                  "https://busferrytrain.com/?from={from}&to={to}&date={date}",
                "query-input":
                  "required name=from required name=to required name=date",
              },
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
