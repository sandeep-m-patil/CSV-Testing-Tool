export type MaterialStatus = "Draft" | "Submitted" | "Ready" | "Approved" | "Rejected";

export interface Material {
  code: string;
  name: string;
  department: string;
  type: string;
  description: string;
  storageCondition: string;
  status: MaterialStatus;
}

export interface Report {
  id: string;
  materialCode: string;
  createdBy: string;
  rows: number;
  createdAt: string;
}

const MATERIALS: Material[] = [
  {
    code: "MAT-001",
    name: "Acetone",
    department: "QC",
    type: "Chemical",
    description: "Analytical grade acetone for chromatography",
    storageCondition: "Flammable cabinet",
    status: "Approved",
  },
  {
    code: "MAT-002",
    name: "Methanol",
    department: "QA",
    type: "Chemical",
    description: "HPLC grade methanol, purity >= 99.9%",
    storageCondition: "Flammable cabinet",
    status: "Submitted",
  },
  {
    code: "MAT-003",
    name: "Paracetamol API",
    department: "Production",
    type: "API",
    description: "Active pharmaceutical ingredient, EP monograph",
    storageCondition: "Ambient",
    status: "Ready",
  },
];

const REPORTS: Report[] = [
  {
    id: "RC-001",
    materialCode: "MAT-001",
    createdBy: "reviewer@test.com",
    rows: 12,
    createdAt: "2026-09-20",
  },
];

let nextMaterialSequence = 4;
let nextReportSequence = 2;

export function listMaterials(): Material[] {
  return [...MATERIALS];
}

export function getMaterial(code: string): Material | null {
  return MATERIALS.find((material) => material.code.toLowerCase() === code.toLowerCase()) ?? null;
}

export function listMaterialsByStatus(status: MaterialStatus): Material[] {
  return MATERIALS.filter((material) => material.status === status);
}

export function createMaterial(input: Omit<Material, "code" | "status">): Material {
  const code = `MAT-${String(nextMaterialSequence).padStart(3, "0")}`;
  nextMaterialSequence += 1;
  const material: Material = { ...input, code, status: "Draft" };
  MATERIALS.push(material);
  return material;
}

export function setMaterialStatus(code: string, status: MaterialStatus): Material | null {
  const material = getMaterial(code);
  if (!material) return null;
  material.status = status;
  return material;
}

export function listReports(): Report[] {
  return [...REPORTS];
}

export function getReport(id: string): Report | null {
  return REPORTS.find((report) => report.id.toLowerCase() === id.toLowerCase()) ?? null;
}

export function createReport(materialCode: string, rows: number): Report {
  const id = `RC-${String(nextReportSequence).padStart(3, "0")}`;
  nextReportSequence += 1;
  const report: Report = {
    id,
    materialCode,
    createdBy: "reviewer@test.com",
    rows,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  REPORTS.push(report);
  return report;
}