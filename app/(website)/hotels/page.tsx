import { headers } from "next/headers";
import { HotelsClient } from "./hotelsClient";
import { fetchHotelsSSR } from "@/app/types/hotels/hotels";



export default async function HotelsPage() {

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const initialData = await fetchHotelsSSR({ page: 1, limit: 12 }, baseUrl);

  return (
    <HotelsClient
      initialHotels={initialData.data}
      initialMeta={initialData.meta}
    />
  )
}
