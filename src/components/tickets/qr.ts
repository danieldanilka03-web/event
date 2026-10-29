import QRCode from 'qrcode';
import { absoluteUrl } from '@/shared/utils';

/**
 * QR кодирует абсолютную ссылку на страницу билета и генерируется на сервере.
 * Используется dataURL, чтобы не подключать dangerouslySetInnerHTML.
 */
export async function getTicketQrDataUrl(registrationId: string): Promise<string> {
  const url = absoluteUrl(`/tickets/${registrationId}`);
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 400,
    color: { dark: '#0F172A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });
}
