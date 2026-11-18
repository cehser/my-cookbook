import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { Recipe } from "@/types/recipe";
import RecipeDisplay from "./RecipeDisplay.vue";

const ing = (name: string, amount: number, unit: string, section: string) => ({
  name,
  amounts: [{ amount, unit }],
  section,
});

function lasagne(extra: Partial<Recipe> = {}): Recipe {
  return {
    recipe_uuid: "r-lasagne",
    recipe_name: "Lasagne",
    yields: [{ value: 6, unit: "Portionen" }],
    sections: [
      { section: "Ragù" },
      { section: "Béchamel" },
      { section: "Schichten" },
    ],
    ingredients: [
      ing("Hackfleisch", 600, "g", "Ragù"),
      ing("Tomaten", 800, "g", "Ragù"),
      ing("Milch", 900, "ml", "Béchamel"),
      ing("Butter", 60, "g", "Béchamel"),
      ing("Parmesan", 100, "g", "Schichten"),
    ],
    steps: [
      { step: "Ragù schmoren", section: "Ragù" },
      { step: "Würzen", section: "Ragù" },
      { step: "Mehlschwitze", section: "Béchamel" },
      { step: "Schichten", section: "Schichten" },
    ],
    lastUpdated: "",
    ...extra,
  };
}

let wrapper: VueWrapper | undefined;

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
}

