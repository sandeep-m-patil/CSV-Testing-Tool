export interface WorkflowStep {
  order: number;
  action: string;
  target: string;
  value?: string;
  optional?: boolean;
}