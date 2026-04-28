import Link from "next/link";
import { getPackages } from "./actions";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { PlusCircle, Pencil } from "lucide-react";

export default async function PackagesV2Page() {
  const packages = await getPackages();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Packages</h1>
          <p className="text-sm text-muted-foreground">{packages.length} packages total</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/packages/new">
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Package
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Slug</th>
              <th className="text-left px-4 py-3 font-medium">Durations</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {packages.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  No packages yet. Create your first one.
                </td>
              </tr>
            )}
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{pkg.title}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{pkg.slug}</td>
                <td className="px-4 py-3">{pkg.durations.length}</td>
                <td className="px-4 py-3">
                  <Badge variant={pkg.is_active ? "default" : "secondary"}>
                    {pkg.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/packages/${pkg.id}`}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
