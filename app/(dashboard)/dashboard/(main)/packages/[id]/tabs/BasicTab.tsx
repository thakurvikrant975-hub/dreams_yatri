"use client";

import { PackageForm } from "../../components/PackageForm";

type PackageRow = {
  id: number;
  title: string;
  destination_id: number;
  description: string | null;
  thumbnail: string | null;
  cover_image: string | null;
  is_active: boolean;
};

type Props = {
  pkg: PackageRow;
  destinationLabel?: string;
};

export function BasicTab({ pkg, destinationLabel }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Basic Information</h2>
        <p className="text-sm text-muted-foreground">Update the package title, destination, images and status.</p>
      </div>
      <PackageForm initial={pkg} destinationLabel={destinationLabel} />
    </div>
  );
}
