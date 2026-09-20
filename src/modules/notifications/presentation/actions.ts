"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/identity/application/session";
import { notificationService } from "../application/notification.service";

export async function markAllReadAction(): Promise<void> {
  const user = await requireUser();
  await notificationService.markAllRead(user.id);
  revalidatePath("/app", "layout");
}
