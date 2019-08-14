declare module 'puid' {
  class Puid {
    constructor(
      options?: string | { nodeId?: string; epoch?: string } | boolean
    )
    generate(): string
    getTimestamp(): string
    getNanos(): string
    getNodeId(): string
    getProcessId(): string
    getCounter(): string
    toBase36String(value: number, padding?: number): string
  }
  export = Puid
}
