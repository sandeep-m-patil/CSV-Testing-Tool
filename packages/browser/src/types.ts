export type CollectedElementType =
  | "button"
  | "link"
  | "input"
  | "textbox"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "tab"
  | "table"
  | "dialog"
  | "form"
  | "menu"
  | "menuitem"
  | "image";

export interface CollectedElement {
  elementType: CollectedElementType;
  role: string | null;
  name: string | null;
  text: string | null;
  placeholder: string | null;
  label: string | null;
  testId: string | null;
  cssSelector: string;
  xpath: string;
  ariaAttributes: Record<string, string>;
  visible: boolean;
  enabled: boolean;
  href: string | null;
  inputType: string | null;
  formField: boolean;
}

export interface PageSnapshot {
  url: string;
  title: string;
  heading: string | null;
  elements: CollectedElement[];
  forms: number;
  dialogs: number;
  tables: number;
}

export interface DetectedAction {
  action:
    | "CLICK"
    | "FILL"
    | "SELECT"
    | "CHECK"
    | "UNCHECK"
    | "UPLOAD"
    | "NAVIGATE"
    | "SUBMIT"
    | "OPEN_DIALOG"
    | "CLOSE_DIALOG";
  target: {
    elementType: CollectedElementType;
    role?: string;
    name?: string;
    text?: string;
    label?: string;
    placeholder?: string;
    testId?: string;
    url?: string;
    cssSelector?: string;
  };
  dangerous: boolean;
  blocked: boolean;
  reason?: string;
}

export interface NavigationCandidate {
  url: string;
  label: string;
  selector: string;
  score: number;
}