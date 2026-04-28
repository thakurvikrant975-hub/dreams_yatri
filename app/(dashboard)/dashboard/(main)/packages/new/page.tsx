import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PackageForm } from "../components/PackageForm";

export default function NewPackagePage() {
  return (
    <div className="p-6  mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/packages"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Create Package</h1>
          <p className="text-sm text-muted-foreground">Fill in the details to create a new package</p>
        </div>
      </div>

      <div className="border rounded-xl p-6">
        <PackageForm />
      </div>
    </div>
  );
}
