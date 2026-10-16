export type FileKind = 'pdf' | 'excel' | 'word' | 'unknown';

export interface LoadedFile {
  path: string;
  name: string;
  ext: string;
  kind: FileKind;
  bytes: Uint8Array;
}

export interface TabHandle {
  getBytes: () => Uint8Array | Promise<Uint8Array>;
}
