/** UUID v7 — vrijeme + slučajnost; dovoljno za idempotency ključ offline operacija. */
export function uuidv7(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const block = (): string =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');

  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${block().slice(0, 3)}-8${block().slice(0, 3)}-${block()}${block()}${block()}`;
}
