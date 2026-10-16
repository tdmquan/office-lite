import {
  GetStartupFile,
  ReadFileBase64,
  WriteFileBase64,
  FileName,
  FileExists,
  OpenFileDialog,
  SaveFileDialog,
} from '../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import type { FileKind, LoadedFile } from './types';

export { EventsOn, EventsOff };

export function getStartupFile(): Promise<string> {
  return GetStartupFile();
}

export function openFileDialog(): Promise<string> {
  return OpenFileDialog();
}

export function saveFileDialog(defaultName: string): Promise<string> {
  return SaveFileDialog(defaultName);
}

export function fileName(path: string): Promise<string> {
  return FileName(path);
}

export function fileExists(path: string): Promise<boolean> {
  return FileExists(path);
}

export function baseName(path: string): string {
  const p = path.replace(/\\/g, '/');
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.slice(i + 1);
}

export function extOf(path: string): string {
  const name = baseName(path);
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function kindOfExt(ext: string): FileKind {
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'xlsx':
    case 'xls':
    case 'xlsm':
    case 'csv':
    case 'tsv':
      return 'excel';
    case 'docx':
    case 'doc':
      return 'word';
    default:
      return 'unknown';
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function loadFile(path: string): Promise<LoadedFile> {
  const b64 = await ReadFileBase64(path);
  const ext = extOf(path);
  return {
    path,
    ext,
    name: baseName(path),
    kind: kindOfExt(ext),
    bytes: base64ToBytes(b64),
  };
}

export async function saveFile(path: string, bytes: Uint8Array): Promise<void> {
  await WriteFileBase64(path, bytesToBase64(bytes));
}
