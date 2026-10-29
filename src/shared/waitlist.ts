/**
 * Изоморфные типы и константы листа ожидания (Waitlist).
 * Могут безопасно импортироваться как в клиентские компоненты, так и на сервере.
 */

export type WaitlistStatus = 'waiting' | 'offered' | 'claimed' | 'expired' | 'cancelled';

export type WaitlistUserStatus = {
  isInWaitlist: boolean;
  status: WaitlistStatus | null;
  position: number | null;
  totalWaiting: number;
  offeredSeatId: string | null;
  offeredSeatLabel: string | null;
  expiresAt: string | null;
  waitlistId: string | null;
};
