import type { ExecutableStep, Expectation, GeneratedCase } from "../test-execution/types";

interface CaseMeta {
  name: string;
  description?: string;
  type: string;
  priority: string;
  testData: string;
  expectedResult: string;
  isManual?: boolean;
}

const VERIFY_TYPE = "verify";
const ACTION_TYPE = "action";

/** Fluent step builder so each scenario function stays short and readable. */
export class ScenarioBuilder {
  private readonly steps: ExecutableStep[] = [];

  constructor(private readonly pageUrl: string) {
    this.add("GOTO", pageUrl, undefined, ACTION_TYPE);
  }

  fill(target: string, value: string): this {
    return this.add("FILL", target, value, ACTION_TYPE);
  }

  press(target: string, value: string): this {
    return this.add("PRESS", target, value, ACTION_TYPE);
  }

  submit(target: string): this {
    return this.add("SUBMIT", target, undefined, ACTION_TYPE);
  }

  click(target: string): this {
    return this.add("CLICK", target, undefined, ACTION_TYPE);
  }

  verify(expect: Expectation): this {
    return this.add("VERIFY", this.pageUrl, undefined, VERIFY_TYPE, expect);
  }

  build(meta: CaseMeta): GeneratedCase {
    return {
      name: meta.name,
      description: meta.description ?? meta.expectedResult,
      type: meta.type,
      priority: meta.priority,
      testData: meta.testData,
      expectedResult: meta.expectedResult,
      isManual: meta.isManual ?? false,
      steps: this.steps,
    };
  }

  private add(
    action: ExecutableStep["action"],
    target: string,
    value: string | undefined,
    stepType: ExecutableStep["stepType"],
    expect?: Expectation,
  ): this {
    this.steps.push({ order: this.steps.length + 1, action, target, value, stepType, ...(expect ? { expect } : {}) });
    return this;
  }
}
