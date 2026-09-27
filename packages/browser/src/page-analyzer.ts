import type { PageSnapshot } from "./types";

export type ClassifiedPageType = "login" | "dashboard" | "list" | "form" | "detail" | "review" | "settings" | "core" | "other";

export interface PageClassification {
  pageType: ClassifiedPageType;
  name: string;
  isLogin: boolean;
  hasForm: boolean;
  formFields: Array<{ label: string; selector: string; elementType: string; required: boolean }>;
  primarySubmitSelector: string | null;
  primarySubmitText: string | null;
}

export function classifyPage(snapshot: PageSnapshot): PageClassification {
  const lowerUrl = snapshot.url.toLowerCase();
  const lowerTitle = snapshot.title.toLowerCase();
  const lowerHeading = (snapshot.heading ?? "").toLowerCase();
  const haystack = `${lowerUrl} ${lowerTitle} ${lowerHeading}`;

  const formFields = snapshot.elements
    .filter((element) => element.formField && element.visible && element.enabled)
    .map((element) => ({
      label: element.label || element.name || element.placeholder || "",
      selector: element.cssSelector,
      elementType: element.elementType,
      required: false,
    }));

  const hasPassword = snapshot.elements.some((element) => element.inputType === "password");
  const isLogin = hasPassword && /login|sign|auth|session/.test(haystack);

  const submitButton = snapshot.elements.find(
    (element) =>
      element.elementType === "button" &&
      /sign in|log in|login|submit|authenticate/i.test(element.text ?? element.label ?? ""),
  );
  const fallbackSubmit = snapshot.elements.find((element) => element.elementType === "button" && element.enabled);
  const primarySubmit = submitButton ?? fallbackSubmit;

  const pageType: ClassifiedPageType = isLogin
    ? "login"
    : /review|approval|approve|pending|queue/.test(haystack)
      ? "review"
      : /create|edit|add|new|form/.test(haystack) || (formFields.length >= 2 && !/list|table/.test(haystack))
        ? "form"
        : /dashboard|overview|home/.test(haystack)
          ? "dashboard"
          : /settings|preferences|config/.test(haystack)
            ? "settings"
            : snapshot.tables > 0 || /list|browse|index|search/.test(haystack)
              ? "list"
              : snapshot.forms > 0
                ? "form"
                : "other";

  const name = derivePageName(snapshot, pageType);

  return {
    pageType,
    name,
    isLogin,
    hasForm: snapshot.forms > 0 || formFields.length > 0,
    formFields,
    primarySubmitSelector: primarySubmit?.cssSelector ?? null,
    primarySubmitText: primarySubmit?.text ?? primarySubmit?.label ?? null,
  };
}

export function derivePageName(snapshot: PageSnapshot, pageType: ClassifiedPageType): string {
  if (snapshot.heading && snapshot.heading.length > 0 && snapshot.heading.length <= 80) {
    return snapshot.heading;
  }
  if (snapshot.title && snapshot.title.length > 0) {
    return snapshot.title.replace(/\s*[|·|-]\s*.+$/, "").slice(0, 80);
  }
  try {
    const segments = new URL(snapshot.url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return decodeURIComponent(last).replace(/[-_]/g, " ");
  } catch {
    // ignore invalid URL
  }
  return pageType.charAt(0).toUpperCase() + pageType.slice(1);
}