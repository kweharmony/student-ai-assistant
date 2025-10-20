declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}

declare module 'html2canvas' {
  interface Html2CanvasOptions {
    scale?: number;
    useCORS?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string;
  }
  
  function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;
  export default html2canvas;
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