import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { ProfileItemCard } from "@/components/feature/profile-item-card";
import { DeleteItemButton, ProfileItemDialog } from "@/components/feature/profile-item-dialog";
import { EmptyState } from "@/components/feature/page-header";
import { VisibilityPanel } from "@/components/feature/visibility-panel";
import { profileService } from "@/modules/profiles/application/profile.service";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { SECTION_GROUPS, categoryOf, isSectionGroup } from "@/modules/profiles/domain/catalog";
import { isFeatureEnabled } from "@/shared/config/feature-flags";
import type { DataCategory } from "@/shared/domain/care-vocabulary";
import { loadGuardianChild } from "../../_lib/load-child";
import { AssistantPanel } from "./assistant-panel";

export default async function ProfileGroupPage({ params }: PageProps<"/app/children/[id]/profile/[group]">) {
  const { id, group } = await params;
  if (group === "identity" || !isSectionGroup(group)) notFound();
  const { child, actor } = await loadGuardianChild(id);
  const sections = SECTION_GROUPS[group];
  const [t, items] = await Promise.all([getTranslations("profile"), profileService.listItems(actor, id)]);

  // "Who can see this?" per category represented in this group.
  const categories = [
    ...new Set<DataCategory>(
      sections
        .flatMap((s) => items.filter((i) => i.section === s).map((i) => categoryOf(i.section, i.itemType)))
        .concat(sections.map((s) => categoryOf(s, ""))),
    ),
  ];
  const visibility = await Promise.all(
    categories.map(async (c) => ({ category: c, viewers: await sharingService.visibilityFor(id, c) })),
  );
  const aiEnabled = isFeatureEnabled("AI_PROFILE_ASSISTANT");

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-8 xl:col-span-2">
        {sections.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          return (
            <section key={section} aria-labelledby={`sec-${section}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 id={`sec-${section}`} className="text-lg font-semibold">
                    {t(`sections.${section}.name`)}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t(`sections.${section}.description`)}</p>
                </div>
                <ProfileItemDialog childId={id} section={section} />
              </div>
              {sectionItems.length === 0 ? (
                <EmptyState
                  title={t(`sections.${section}.name`)}
                  body={t(`empty.${section}`)}
                  action={<ProfileItemDialog childId={id} section={section} />}
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {sectionItems.map((item) => (
                    <ProfileItemCard
                      key={item.id}
                      item={item}
                      actions={
                        <span className="flex gap-1">
                          <ProfileItemDialog childId={id} section={section} item={item} />
                          <DeleteItemButton childId={id} itemId={item.id} />
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
              {section === "SOCIAL" && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("socialGuidance")}</p>
              )}
            </section>
          );
        })}
      </div>
      <aside className="space-y-4">
        <VisibilityPanel visibility={visibility} guardians={child.guardians.map((g) => g.user.name)} />
        {aiEnabled && (
          <AssistantPanel childId={id} sections={[...sections]} icon={<Sparkles className="size-4" aria-hidden />} />
        )}
      </aside>
    </div>
  );
}
