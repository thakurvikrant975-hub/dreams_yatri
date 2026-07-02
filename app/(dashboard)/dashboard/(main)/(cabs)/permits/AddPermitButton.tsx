"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PermitDialog } from "./PermitDialog";

export function AddPermitButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Permit
      </Button>

      <PermitDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
