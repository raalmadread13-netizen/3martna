/** GUID generation for new aggregates (ADR-0003). Platform crypto, no framework. */
export const newId = (): string => globalThis.crypto.randomUUID();
