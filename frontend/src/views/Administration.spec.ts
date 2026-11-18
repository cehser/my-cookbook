import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import type { Settings } from "@/types/settings";

const store = vi.hoisted(() => ({
  settings: {} as Settings,
}));

vi.mock("@/store/recipeStore", () => ({ useRecipeStore: () => store }));

import Administration from "./Administration.vue";

const stubs = {
  AdminUsers: { template: "<div class='users' />" },
  AdminSettings: { template: "<div class='settings' />" },
  AdminShares: { template: "<div class='shares' />" },
  AdminMaintenance: { template: "<div class='maintenance' />" },
  AdminRecipes: {
    props: ["isAdmin"],
    template:
      "<div class='recipes' :data-admin='isAdmin'><slot name='actions' /></div>",
  },
};

function render(settings: Settings) {
  store.settings = reactive(settings);
  return mount(Administration, { global: { stubs } });
}

describe("Administration", () => {
  it("zeigt Admins alle Abschnitte", () => {
    const w = render({ role: "admin" });
    for (const c of ["users", "settings", "shares", "maintenance", "recipes"])
      expect(w.find(`.${c}`).exists(), c).toBe(true);
    expect(w.find(".recipes").attributes("data-admin")).toBe("true");
    w.unmount();
  });

  it("verbirgt Admin-Abschnitte vor Editoren", () => {
    const w = render({ role: "editor" });
    expect(w.find(".settings").exists()).toBe(false);
    expect(w.find(".shares").exists()).toBe(false);
    expect(w.find(".maintenance").exists()).toBe(false);
    expect(w.find(".recipes").exists()).toBe(true);
    w.unmount();
  });
});
