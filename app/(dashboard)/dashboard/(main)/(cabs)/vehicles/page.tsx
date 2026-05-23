import { Car, Plus } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
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
 
      <VehiclesClient initialVehicles={vehicles} />
    </div>
  );
}
