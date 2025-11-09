declare module 'mammoth' {
  interface ExtractRawTextOptions {
    arrayBuffer: ArrayBuffer;
  }
  
  interface ExtractRawTextResult {
    value: string;
  }
  
  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}

declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }
  
  function pdfParse(buffer: ArrayBuffer): Promise<PDFData>;
  export = pdfParse;
}
