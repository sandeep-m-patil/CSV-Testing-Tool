"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface TestDataSetRow {
  id: string;
  moduleId: string;
  name: string;
  dataType: "KEY_VALUE" | "CSV_TEMPLATE";
}

export function TestDataManager({ moduleId, initial }: { moduleId: string; initial?: TestDataSetRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-primary" />
          Test data
        </CardTitle>
        <CardDescription>
          Reusable datasets scoped to this module — key/value constants and CSV templates for multi-row scenarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!initial && <Skeleton className="h-20 rounded-lg" />}
        {initial && initial.length === 0 && <p className="text-sm text-muted-foreground">No datasets yet.</p>}
        {initial?.map((dataset) => (
          <DataSetRowView key={dataset.id} dataset={dataset} moduleId={moduleId} />
        ))}
        <AddDataSetForm moduleId={moduleId} />
      </CardContent>
    </Card>
  );
}

function DataSetRowView({ dataset, moduleId }: { dataset: TestDataSetRow; moduleId: string }) {
  const queryClient = useQueryClient();

  async function remove() {
    if (!confirm(`Delete dataset "${dataset.name}"?`)) return;
    try {
      await apiFetch(`/api/modules/${moduleId}/test-data?id=${dataset.id}`, { method: "DELETE" });
      toast.success("Dataset deleted");
      await queryClient.invalidateQueries({ queryKey: queryKeys.moduleWithRelations(moduleId) });
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{dataset.name}</p>
        <Badge variant="muted" className="mt-1">
          {dataset.dataType === "CSV_TEMPLATE" ? "CSV template" : "Key/value"}
        </Badge>
      </div>
      <Button variant="ghost" size="icon" aria-label={`Delete ${dataset.name}`} onClick={() => void remove()}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

function AddDataSetForm({ moduleId }: { moduleId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<"KEY_VALUE" | "CSV_TEMPLATE">("KEY_VALUE");
  const [keyValues, setKeyValues] = useState("");
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  type Payload = {
    name: string;
    dataType: "KEY_VALUE" | "CSV_TEMPLATE";
    keyValues?: Record<string, string>;
    csv?: string;
  };

  function buildPayload(): Payload | null {
    const record: Payload = { name, dataType };

    if (dataType === "KEY_VALUE") {
      const values = parseKeyValues(keyValues);
      if (Object.keys(values).length === 0) return null;
      record.keyValues = values;
    } else {
      if (!csv.trim()) return null;
      record.csv = csv.trim();
    }
    return record;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload || !name.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch<{ testDataSet: { id: string } }>(`/api/modules/${moduleId}/test-data`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Dataset saved");
      setName("");
      setKeyValues("");
      setCsv("");
      setFileError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.moduleWithRelations(moduleId) });
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (!text.includes(",")) {
        setFileError("CSV must contain at least two columns.");
        return;
      }
      setFileError(null);
      setCsv(text);
      if (!name) setName(file.name.replace(/\.(csv|tsv)$/i, ""));
    };
    reader.readAsText(file);
  }

  function parseKeyValues(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const index = line.indexOf("=");
      if (index > 0) {
        const inputKey = line.slice(0, index).trim();
        const inputValue = line.slice(index + 1).trim();
        if (inputKey) out[inputKey] = inputValue;
      }
    }
    return out;
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`ds-name-${moduleId}`} className="text-xs">
          Dataset name
        </Label>
        <Input
          id={`ds-name-${moduleId}`}
          placeholder="Material approval dataset"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <Tabs
        value={dataType}
        onValueChange={(value) => setDataType(value as "KEY_VALUE" | "CSV_TEMPLATE")}
      >
        <TabsList>
          <TabsTrigger value="KEY_VALUE">Key / value</TabsTrigger>
          <TabsTrigger value="CSV_TEMPLATE">CSV template</TabsTrigger>
        </TabsList>
        <TabsContent value="KEY_VALUE" className="space-y-2">
          <Label className="text-xs">One item per line: key=value</Label>
          <Textarea
            data-testid="testdata-keyvalues"
            rows={5}
            placeholder={"materialName=Bacillus subtilis broth\nsupplier=BioLabs\nexpiry=2026-12-31"}
            value={keyValues}
            onChange={(event) => setKeyValues(event.target.value)}
            className="font-mono text-xs"
          />
        </TabsContent>
        <TabsContent value="CSV_TEMPLATE" className="space-y-2">
          <Label className="text-xs">Upload a .csv file or paste rows with a header</Label>
          <Textarea
            data-testid="testdata-csv"
            rows={4}
            placeholder={"name,supplier,batch\nBuffer A,BioLabs,B-1"}
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            className="font-mono text-xs"
          />
          <Input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-xs" />
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
        </TabsContent>
      </Tabs>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting || (dataType === "CSV_TEMPLATE" && !csv.trim())}>
          <Plus className="h-4 w-4" />
          {submitting ? "Saving…" : "Save dataset"}
        </Button>
      </div>
    </form>
  );
}