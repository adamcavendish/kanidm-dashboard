export function searchable(value: unknown) {
  return JSON.stringify(value).toLowerCase();
}
