"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { loginAdminAction } from "@/lib/actions/auth-actions";
import { getDatabaseMode } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const databaseMode = getDatabaseMode();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (databaseMode === "supabase") {
        const supabase = createClient();
        if (!supabase) throw new Error("Supabase not configured");

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast.success("ورود موفق");
        router.push("/admin");
        router.refresh();
        return;
      }

      const result = await loginAdminAction(email, password);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(databaseMode === "postgres" ? "ورود موفق" : "ورود موفق (حالت mock)");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ورود");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>ورود به پنل مدیریت</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>
          {databaseMode === "mock" && (
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              حالت mock: از ایمیل و رمز پیش‌فرض admin@example.com / admin123 استفاده کنید.
            </p>
          )}
          {databaseMode === "postgres" && (
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              ورود با ADMIN_EMAIL و ADMIN_PASSWORD تنظیم‌شده در سرور.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            ورود
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
