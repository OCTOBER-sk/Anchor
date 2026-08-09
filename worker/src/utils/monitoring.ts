export function captureError(context: string, error: unknown, meta?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    context,
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  console.error(JSON.stringify(payload));
}
