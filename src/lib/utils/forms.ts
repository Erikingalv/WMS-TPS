export function textoONulo(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str === "" ? null : str;
}

export function numeroONulo(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (str === "") return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}
