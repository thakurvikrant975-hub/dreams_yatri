import { Car, Plus } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getVehiclesWithRates } from "./actions";
import { VehiclesClient } from "./VehiclesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vehicles - Dashboard",
  description: "Vehicles management page",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function VehiclesPage() {
  const vehicles = await getVehiclesWithRates();

  return (
    <div className="space-y-6 w-full">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Vehicles</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
 
      <VehiclesClient initialVehicles={vehicles} />
    </div>
  );
}
