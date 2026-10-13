import { useState } from 'react';
import { LAUNCH } from '../launch.config';
import { PROPOSED, SIGNUP } from './copy';
import { navigate } from './navigate';
import { signupAction, signupTags } from './tracking';

/**
 * Email signup: a plain form that POSTs to the Shopify store's customer form (no API keys, no
 * backend). It opens in a new tab, so Shopify can show its own confirmation or bot check, while this
 * tab moves on to /thanks (counted as the signup in analytics) with the preorder block.
 * The check's result screen passes its own title and tags and stays put (the report and the founder
 * offer are on the same page), showing the sent line in place of the form.
 */
export function Signup({ short, title = SIGNUP.title, tags, stay = false }: { short: string | null; title?: string; tags?: string; stay?: boolean }) {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <section className="signup">
        <h2>{title}</h2>
        <p className="sent">{PROPOSED.signupSent}</p>
      </section>
    );
  }
  return (
    <section className="signup">
      <h2>{title}</h2>
      <form
        method="post"
        action={signupAction(LAUNCH.shopDomain)}
        acceptCharset="UTF-8"
        target="_blank"
        rel="noopener"
        onSubmit={() => {
          // Let the form submit first, then move this tab on (or show the sent line here).
          window.setTimeout(() => (stay ? setSent(true) : navigate('/thanks')), 0);
        }}
      >
        <input type="hidden" name="form_type" value="customer" />
        <input type="hidden" name="utf8" value="✓" />
        <input type="hidden" name="contact[tags]" value={tags ?? signupTags(short)} />
        <input type="hidden" name="contact[accepts_marketing]" value="true" />
        <div className="signup-row">
          <input type="email" name="contact[email]" required autoComplete="email" inputMode="email" aria-label={PROPOSED.emailLabel} placeholder={PROPOSED.emailLabel} />
          <button type="submit" className="primary">
            {PROPOSED.signupButton}
          </button>
        </div>
        <p className="consent">{SIGNUP.consent}</p>
      </form>
    </section>
  );
}
