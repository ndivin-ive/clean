/** Await a promise expected to fail; return the PostgreSQL SQLSTATE code. */
export async function pgErrorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    const code = e.cause?.code ?? e.code;
    if (code) return code;
    throw error;
  }
  throw new Error("Expected the query to fail, but it succeeded");
}

export const PG = {
  insufficientPrivilege: "42501",
  foreignKeyViolation: "23503",
} as const;
