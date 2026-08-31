"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { createSalesTeam } from "./actions";

export function CreateSalesTeamDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (name.trim().length < 2) { toast.error("Team name must be at least 2 characters"); return; }

    startTransition(async () => {
      const result = await createSalesTeam({ name: name.trim() });
      if (!result.success) { toast.error(result.error); return; }
      toast.success(`Team "${name.trim()}" created`);
      setOpen(false);
      setName("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setName(""); }}>
      <DialogTrigger asChild>
        <Button className="rounded-md bg-dashboard-primary text-dashboard-base-100 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100">
          <Plus /> New team
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create sales team</DialogTitle>
          <DialogDescription>
            Give the team a name or nickname (e.g. &ldquo;Sales Warriors&rdquo;). You can assign a leader and members after creating it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 py-2">
          <Label>Team name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sales Warriors"
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="bg-dashboard-primary">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
