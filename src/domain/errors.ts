export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 409) {
    super(message); this.name = 'DomainError';
  }
}
export class StorageConflict extends Error {
  constructor() { super('An atomic write conflicted.'); this.name = 'StorageConflict'; }
}
