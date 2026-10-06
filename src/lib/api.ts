export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(
      "Unable to connect. Check your connection and try again. The free demo may be waking up.",
      0,
    );
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      !["/auth/login", "/auth/me", "/account"].includes(path)
    )
      window.dispatchEvent(new Event("sentinel-session-expired"));
    const body = await response
      .json()
      .catch(() => ({ error: "Request could not be completed." }));
    throw new ApiError(
      body.error +
        (body.issues?.length
          ? " " +
            body.issues
              .map(
                (i: { field: string; message: string }) =>
                  i.field + ": " + i.message,
              )
              .join("; ")
          : ""),
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const json = (method: string, data?: unknown): RequestInit => ({
  method,
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
