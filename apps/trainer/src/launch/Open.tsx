// WO-024 /open?p=<pass>&k=<key>: the order email's 「コースをひらく」 link. The right key unlocks that Pass
// on this device and goes to its course home; a wrong one says so, with the support email. WO-025: an optional
// o=<order number> (Shopify's order name) is remembered for analytics; links without it work the same.
import { useEffect, useState } from 'react';
import { openWithKey } from '../course/access';
import { LAUNCH } from '../launch.config';
import { courseOpened, orderFrom } from './analytics';
import { OPEN } from './copy';
import { Footer, PAGE_VARS } from './Landing';
import { navigate } from './navigate';

export function Open({ search = window.location.search }: { search?: string }) {
  const q = new URLSearchParams(search);
  const passId = q.get('p');
  const [ok] = useState(() => openWithKey(passId, q.get('k')));
  const [order] = useState(() => orderFrom(search));
  useEffect(() => {
    if (!ok) return;
    courseOpened(passId!, order);
    navigate(`/pass/${passId}`, { replace: true });
  }, [ok, passId, order]);
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
