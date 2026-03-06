import { DEVELOPER_EMAIL } from '@/lib/courts';

export function isDeveloper(email: string | undefined | null): boolean {
  return email === DEVELOPER_EMAIL;
}

export function isCourtManager(userId: string, managerIds: string[]): boolean {
  return managerIds.includes(userId);
}

export function canManageCourt(
  userId: string,
  email: string | undefined | null,
  managerIds: string[]
): boolean {
  return isDeveloper(email) || isCourtManager(userId, managerIds);
}
