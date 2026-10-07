"use client";

import { useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { Module } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { Card, CardContent } from "@/components/ui/card";
import { IconCardHeader } from "@/components/ui/icon-card-header";
import { Switch } from "@/components/ui/switch";

/** Lifecycle and review policy for one module. */
export function ModuleSettingsCard({ module }: { module: Module }) {
  const queryClient = useQueryClient();

  async function update(patch: Partial<Pick<Module, "status" | "requireApproval">>, message: string) {
    try {
      await apiFetch(`/api/modules/${module.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.moduleWithRelations(module.id) });
    } catch (error) {
      errorToast(error);
    }
  }

  const isEnabled = module.status !== "DISABLED";

  return (
    <Card>
      <IconCardHeader
        icon={<Settings2 />}
        title="Module settings"
        description="Disabled modules are skipped by Discover All and Run All, and refuse manual runs."
      />
      <CardContent>
        <div className="divide-y rounded-lg border">
          <SettingRow
            label="Enabled"
            hint="Include this module in discovery and test runs."
            checked={isEnabled}
            onChange={(checked) => void update({ status: checked ? "ACTIVE" : "DISABLED" }, checked ? "Module enabled" : "Module disabled")}
          />
          <SettingRow
            label="Require approval before running"
            hint="Only APPROVED test cases run. Rejected cases never run either way."
            checked={module.requireApproval}
            onChange={(checked) => void update({ requireApproval: checked }, "Approval policy updated")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface SettingRowProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingRow({ label, hint, checked, onChange }: SettingRowProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-hint`} />
    </div>
  );
}
