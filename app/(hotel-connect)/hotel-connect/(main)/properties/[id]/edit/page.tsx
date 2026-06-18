import { notFound } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../../../components/ConnectHeader";
import Link from "next/link";
import { Buildings, ArrowLeft, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotelId = parseInt(id, 10);
  if (isNaN(hotelId)) notFound();

  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, name: true, property_sub_type: true, wizard_step: true },
  });
  if (!hotel) notFound();

  const subTypeLabel = hotel.property_sub_type
    ? hotel.property_sub_type.replace(/_/g, " ")
    : "Property";

  return (
    <>
      <ConnectHeader title={hotel.name} />

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Card className="w-full max-w-lg rounded-xl">
          <CardContent className="py-12 px-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary-500 flex items-center justify-center mb-5">
              <Buildings size={26} weight="fill" color="white" />
            </div>

            <h1 className="text-xl font-bold text-neutral-900 mb-1.5 tracking-tight capitalize">
              {subTypeLabel} listing wizard
            </h1>
            <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
              Property created as a draft. The full listing wizard is coming in the next phase.
            </p>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 mb-6 flex items-center gap-2.5">
              <ListChecks size={16} className="shrink-0" />
              <span><strong>Phase 3 — Wizard shell</strong> coming next.</span>
            </div>

            <Link
              href="/hotel-connect"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              <ArrowLeft size={14} weight="bold" />
              Back to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
