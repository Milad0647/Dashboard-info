import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute left-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-2">
        <AdminLoginForm />
        <p className="text-center text-xs text-muted-foreground">
          ورود با حساب مدیریت تنظیم‌شده در سرور
        </p>
      </div>
    </div>
  );
}
