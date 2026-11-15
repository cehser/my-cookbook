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
    props: ["readOnly", "expertMode"],
    template:
      "<div class='recipes' :data-read-only='readOnly' :data-expert='expertMode'><slot name='actions' /></div>",
  },
};

function render(settings: Settings) {
  store.settings = reactive(settings);
  return mount(Administration, { global: { stubs } });
}

describe("Administration", () => {
  it("zeigt Admins alle Abschnitte", () => {
    const w = render({ role: "admin", read_only: false, expert_mode: true });
    for (const c of ["users", "settings", "shares", "maintenance", "recipes"])
      expect(w.find(`.${c}`).exists(), c).toBe(true);
    expect(w.find(".recipes").attributes("data-expert")).toBe("true");
    w.unmount();
  });

  it("verbirgt Admin-Abschnitte vor Editoren", () => {
    const w = render({ role: "editor", read_only: false, expert_mode: false });
    expect(w.find(".settings").exists()).toBe(false);
    expect(w.find(".shares").exists()).toBe(false);
    expect(w.find(".maintenance").exists()).toBe(false);
    expect(w.find(".recipes").exists()).toBe(true);
    w.unmount();
  });

  it("zeigt Wartung bei read_only nicht und reicht read_only weiter", () => {
    const w = render({ role: "admin", read_only: true, expert_mode: false });
    expect(w.find(".maintenance").exists()).toBe(false);
    expect(w.find(".recipes").attributes("data-read-only")).toBe("true");
    w.unmount();
  });
});
