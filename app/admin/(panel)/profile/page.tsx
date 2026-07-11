import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettingsForm } from "@/components/admin/profile-settings-form";
import { getAuthSession } from "@/lib/auth/get-session";
import { pgGetUserById } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

export default async function ProfilePage() {
  const session = await getAuthSession();
  if (!session?.userId) redirect("/admin/login");
  if (!isPostgresConfigured()) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          ویرایش پروفایل فقط با اتصال به پایگاه داده فعال است.
        </CardContent>
      </Card>
    );
  }

  const user = await pgGetUserById(session.userId);
  if (!user) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پروفایل من</h1>
        <p className="text-sm text-muted-foreground">
          نام، مسئول اکانت و استان شما در گزارش‌ها و لیست کاربران نمایش داده می‌شود.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">اطلاعات حساب</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileSettingsForm
            initialName={user.name}
            initialProvince={user.province}
            initialCity={user.city}
            initialAccountManagerName={user.accountManagerName}
            initialRegion={user.region}
            email={user.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