async function render(recipe: Recipe, width = 1024) {
  setWidth(width);
  wrapper = mount(RecipeDisplay, {
    props: { recipe, imageSrc: "" },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

const shownSections = (w: VueWrapper) =>
  w.findAll(".ingredients-section").map((s) => s.attributes("data-section"));
const activeIngredients = (w: VueWrapper) =>
  w.find(".ingredients-section.active").attributes("data-section");
const stepButtons = (w: VueWrapper) => w.findAll(".step-btn");

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  setWidth(1024);
});

describe("RecipeDisplay am Tablet", () => {
  it("markiert einen angetippten Schritt und zieht den Zutatenabschnitt mit", async () => {
    const w = await render(lasagne());
    await stepButtons(w)[2].trigger("click");

    const li = w.findAll(".step-item")[2];
    expect(li.classes()).toContain("step-active");
    expect(stepButtons(w)[2].attributes("aria-pressed")).toBe("true");
    expect(activeIngredients(w)).toBe("Béchamel");
  });

  it("wechselt die Markierung und hebt sie beim zweiten Tipp auf", async () => {
    const w = await render(lasagne());
    await stepButtons(w)[0].trigger("click");
    expect(activeIngredients(w)).toBe("Ragù");

    await stepButtons(w)[3].trigger("click");
    expect(w.findAll(".step-active")).toHaveLength(1);
    expect(activeIngredients(w)).toBe("Schichten");

    await stepButtons(w)[3].trigger("click");
    expect(w.findAll(".step-active")).toHaveLength(0);
    expect(w.find(".ingredients-section.active").exists()).toBe(false);
  });

  it("zeigt mit „Nur aktuell“ genau den aktiven Abschnitt (R-01)", async () => {
    const w = await render(lasagne());
    expect(shownSections(w)).toEqual(["Ragù", "Béchamel", "Schichten"]);

    await w.findAll(".filter-option")[0].trigger("click");
    // noch kein Abschnitt aktiv: der erste
    expect(shownSections(w)).toEqual(["Ragù"]);

    await stepButtons(w)[2].trigger("click");
    expect(shownSections(w)).toEqual(["Béchamel"]);
    expect(w.text()).not.toContain("Hackfleisch");
  });

  it("zeigt Zutaten unbekannter Abschnitte nur bei „Alle“", async () => {
    const r = lasagne();
    r.ingredients.push(ing("Basilikum", 1, "Bund", "Deko"));
    const w = await render(r);
    expect(shownSections(w)).toEqual(["Deko", "Ragù", "Béchamel", "Schichten"]);

    await w.findAll(".filter-option")[0].trigger("click");
    await stepButtons(w)[3].trigger("click");
    expect(shownSections(w)).toEqual(["Schichten"]);
  });

  it("blendet den Filter bei nur einem Zutatenabschnitt aus", async () => {
    const r = lasagne({
      sections: [{ section: "" }],
      ingredients: [ing("Mehl", 1, "kg", "")],
      steps: [{ step: "Backen", section: "" }],
    });
    const w = await render(r);
    expect(w.find(".filter-toggle").exists()).toBe(false);
  });

  it("rechnet Portionen um, ohne das Rezept zu ändern", async () => {
    const r = lasagne();
    const w = await render(r);
    const amounts = () =>
      w.findAll(".ingredient-amount").map((a) => a.text().replace(/\s+/g, " "));
    expect(amounts()[0]).toBe("600 g");

    await w.find('[aria-label="Portion weniger"]').trigger("click");
    await w.find('[aria-label="Portion weniger"]').trigger("click");
    await w.find('[aria-label="Portion weniger"]').trigger("click");
    expect((w.find(".portion-input").element as HTMLInputElement).value).toBe(
      "3",
    );
    expect(amounts()[0]).toBe("300 g");
    expect(r.yields![0].value).toBe(6);
    expect(r.ingredients[0].amounts[0].amount).toBe(600);
  });

  it("sperrt − bei 1 und + bei 100, ignoriert ungültige Eingaben", async () => {
    const w = await render(lasagne({ yields: [{ value: 1, unit: "Stück" }] }));
    const minus = w.find('[aria-label="Portion weniger"]');
    const plus = w.find('[aria-label="Portion mehr"]');
    expect(minus.attributes("disabled")).toBeDefined();

    const input = w.find(".portion-input");
    await input.setValue("100");
    expect(plus.attributes("disabled")).toBeDefined();

    await input.setValue("250");
    await input.trigger("change");
    expect((input.element as HTMLInputElement).value).toBe("100");
  });

  it("skaliert ohne Portionsangabe ab 1 Portion (R-10)", async () => {
    const w = await render(lasagne({ yields: undefined }));
    expect(w.find(".portion-unit").text()).toBe("Portion");
    expect(w.text()).not.toContain("Units");

    await w.find('[aria-label="Portion mehr"]').trigger("click");
    expect(w.find(".portion-unit").text()).toBe("Portionen");
    expect(w.findAll(".ingredient-amount")[0].text()).toContain("1.200");
  });
});

describe("RecipeDisplay am iPhone", () => {
  const openSheet = async (w: VueWrapper) => {
    await w.find(".bottom-bar-collapsed").trigger("click");
  };

  it("zeigt in der Leiste nur ein Ziel mit den Portionen (R-07)", async () => {
    const w = await render(lasagne(), 390);
    const bar = w.find(".bottom-bar-collapsed");
    expect(bar.text()).toContain("Zutaten");
    expect(bar.text()).toContain("6 Portionen");
    expect(bar.findAll("button, input")).toHaveLength(0);
  });

  it("zeigt im Sheet mit „Nur aktuell“ nur den Abschnitt des markierten Schritts", async () => {
    const w = await render(lasagne(), 390);
    await stepButtons(w)[2].trigger("click");
    await openSheet(w);

    expect(
      w.findAll(".filter-option").map((b) => b.attributes("aria-pressed")),
    ).toEqual(["true", "false"]);
    expect(shownSections(w)).toEqual(["Béchamel"]);
    expect(w.find(".section-chips").exists()).toBe(false);

    await w.findAll(".filter-option")[1].trigger("click");
    expect(shownSections(w)).toEqual(["Ragù", "Béchamel", "Schichten"]);
    expect(w.findAll(".section-chip").map((c) => c.text())).toEqual([
      "Ragù",
      "Béchamel",
      "Schichten",
    ]);
  });

  it("schließt das Sheet per Hintergrund und Escape (R-11)", async () => {
    const w = await render(lasagne(), 390);
    await openSheet(w);
    expect(w.find(".bottom-bar-expanded").exists()).toBe(true);

    await w.find(".sheet-backdrop").trigger("click");
    expect(w.find(".bottom-bar-expanded").exists()).toBe(false);

    await openSheet(w);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(w.find(".bottom-bar-expanded").exists()).toBe(false);
  });

  it("rechnet Portionen im Sheet um und zeigt sie in der Leiste", async () => {
    const w = await render(lasagne(), 390);
    await openSheet(w);
    await w.find('[aria-label="Portion mehr"]').trigger("click");
    expect(w.findAll(".ingredient-amount")[0].text()).toContain("700");
    await w.find(".sheet-backdrop").trigger("click");
    expect(w.find(".bottom-bar-collapsed").text()).toContain("7 Portionen");
  });
});
