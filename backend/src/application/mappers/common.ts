/** ISO-string helper shared by the mapping profiles (null-safe). */
export const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/** Non-null ISO string. */
export const isoRequired = (date: Date): string => date.toISOString();
