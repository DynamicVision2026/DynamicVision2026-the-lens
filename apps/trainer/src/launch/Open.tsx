// WO-024 /open?p=<pass>&k=<key>: the order email's 「コースをひらく」 link. The right key unlocks that Pass
// on this device and goes to its course home; a wrong one says so, with the support email.
import { useEffect, useState } from 'react';
import { openWithKey } from '../course/access';
import { LAUNCH } from '../launch.config';
import { OPEN } from './copy';
import { Footer, PAGE_VARS } from './Landing';
import { navigate } from './navigate';

export function Open({ search = window.location.search }: { search?: string }) {
  const q = new URLSearchParams(search);
  const passId = q.get('p');
  const [ok] = useState(() => openWithKey(passId, q.get('k')));
  useEffect(() => {
    if (ok) navigate(`/pass/${passId}`, { replace: true });
  }, [ok, passId]);
  if (ok) return (
      <div className="lp2" style={PAGE_VARS}>
        <p className="lp2-wrap sent">{OPEN.opening}</p>
      </div>
    );
  return (
    <div className="lp2" style={PAGE_VARS}>
      <main className="lp2-wrap lp2-open">
        <p className="lp2-card wrong">{OPEN.wrong}</p>
        <p>
          {OPEN.help}
          <a href={`mailto:${LAUNCH.supportEmail}`}>{LAUNCH.supportEmail}</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
