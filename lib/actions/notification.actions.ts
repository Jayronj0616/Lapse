"use server";

import { revalidatePath } from "next/cache";

import * as notificationService from "@/lib/services/notification.service";
import * as organizationService from "@/lib/services/organization.service";

import { text } from "./form-data";
import type { FormState } from "./form-state";

export async function acknowledgeReminderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await organizationService.getBySlug(
    text(formData.get("orgSlug")),
  );

  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const reminderId = text(formData.get("reminderId"));
  const notificationId = text(formData.get("notificationId"));

  try {
    await notificationService.acknowledgeReminder(reminderId);
    if (notificationId) await notificationService.markRead(notificationId);
  } catch (error) {
    return {
      error:
        error instanceof notificationService.NotificationError
          ? error.message
          : "Could not acknowledge that. Try again.",
    };
  }

  revalidatePath(`/${organization.slug}/notifications`);
  revalidatePath(`/${organization.slug}/dashboard`);

  return { message: "Acknowledged." };
}

export async function markNotificationReadAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await organizationService.getBySlug(
    text(formData.get("orgSlug")),
  );

  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  try {
    await notificationService.markRead(text(formData.get("notificationId")));
  } catch (error) {
    return {
      error:
        error instanceof notificationService.NotificationError
          ? error.message
          : "Could not update that. Try again.",
    };
  }

  revalidatePath(`/${organization.slug}/notifications`);
  return { message: "Marked as read." };
}
