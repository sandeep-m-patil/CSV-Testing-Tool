import type { Page } from "playwright";
import { detectActions } from "./action-detector";
import { safeSnapshot } from "./element-collector";
import { detectNavigation, type NavigationOptions } from "./navigation-detector";
import { classifyPage, type PageClassification } from "./page-analyzer";
import type { DetectedAction, NavigationCandidate, PageSnapshot } from "./types";

export interface AnalyzedPage {
  snapshot: PageSnapshot;
  classification: PageClassification;
  actions: DetectedAction[];
  navigation: NavigationCandidate[];
}

export async function analyzeCurrentPage(page: Page, options: NavigationOptions): Promise<AnalyzedPage | null> {
  const snapshot = await safeSnapshot(page);
  if (!snapshot) return null;

  const classification = classifyPage(snapshot);
  const actions = detectActions(snapshot.elements);
  const navigation = detectNavigation(snapshot.elements, options);

  return { snapshot, classification, actions, navigation };
}