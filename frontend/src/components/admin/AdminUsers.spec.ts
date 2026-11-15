import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/api/admin", () => ({
  adminApi: { listUsers: vi.fn(), updateRole: vi.fn() },
}));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast }) }));

import { adminApi, type AdminUser } from "@/api/admin";
import AdminUsers from "./AdminUsers.vue";

const user: AdminUser = {
  oidc_sub: "sub-1",
  display_name: "anna",
  email: "anna@example.org",
  given_name: "Anna",
  family_name: "A.",
  role: "pending",
  created_at: "2026-11-01T10:00:00Z",
  last_login: null,
};

async function mountUsers() {
  vi.mocked(adminApi.listUsers).mockResolvedValue([{ ...user }]);
  const w = mount(AdminUsers);
  await flushPromises();
  return w;
}

describe("AdminUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listet Benutzer und meldet wartende", async () => {
    const w = await mountUsers();
    expect(w.text()).toContain("Anna A.");
    expect(w.find(".alert-warning").text()).toContain("1 Nutzer warten");
    w.unmount();
  });

  it("ändert die Rolle über die API", async () => {
    vi.mocked(adminApi.updateRole).mockResolvedValue({
      ...user,
      role: "editor",
    });
    const w = await mountUsers();
    await w.find("select").setValue("editor");
    await flushPromises();
    expect(adminApi.updateRole).toHaveBeenCalledWith("sub-1", "editor");
    expect(toast).toHaveBeenCalledWith("Rolle von anna → editor", "success");
    expect(w.find(".alert-warning").exists()).toBe(false);
    w.unmount();
  });

  it("zeigt den Fehler und setzt die Rolle zurück", async () => {
    vi.mocked(adminApi.updateRole).mockRejectedValue(new Error("403"));
    const w = await mountUsers();
    await w.find("select").setValue("admin");
    await flushPromises();
    expect(adminApi.updateRole).toHaveBeenCalledWith("sub-1", "admin");
    expect(toast).toHaveBeenCalledWith(
      "Rolle konnte nicht geändert werden: 403",
      "danger",
    );
    expect((w.find("select").element as HTMLSelectElement).value).toBe(
      "pending",
    );
    expect(w.find("select").attributes("disabled")).toBeUndefined();
    w.unmount();
  });

  it("zeigt einen Ladefehler", async () => {
    vi.mocked(adminApi.listUsers).mockRejectedValue(new Error("x"));
    const w = mount(AdminUsers);
    await flushPromises();
    expect(w.find(".text-danger").text()).toBe(
      "Benutzer konnten nicht geladen werden.",
    );
    w.unmount();
  });
});
