declare module 'katex/contrib/auto-render' {
  import { KatexOptions } from 'katex';
  function renderMathInElement(elem: HTMLElement, options?: KatexOptions & {
    delimiters?: Array<{ left: string; right: string; display: boolean }>;
    ignoredTags?: string[];
    throwOnError?: boolean;
  }): void;
  export default renderMathInElement;
}

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

declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}

declare module 'jspdf' {
  interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape';
    unit?: 'mm' | 'cm' | 'in' | 'pt';
    format?: 'a4' | 'a3' | 'letter' | 'legal';
  }
  
  class jsPDF {
    constructor(options?: jsPDFOptions);
    addPage(): void;
    addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): void;
    save(filename: string): void;
  }
  
  export = jsPDF;
}

declare module 'html-docx-js/dist/html-docx' {
  interface HtmlDocxOptions {
    orientation?: string;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  interface HtmlDocx {
    asBlob(html: string, options?: HtmlDocxOptions): Blob;
    asString(html: string, options?: HtmlDocxOptions): string;
  }

  const htmlDocx: HtmlDocx;
  export default htmlDocx;
}

declare module 'marked' {
  export interface MarkedOptions {
    breaks?: boolean;
    gfm?: boolean;
    headerIds?: boolean;
    mangle?: boolean;
    pedantic?: boolean;
    sanitize?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
  }

  export function marked(src: string, options?: MarkedOptions): string | Promise<string>;
  
  export namespace marked {
    function setOptions(options: MarkedOptions): void;
  }
}