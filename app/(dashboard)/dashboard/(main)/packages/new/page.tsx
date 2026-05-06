import { PackageForm } from "../components/PackageForm";

export default function NewPackagePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Create New Package</h1>
      <PackageForm />
    </div>
  );
}   