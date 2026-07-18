"use client";

import type { PointerEvent } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginAdminAction } from "@/lib/actions/auth-actions";
import { resolveSafeAuthRedirect } from "@/lib/auth/safe-redirect";
import {
  formatPersianClock,
  formatPersianLoginDate,
  getTimeOfDayConfig,
  type TimeOfDayConfig,
} from "@/lib/login-time-of-day";
import { isSupabaseConfigured } from "@/lib/utils";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type CardTiltState = {
  rotateX: number;
  rotateY: number;
};

const INITIAL_TILT: CardTiltState = {
  rotateX: 0,
  rotateY: 0,
};

const MAX_CARD_ROTATION = 8;

const ALL_PERIOD_BACKGROUNDS = [
  "/images/login/morning.webp",
  "/images/login/noon.webp",
  "/images/login/evening.webp",
  "/images/login/night.webp",
] as const;

function getBoundedMotion(value: number, max: number) {
  return Math.max(-max, Math.min(max, value));
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = resolveSafeAuthRedirect(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [tilt, setTilt] = useState<CardTiltState>(INITIAL_TILT);
  const [now, setNow] = useState<Date | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayConfig | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    const syncMotionPreference = () => {
      setMotionEnabled(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setTilt(INITIAL_TILT);
      }
    };

    syncMotionPreference();
    mediaQuery.addEventListener("change", syncMotionPreference);
    return () => mediaQuery.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    const syncClock = () => {
      const current = new Date();
      setNow(current);
      setTimeOfDay(getTimeOfDayConfig(current));
    };

    syncClock();
    const timerId = window.setInterval(syncClock, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const handlePagePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!motionEnabled || event.pointerType !== "mouse") return;

    const relativeX = event.clientX / window.innerWidth;
    const relativeY = event.clientY / window.innerHeight;

    setTilt({
      rotateY: getBoundedMotion((relativeX - 0.5) * MAX_CARD_ROTATION * 2, MAX_CARD_ROTATION),
      rotateX: getBoundedMotion(-(relativeY - 0.5) * MAX_CARD_ROTATION * 2, MAX_CARD_ROTATION),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        if (!supabase) throw new Error("Supabase not configured");

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        window.location.assign(redirectTo);
        return;
      }

      await loginAdminAction(email, password, redirectTo);
    } catch (err) {
      if (isNextRedirectError(err)) return;
      const nextErrorMessage = err instanceof Error ? err.message : "خطا در ورود";
      setErrorMessage(nextErrorMessage);
      toast.error(nextErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="dark relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-white"
      dir="rtl"
      onPointerMove={handlePagePointerMove}
    >
      {ALL_PERIOD_BACKGROUNDS.map((src) => (
        <div
          key={src}
          className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url('${src}')`,
            opacity: timeOfDay?.backgroundSrc === src ? 1 : 0,
          }}
          aria-hidden
        />
      ))}

      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/35 to-black/55"
        aria-hidden
      />

      {now && timeOfDay ? (
        <div
          className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[14rem] text-right sm:bottom-6 sm:right-6 sm:max-w-none"
          aria-live="polite"
        >
          <p className="text-[11px] font-medium text-white/65 [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]">
            {timeOfDay.greeting}
          </p>
          <p
            className="mt-0.5 font-sans text-[1.65rem] font-semibold leading-none text-white tabular-nums sm:text-[1.85rem]"
            style={{
              textShadow: "0 0 24px rgba(255,255,255,0.22), 0 2px 14px rgba(0,0,0,0.55)",
            }}
          >
            {formatPersianClock(now)}
          </p>
          <p className="mt-1.5 text-[10px] leading-snug text-white/45 [text-shadow:0_1px_8px_rgba(0,0,0,0.65)] sm:text-[11px]">
            {formatPersianLoginDate(now)}
          </p>
        </div>
      ) : null}

      <div className="relative z-20 w-full max-w-[460px]" style={{ perspective: "1100px" }}>
        <section
          className="relative overflow-hidden rounded-[32px] border border-white/35 bg-white/[0.08] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-[10px] backdrop-saturate-150 transition-transform duration-150 ease-out will-change-transform md:p-7"
          style={{
            transform: motionEnabled
              ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
              : undefined,
          }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

          <div className="relative">
            <header className="mb-8 flex items-center gap-4 [text-shadow:0_2px_18px_rgba(0,0,0,0.7)]">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                <Image
                  src="/images/logo-tavanir.png"
                  alt="لوگوی توانیر"
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">ورود به سامانه</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">25 درجه قرار همدلی</h1>
                <p className="mt-1 text-sm text-white/78">مدیریت گزارش‌ها و محتوای کمپین</p>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.74)]"
                >
                  نام کاربری
                </Label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="نام کاربری خود را وارد کنید"
                  required
                  dir="rtl"
                  autoComplete="username"
                  className="h-[52px] w-full rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-right text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] outline-none backdrop-blur-sm transition placeholder:text-right placeholder:text-white/45 focus:border-white/50 focus:bg-white/14 focus:ring-4 focus:ring-[#0A84FF]/20"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.74)]"
                >
                  رمز عبور
                </Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={4}
                    placeholder="رمز عبور خود را وارد کنید"
                    autoComplete="current-password"
                    className="h-[52px] w-full rounded-2xl border border-white/30 bg-white/10 py-3 pl-12 pr-4 text-right text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] outline-none backdrop-blur-sm transition placeholder:text-white/45 focus:border-white/50 focus:bg-white/14 focus:ring-4 focus:ring-[#0A84FF]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <p className="rounded-2xl border border-red-300/25 bg-red-500/18 px-4 py-3 text-sm text-red-50 shadow-[0_10px_30px_rgba(127,29,29,0.18)] backdrop-blur-sm [text-shadow:0_2px_10px_rgba(0,0,0,0.62)]">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0A84FF] px-5 py-3 text-base font-bold text-white shadow-[0_16px_42px_rgba(10,132,255,0.38)] transition hover:bg-[#0077ED] focus:outline-none focus:ring-4 focus:ring-[#0A84FF]/32 disabled:cursor-not-allowed disabled:opacity-70 [text-shadow:0_2px_10px_rgba(0,0,0,0.36)]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    در حال ورود...
                  </>
                ) : (
                  "ورود"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/70 [text-shadow:0_2px_14px_rgba(0,0,0,0.82)]">
              سامانه مدیریت گزارش زنده کمپین
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
