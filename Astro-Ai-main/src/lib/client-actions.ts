"use client";

/**
 * Client-side Server Action Helper
 * Server actions automatically transmit HTTP-only session cookies with every request.
 */
export async function withClientSession<T extends any[], R>(
  serverAction: (...args: T) => Promise<R>
): Promise<(...args: T) => Promise<R>> {
  return async (...args: T): Promise<R> => {
    return serverAction(...args);
  };
}
