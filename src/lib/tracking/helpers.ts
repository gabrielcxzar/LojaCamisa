export function toPositiveInt(input: string | undefined, fallback: number) {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}
