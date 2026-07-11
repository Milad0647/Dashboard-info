import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { ThemedToaster } from "@/components/themed-toaster";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "گزارش زنده کمپین",
  description: "گزارش زنده پیشرفت کمپین تبلیغاتی",
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
      root.style.colorScheme = "light";
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

