export class KanidmHttpError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    public readonly responseBody = "",
  ) {
    super(`${path} returned HTTP ${status}${responseBody ? `: ${responseBody}` : ""}`);
    this.name = "KanidmHttpError";
  }
}

export function isKanidmAuthFailure(error: unknown) {
  if (error instanceof KanidmHttpError && error.status === 401) return true;
  if (error instanceof Error && "response" in error) {
    return (error as { response: Response }).response?.status === 401;
  }
  return false;
}

export async function kanidmHttpError(path: string, response: Response) {
  let responseBody = "";
  try {
    responseBody = await response.text();
  } catch {
    responseBody = "";
  }

  return new KanidmHttpError(path, response.status, responseBody);
}
