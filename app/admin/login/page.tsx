import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAuthSession } from "@/lib/auth/get-session";
import { resolveSafeAuthRedirect } from "@/lib/auth/safe-redirect";

type AdminLoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await getAuthSession();
  if (session) {
    const params = searchParams ? await searchParams : undefined;
    const nextRaw = params?.next;
    const next = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
    redirect(resolveSafeAuthRedirect(next));
  }

  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
