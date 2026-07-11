import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCampaignList } from "@/lib/data-access/campaign";
import { formatPersianDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const campaigns = await getCampaignList();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-right">
              <h1 className="mb-2 text-3xl font-bold">گزارش زنده کمپین</h1>
              <p className="max-w-xl text-muted-foreground">
                گزارش پیشرفت کمپین‌های تبلیغاتی — یک کمپین را انتخاب کنید
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="outline" className="shrink-0">
                <Link href="/admin/login">
                  <LogIn className="h-4 w-4" />
                  ورود به پنل
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        {campaigns.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border rounded-xl bg-card">
            کمپین منتشرشده‌ای وجود ندارد.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaign/${campaign.slug}`}>
                <Card className="overflow-hidden h-full hover:shadow-lg transition-all hover:ring-2 hover:ring-primary/30 group">
                  <div className="relative aspect-[16/7] bg-muted overflow-hidden">
                    {campaign.coverImageUrl ? (
                      <Image
                        src={campaign.coverImageUrl}
                        alt={campaign.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                        بدون تصویر
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge status={campaign.status}>
                        {campaign.status === "live" ? "زنده" : campaign.status === "completed" ? "پایان‌یافته" : "پیش‌نویس"}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <h2 className="font-bold text-lg leading-tight">{campaign.title}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-2">{campaign.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {formatPersianDate(campaign.startDate)} — {formatPersianDate(campaign.endDate)}
                      </span>
                    </div>
                    <p className="text-sm text-primary font-medium flex items-center gap-1 pt-1">
                      مشاهده گزارش
                      <ArrowLeft className="h-4 w-4" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
