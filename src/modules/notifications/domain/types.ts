export const NotificationTypes = [
  "ACCESS_GRANTED",
  "ACCESS_EXPIRING",
  "ACCESS_REVOKED",
  "PROFILE_CHANGED",
  "CRITICAL_DATA_CHANGED",
  "CHANGE_PROPOSED",
  "CHANGE_REVIEWED",
  "CARE_SESSION_STARTED",
  "CARE_SESSION_ENDED",
  "ACKNOWLEDGEMENT_COMPLETED",
  "INSTITUTION_REQUEST",
  "INSTITUTION_CONNECTED",
  "SHARE_OPENED",
  "GUARDIAN_INVITED",
  "GUARDIAN_INVITATION_ACCEPTED",
  "INSTITUTION_VERIFIED",
] as const;

export type NotificationType = (typeof NotificationTypes)[number];

export interface OutgoingNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Delivery channel abstraction. The MVP ships the in-app channel only; email,
 * push, WhatsApp and SMS implement this same interface later.
 */
export interface NotificationChannel {
  readonly name: string;
  deliver(notification: OutgoingNotification): Promise<void>;
}
