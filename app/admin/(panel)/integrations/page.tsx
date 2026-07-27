import { redirect } from "next/navigation";

/** Map-Bilboard integration was removed; keep old bookmarks from 404ing. */
export default function IntegrationsRedirectPage() {
  redirect("/admin");
}
