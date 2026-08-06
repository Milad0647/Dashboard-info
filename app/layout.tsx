import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemedToaster } from "@/components/themed-toaster";
import "./globals.css";

/** Bundled locally so `next build` does not require Google Fonts DNS. */
const vazirmatn = localFont({
  src: "./fonts/vazirmatn-arabic-400.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "گزارش زنده کمپین",
  description: "گزارش زنده پیشرفت کمپین تبلیغاتی",
  icons: {
    icon: [{ url: "/images/logo-tavanir.png", type: "image/png" }],
    apple: [{ url: "/images/logo-tavanir.png", type: "image/png" }],
    shortcut: ["/images/logo-tavanir.png"],
  },
};

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("theme");
    var root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${vazirmatn.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
