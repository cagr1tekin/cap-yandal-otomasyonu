import { badRequest } from '../common/http';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CheckedFile {
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  extension: 'pdf' | 'jpg' | 'png';
  fileName: string;
}

/** EICAR deneme imzası: virüs tarayıcıların test dizgesi. Zararlı dosya denetiminin çalıştığını gösterir. */
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/** PDF içinde çalıştırılabilir ya da gömülü içerik anahtarları. */
const PDF_ACTIVE = ['/JavaScript', '/JS', '/Launch', '/EmbeddedFile', '/RichMedia', '/XFA', '/OpenAction /JS'];

/** Dosya türü içerikten belirlenir; uzantıya ve tarayıcının bildirdiği türe güvenilmez. */
function sniff(b: Buffer): CheckedFile['mimeType'] | null {
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

/** Dosya adından yol, denetim karakteri ve tehlikeli karakterleri temizler. */
export function safeName(original: string, ext: string) {
  // multer adı latin1 olarak verir; Türkçe karakterler için UTF-8'e çevrilir.
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  const base = utf8.split(/[\\/]/).pop() ?? 'belge';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\.+$/, '')
    .trim()
    .slice(0, 120);
  const stem = cleaned.replace(/\.[^.]*$/, '') || 'belge';
  return `${stem}.${ext}`;
}

/**
 * Yüklenen dosyanın denetimi: boş olmama, boyut sınırı, izin verilen tür (içerikten), bozuk dosya
 * (biçimin bitiş işareti), zararlı içerik (EICAR imzası, PDF'te betik / gömülü dosya / şifreleme).
 * Üretimde bu denetime ek olarak ClamAV gibi bir tarayıcı bağlanmalıdır (docs/GUVENLIK.md).
 */
export function checkFile(file: UploadedFileLike | undefined, opts: { maxMb: number; types: string[] }): CheckedFile {
  if (!file?.buffer?.length) throw badRequest('Dosya seçilmedi ya da boş.');
  if (file.size > opts.maxMb * 1024 * 1024 || file.buffer.length > opts.maxMb * 1024 * 1024) throw badRequest(`Dosya ${opts.maxMb} MB sınırını aşıyor.`);
  const type = sniff(file.buffer);
  if (!type || !opts.types.includes(type)) throw badRequest(`Bu dosya türü kabul edilmiyor. İzin verilenler: ${opts.types.map((t) => t.split('/')[1].toUpperCase()).join(', ')}.`);
  const text = file.buffer.toString('latin1');
  if (text.includes(EICAR)) throw badRequest('Dosyada zararlı içerik imzası bulundu; yüklenemez.');

  if (type === 'application/pdf') {
    if (!text.slice(-1024).includes('%%EOF')) throw badRequest('PDF dosyası bozuk ya da eksik.');
    if (/\/Encrypt\b/.test(text)) throw badRequest('Şifreli PDF kabul edilmez; şifresiz kaydedip yükleyin.');
    const found = PDF_ACTIVE.find((k) => new RegExp(`${k.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![A-Za-z])`).test(text));
    if (found) throw badRequest(`PDF'te çalıştırılabilir ya da gömülü içerik (${found}) var; yalnızca taranmış belge yükleyin.`);
    return { mimeType: type, extension: 'pdf', fileName: safeName(file.originalname, 'pdf') };
  }
  if (type === 'image/jpeg') {
    const tail = file.buffer.subarray(-64);
    if (!tail.includes(Buffer.from([0xff, 0xd9]))) throw badRequest('JPG dosyası bozuk ya da eksik.');
    return { mimeType: type, extension: 'jpg', fileName: safeName(file.originalname, 'jpg') };
  }
  if (!file.buffer.subarray(-64).includes(Buffer.from('IEND', 'latin1'))) throw badRequest('PNG dosyası bozuk ya da eksik.');
  return { mimeType: type, extension: 'png', fileName: safeName(file.originalname, 'png') };
}
