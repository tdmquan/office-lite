declare module 'mammoth' {
  export interface MammothMessage {
    type: string;
    message: string;
    error?: unknown;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }

  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  export function convertToHtml(input: MammothInput): Promise<MammothResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
  };

  export default mammoth;
}
