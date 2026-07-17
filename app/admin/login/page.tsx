import { Orbitron } from "next/font/google";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-login-clock",
});

export default function AdminLoginPage() {
  return <AdminLoginForm clockFontClassName={orbitron.variable} />;
}
