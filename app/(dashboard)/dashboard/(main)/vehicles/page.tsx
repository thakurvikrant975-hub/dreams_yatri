import { Car } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getVehiclesWithRates } from "./actions";
import { VehiclesClient } from "./VehiclesClient";

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

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Car className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} · Manage your vehicle catalog and rates
          </p>
        </div>
      </div>

      <VehiclesClient initialVehicles={vehicles} />
    </div>
  );
}
