import type { Expectation } from "./types";

/** Human-readable form of an expectation, used in failure messages and reports. */
export function describeExpectation(expectation: Expectation): string {
  switch (expectation.kind) {
    case "navigated_away":
      return `navigation away from ${expectation.fromUrl}`;
    case "stayed_on_page":
      return `to remain on ${expectation.fromUrl}`;
    case "error_message_present":
      return "an error message to be shown";
    case "input_attribute":
      return `${expectation.target}[${expectation.attribute}] = "${expectation.equals}"`;
    case "app_responsive":
      return "the application to stay responsive";
    case "url_contains":
      return `the URL to contain "${expectation.value}"`;
    case "url_equals":
      return `the URL to be "${expectation.value}"`;
    case "text_present":
      return `the text "${expectation.value}" on the page`;
    case "element_visible":
      return `${expectation.target} to be visible`;
    case "element_hidden":
      return `${expectation.target} to be hidden`;
    case "element_enabled":
      return `${expectation.target} to be enabled`;
    case "element_disabled":
      return `${expectation.target} to be disabled`;
    case "text_equals":
      return `${expectation.target} text = "${expectation.value}"`;
    case "text_contains":
      return `${expectation.target} text to contain "${expectation.value}"`;
    case "value_equals":
      return `${expectation.target} value = "${expectation.value}"`;
    case "element_count":
      return `${expectation.equals} × ${expectation.target}`;
    case "title_equals":
      return `the page title to be "${expectation.value}"`;
    case "title_contains":
      return `the page title to contain "${expectation.value}"`;
    case "any_of":
      return `one of [${expectation.options.map(describeExpectation).join(" | ")}]`;
    case "all_of":
      return `all of [${expectation.options.map(describeExpectation).join(" & ")}]`;
  }
}
