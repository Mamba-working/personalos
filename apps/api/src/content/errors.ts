export class ContentError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message); this.name='ContentError'; this.status=status; this.code=code; this.details=details;
  }
}
export function invariant(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new ContentError(status,code,message);
}
