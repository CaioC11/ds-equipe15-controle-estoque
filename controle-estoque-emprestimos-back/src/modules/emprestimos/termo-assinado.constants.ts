export const TERMO_ASSINADO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const TERMO_ASSINADO_MIME = 'application/pdf';
// Todo PDF válido começa com "%PDF-"
export const PDF_MAGIC = Buffer.from('%PDF-');

export interface ArquivoUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
