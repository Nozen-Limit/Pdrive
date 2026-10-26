import "../src/backend.js";
import type { Resource, ResourceDetail } from "./types";
export const backend = window.sikapBackend;
export async function api<T>(
  path: string,
  body?: Record<string, unknown> | FormData,
  method = body ? "POST" : "GET",
): Promise<T> {
  return (await backend.api(path, {
    method,
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  })) as T;
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed. Try again.";
// Historical notification links can refer to modules created before the bank.
// Keep their files and history readable through the original authorized API.
export async function resourceDetails(id: string): Promise<ResourceDetail> {
  try {
    return await backend.bank.details(id);
  } catch (error) {
    if (!/not found|access denied/i.test(message(error))) throw error;
    const old = await api<
      Omit<ResourceDetail, "resource"> & {
        module: Resource & { teacher: string; remarks?: string };
      }
    >("modules/" + id);
    return {
      ...old,
      private: true,
      resource: {
        ...old.module,
        creator: old.module.teacher,
        bank_draft: false,
        bank_description: old.module.remarks,
      },
      reviews: old.reviews || [],
      events: old.events || [],
    };
  }
}
