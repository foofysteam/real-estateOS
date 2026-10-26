import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ForbiddenError, requireUser } from "@/lib/auth/current-user";
import { listProjects } from "@/lib/projects";
import { listUsers } from "@/lib/team";
import { ProjectList } from "./projects/project-list";
import { parseSettingsTab, SettingsTabs, type SettingsTab } from "./settings-tabs";
import { TeamList } from "./team/team-list";

export const metadata: Metadata = { title: "Settings · Sales OS" };

async function ProjectsTab() {
  const projects = await listProjects();
  return (
    <ProjectList
      projects={projects.map(({ id, name, slug, city, priceMinRupees, priceMaxRupees, isActive }) => ({
        id,
        name,
        slug,
        city,
        priceMinRupees,
        priceMaxRupees,
        isActive,
      }))}
    />
  );
}

async function TeamTab() {
  const users = await listUsers();
  const activeAdmins = users.filter((u) => u.role === "ADMIN" && u.isActive);
  return (
    <TeamList
      users={users.map(({ id, name, email, role, phone, isActive }) => ({ id, name, email, role, phone, isActive }))}
      lastAdminId={activeAdmins.length === 1 ? activeAdmins[0].id : null}
    />
  );
}

/** One renderer per tab; Task 17 replaces the placeholders. */
const TAB_CONTENT: Record<SettingsTab, () => Promise<ReactNode> | ReactNode> = {
  projects: ProjectsTab,
  team: TeamTab,
  integrations: () => <p className="text-sm text-fg-muted">Coming in the next task</p>,
  import: () => <p className="text-sm text-fg-muted">Coming in the next task</p>,
};

async function isAdmin(): Promise<boolean> {
  try {
    await requireUser("ADMIN");
    return true;
  } catch (err) {
    if (err instanceof ForbiddenError) return false;
    throw err; // includes the redirect to /login
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <EmptyState
          icon={ShieldAlert}
          message="Admins only. Ask an admin if you need a project or teammate changed."
          className="rounded-lg border border-border bg-surface"
        />
      </div>
    );
  }

  const tab = parseSettingsTab((await searchParams).tab);
  const Content = TAB_CONTENT[tab];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">Settings</h1>
      <SettingsTabs active={tab}>
        <Content />
      </SettingsTabs>
    </div>
  );
}
