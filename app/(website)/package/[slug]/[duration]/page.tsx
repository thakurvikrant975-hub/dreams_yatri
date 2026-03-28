import { redirect, notFound } from "next/navigation";
import { db }                 from "@/app/lib/db";

type RouteOption = { slug: string; is_default: boolean };

export default async function DurationRedirectPage({
  params,
}: {
  params: Promise<{ slug: string; duration: string }>;
}) {
  const { slug, duration } = await params;

  const pkg = await db.packages.findUnique({
    where:  { slug },
    select: {
      durations: {
        where:  { slug: duration, is_active: true },
        select: { routes: true },
        take:   1,
      },
      stay_categories: {
        where:   { is_active: true },
        orderBy: { sort_order: "asc" },
        select:  { slug: true, is_default: true },
        take:    3,
      },
    },
  });

  if (!pkg || !pkg.durations[0]) notFound();

  const routes       = pkg.durations[0].routes as RouteOption[];
  const defaultRoute = routes.find(r => r.is_default) ?? routes[0];
  const defaultStay  =
    pkg.stay_categories.find(s => s.is_default) ?? pkg.stay_categories[0];

  if (!defaultRoute || !defaultStay) notFound();

  redirect(`/package/${slug}/${duration}/${defaultRoute.slug}/${defaultStay.slug}`);
}