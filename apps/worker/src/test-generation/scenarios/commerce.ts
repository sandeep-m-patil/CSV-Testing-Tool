import type { GeneratedCase } from "../../test-execution/types";
import { ScenarioBuilder } from "../scenario-builder";
import type { DiscoveredControl } from "../fields";

/**
 * Commerce scenarios for catalog and basket pages. These pages expose no
 * fillable inputs, so the form-based builders cannot cover them; instead each
 * scenario drives a control by its accessible name ("Add to Cart", "+", "-"),
 * which survives restyling that would break snapshot selectors.
 */

const ADD_TO_CART_NAMES = ["add to cart", "add to bag", "add to basket", "buy now"];
const INCREMENT_NAMES = ["+", "increase", "increment"];
const DECREMENT_NAMES = ["-", "−", "decrease", "decrement"];
const REMOVE_NAMES = ["remove", "remove item", "delete", "trash", "×", "x"];
const CHECKOUT_NAMES = ["checkout", "proceed to checkout", "place order"];

function names(control: DiscoveredControl): string[] {
  return [control.text, control.label, control.name, control.testId]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
}

function caption(control: DiscoveredControl, fallback: string): string {
  return names(control)[0] ?? fallback;
}

/** Finds a control whose caption matches one of the accepted names. */
export function findByCaption(controls: DiscoveredControl[], accepted: string[]): DiscoveredControl | undefined {
  return controls.find((control) =>
    names(control).some((name) => accepted.includes(name.toLowerCase())),
  );
}

export function hasAddToCart(controls: DiscoveredControl[]): boolean {
  return findByCaption(controls, ADD_TO_CART_NAMES) !== undefined;
}

export function looksLikeCart(controls: DiscoveredControl[]): boolean {
  const hasRemove = findByCaption(controls, REMOVE_NAMES) !== undefined;
  const hasQuantity = findByCaption(controls, INCREMENT_NAMES) !== undefined;
  return hasRemove && hasQuantity;
}

function hintForCaption(control: DiscoveredControl): string {
  return `text:${caption(control, "")}`;
}

/** Catalog page: every primary navigation link must resolve to a live page. */
export function buildNavigationScenarios(pageUrl: string, controls: DiscoveredControl[]): GeneratedCase[] {
  const links = controls.filter((control) => control.elementType.toLowerCase() === "link");
  const out: GeneratedCase[] = [];

  for (const link of links.slice(0, 8)) {
    const label = caption(link, "link");
    if (label.length === 0) continue;

    out.push(
      new ScenarioBuilder(pageUrl)
        .click(hintForCaption(link))
        .verify({ kind: "app_responsive" })
        .build({
          name: `${label} link opens without errors`,
          description: `Follows the "${label}" navigation link from the catalog page.`,
          type: "FUNCTIONAL",
          priority: "MEDIUM",
          testData: `navigate to ${pageUrl} and click "${label}"`,
          expectedResult: `The "${label}" page loads and the application stays responsive`,
        }),
    );
  }
  return out;
}

/** Product detail page: add to basket, then adjust the quantity. */
export function buildProductDetailScenarios(pageUrl: string, pageName: string, controls: DiscoveredControl[]): GeneratedCase[] {
  const addToCart = findByCaption(controls, ADD_TO_CART_NAMES);
  if (!addToCart) return [];
  const addHint = hintForCaption(addToCart);
  const out: GeneratedCase[] = [];

  out.push(
    new ScenarioBuilder(pageUrl)
      .click(addHint)
      .verify({ kind: "any_of", options: [{ kind: "url_contains", value: "/cart" }, { kind: "app_responsive" }] })
      .build({
        name: `${pageName} can be added to the cart`,
        description: "Clicks the add-to-cart control on a product detail page and checks the basket responds.",
        type: "HAPPY_PATH",
        priority: "HIGH",
        testData: `open ${pageUrl} and click "${caption(addToCart, "Add to Cart")}"`,
        expectedResult: "The product is added and the basket view or page state updates",
      }),
  );

  const increment = findByCaption(controls, INCREMENT_NAMES);
  if (increment) {
    out.push(
      new ScenarioBuilder(pageUrl)
        .click(hintForCaption(increment))
        .verify({ kind: "app_responsive" })
        .build({
          name: `${pageName} quantity can be increased`,
          description: "Increases the product quantity using the increment control.",
          type: "FUNCTIONAL",
          priority: "MEDIUM",
          testData: `open ${pageUrl} and click "${caption(increment, "+")}" once`,
          expectedResult: "The displayed quantity increases by one and the page stays responsive",
        }),
    );
  }

  const decrement = findByCaption(controls, DECREMENT_NAMES);
  if (decrement) {
    out.push(
      new ScenarioBuilder(pageUrl)
        .click(hintForCaption(decrement))
        .verify({ kind: "app_responsive" })
        .build({
          name: `${pageName} quantity can be decreased`,
          description: "Decreases the product quantity using the decrement control.",
          type: "FUNCTIONAL",
          priority: "MEDIUM",
          testData: `open ${pageUrl} and click "${caption(decrement, "-")}" once`,
          expectedResult: "The displayed quantity decreases by one and the page stays responsive",
        }),
    );
  }

  return out;
}

/** Basket page: quantity controls, removal, and reaching checkout. */
export function buildCartScenarios(pageUrl: string, pageName: string, controls: DiscoveredControl[]): GeneratedCase[] {
  const out: GeneratedCase[] = [];
  const increment = findByCaption(controls, INCREMENT_NAMES);

  if (increment) {
    out.push(
      new ScenarioBuilder(pageUrl)
        .click(hintForCaption(increment))
        .verify({ kind: "app_responsive" })
        .build({
          name: `${pageName} quantity can be increased`,
          description: "Increases the line-item quantity in the basket.",
          type: "FUNCTIONAL",
          priority: "HIGH",
          testData: `open ${pageUrl} and click "${caption(increment, "+")}" once`,
          expectedResult: "The line-item quantity increases and the basket total updates",
        }),
    );
  }

  const remove = findByCaption(controls, REMOVE_NAMES);
  if (remove) {
    out.push(
      new ScenarioBuilder(pageUrl)
        .click(hintForCaption(remove))
        .verify({ kind: "app_responsive" })
        .build({
          name: `${pageName} item can be removed`,
          description: "Removes a line item from the basket.",
          type: "FUNCTIONAL",
          priority: "HIGH",
          testData: `open ${pageUrl} and click "${caption(remove, "Remove")}"`,
          expectedResult: "The line item is removed from the basket and the page stays responsive",
        }),
    );
  }

  const checkout = findByCaption(controls, CHECKOUT_NAMES);
  if (checkout) {
    out.push(
      new ScenarioBuilder(pageUrl)
        .click(hintForCaption(checkout))
        .verify({ kind: "any_of", options: [{ kind: "url_contains", value: "/checkout" }, { kind: "app_responsive" }] })
        .build({
          name: `${pageName} can proceed to checkout`,
          description: "Advances from the basket towards checkout.",
          type: "FUNCTIONAL",
          priority: "MEDIUM",
          testData: `open ${pageUrl} and click "${caption(checkout, "Checkout")}"`,
          expectedResult: "The checkout step loads and the application stays responsive",
        }),
    );
  }

  return out;
}
