// WO-027: a visit from a book's QR code (/lesson/<pass>/<lens>?src=book). Remembers the lens's masterclass as
// open on this device, src=book for analytics, and counts book_open once per lens per device.
import { useEffect, type ReactNode } from 'react';
import { openFromBook } from '../course/access';
import { bookOpened } from './analytics';
import { navigate } from './navigate';

export function BookVisit({ passId, lens, children }: { passId: string; lens: string; children: ReactNode }) {
  useEffect(() => {
    bookOpened(passId, lens, openFromBook(passId, lens));
  }, [passId, lens]);
  return <>{children}</>;
}

/** Replaces the address (no history entry), e.g. the QR's lesson address → its masterclass. */
export function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return <main className="course" />;
}
