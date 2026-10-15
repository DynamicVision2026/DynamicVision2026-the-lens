// WO-024 /open?p=<pass>&k=<key>: the order email's 「コースをひらく」 link. The right key unlocks that Pass
// on this device and goes to its course home; a wrong one says so, with the support email.
import { useEffect, useState } from 'react';
import { openWithKey } from '../course/access';
import { LAUNCH } from '../launch.config';
import { OPEN } from './copy';
import { Footer } from './Landing';
import { navigate } from './navigate';

export function Open({ search = window.location.search }: { search?: string }) {
  const q = new URLSearchParams(search);
  const passId = q.get('p');
  const [ok] = useState(() => openWithKey(passId, q.get('k')));
  useEffect(() => {
    if (ok) navigate(`/pass/${passId}`, { replace: true });
  }, [ok, passId]);
  if (ok) return <main className="launch lp open">{OPEN.opening}</main>;
  return (
    <main className="launch lp open">
      <p className="lp-card lp-text wrong">{OPEN.wrong}</p>
      <p>
        {OPEN.help}
        <a href={`mailto:${LAUNCH.supportEmail}`}>{LAUNCH.supportEmail}</a>
      </p>
      <Footer />
    </main>
  );
}
