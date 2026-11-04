export type Day = { date: string; week: number; weekday: number; level: number; count: number };
export function contributions(user: string): Promise<{ user: string; updated: string; total: number; days: Day[] }>;
