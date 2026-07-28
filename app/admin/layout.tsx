import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پنل مدیریت",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
