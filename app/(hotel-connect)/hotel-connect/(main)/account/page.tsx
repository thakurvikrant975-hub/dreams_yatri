import { redirect } from "next/navigation";
import Link from "next/link";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../components/ConnectHeader";
import { Card } from "@/app/components/ui/Card";
import ProfileSettingsForm from "./ProfileSettingsForm";
import { BankIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

function maskAccountNumber(n: string | null): string {
  if (!n) return "Not added yet";
  const last4 = n.slice(-4);
  return `•••• •••• ${last4}`;
}

export default async function AccountSettingsPage() {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const owner = await db.hotelOwner.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, email_verified: true, phone: true, phone_cc: true },
  });
  if (!owner) redirect("/hotel-connect/login");

  const hotels = await db.hotels.findMany({
    where: { owner_id: session.user.id },
    select: {
      id: true, name: true, property_category: true,
      bank_account_number: true, bank_name: true,
    },
    orderBy: { id: "asc" },
  });

  return (
    <>
      <ConnectHeader title="Account Settings" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-2xl space-y-5">
          <ProfileSettingsForm
            name={owner.name}
            email={owner.email}
            emailVerified={owner.email_verified}
            phone={owner.phone}
            phoneCc={owner.phone_cc}
          />

          <Card variant="elevated" radius="md" className="p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">Bank Accounts</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Payout bank details are set per property, in that property's Finance &amp; Legal tab
              </p>
            </div>

            {hotels.length === 0 ? (
              <p className="text-xs text-neutral-400">You don't have any properties yet.</p>
            ) : (
              <div className="space-y-2">
                {hotels.map((h) => {
                  const financeTab = h.property_category === "HOMESTAY_VILLA" ? 8 : 7;
                  return (
                    <Link
                      key={h.id}
                      href={`/hotel-connect/properties/${h.id}/edit?tab=${financeTab}`}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3.5 hover:border-primary-300 hover:bg-primary-50/30 transition-colors group"
                    >
                      <div className="size-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-400">
                        <BankIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-800 truncate">{h.name}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {maskAccountNumber(h.bank_account_number)}
                          {h.bank_name ? ` · ${h.bank_name}` : ""}
                        </p>
                      </div>
                      <ArrowRightIcon size={14} className="text-neutral-300 group-hover:text-primary-500 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
