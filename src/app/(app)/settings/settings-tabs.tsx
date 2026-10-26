"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_TABS, type SettingsTab } from "./settings-tab";

/** The URL is the source of truth: each trigger is a link to ?tab=…, and only the active tab's content is rendered. */
export function SettingsTabs({ active, children }: { active: SettingsTab; children: ReactNode }) {
  return (
    <Tabs value={active} activationMode="manual">
      <TabsList aria-label="Settings sections">
        {SETTINGS_TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} asChild>
            <Link href={`/settings?tab=${t.id}`} scroll={false}>
              {t.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={active}>{children}</TabsContent>
    </Tabs>
  );
}
