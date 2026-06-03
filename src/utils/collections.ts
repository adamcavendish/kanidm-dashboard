export function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export function uniqueValues(values: string[]) {
  return [...new Set(values)];
}
