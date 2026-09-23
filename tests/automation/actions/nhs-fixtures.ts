import type { Page } from 'playwright-core';

/**
 * Simulates the NHSmail SSO hop entirely through request interception: no network.
 *
 * Two real-world shapes are modelled (`federation`):
 *   'microsoft' — password entered on login.microsoftonline.com (#i0118, #idSIButton9)
 *   'adfs'      — Microsoft hands nhs.net accounts to the NHS federation server
 *                 (fs.nhs.net/adfs/ls). That page, captured 2026-09-23, is a
 *                 Home Realm Discovery step (#emailInput + input[name=HomeRealmByEmail])
 *                 followed by a login form (#userNameInput, #passwordInput, a
 *                 <span id="submitButton" role="button">Sign in</span>) with errors in
 *                 <span id="errorText" role="alert">. With `adfsSkipsHrd` the server lands
 *                 straight on the login form with the username pre-filled from the URL.
 *
 * Then, on both paths: optional "Stay signed in?" (#KmsiCheckboxField, #idSIButton9),
 * an MFA page that redirects to the Accurx inbox after `mfaDelayMs`.
 */
export interface NhsSimOptions {
  correctPassword: string;
  mfaDelayMs: number;
  showKmsi?: boolean;
  federation?: 'microsoft' | 'adfs';
  adfsSkipsHrd?: boolean;
}

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;

export interface NhsSim {
  /** Number of password submissions (Microsoft or ADFS). */
  submits: () => number;
  /** Usernames submitted to the ADFS Home Realm Discovery step. */
  hrdEmails: () => string[];
}

export async function installNhsSimulation(pw: Page, opts: NhsSimOptions): Promise<NhsSim> {
  let submits = 0;
  const hrdEmails: string[] = [];
  const federation = opts.federation ?? 'microsoft';
  const ADFS = 'https://fs.nhs.net/adfs/ls/?client-request-id=x&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline';

  const adfsLoginForm = (username: string, error?: string) => page(`
    <form id="loginForm" method="post" autocomplete="off" novalidate>
      <div id="error" class="fieldMargin error smallText">
        <span id="errorText" for="" aria-live="assertive" role="alert">${error ?? ''}</span>
      </div>
      <input id="userNameInput" name="UserName" type="email" value="${username}" placeholder="someone@example.com" />
      <input id="passwordInput" name="Password" type="password" placeholder="Password" />
      <input type="checkbox" name="Kmsi" id="kmsiInput" value="true" />
      <div id="submissionArea"><span id="submitButton" class="submit" role="button" tabindex="0">Sign in</span></div>
    </form>
    <script>
      document.getElementById('submitButton').addEventListener('click', async () => {
        const u = document.getElementById('userNameInput').value;
        const p = document.getElementById('passwordInput').value;
        const r = await fetch('/adfs/submit', { method: 'POST', body: JSON.stringify({ u, p }) });
        const ok = (await r.text()) === 'ok';
        if (ok) location.href = ${opts.showKmsi ? "'https://login.microsoftonline.com/kmsi'" : "'https://login.microsoftonline.com/mfa'"};
        else location.href = location.pathname + location.search + '&err=1';
      });
    </script>`);

  const adfsHrd = () => page(`
    <form id="hrd" method="post" autocomplete="off" novalidate>
      <span id="errorText" for="emailInput" aria-live="assertive" role="alert"></span>
      <input id="emailInput" name="Email" type="email" value="" placeholder="someone@example.com" />
      <input class="submit" name="HomeRealmByEmail" type="submit" value="Next" />
    </form>
    <script>
      document.getElementById('hrd').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailInput').value;
        await fetch('/adfs/hrd', { method: 'POST', body: email });
        location.href = location.pathname + location.search + '&step=login&username=' + encodeURIComponent(email);
      });
    </script>`);

  await pw.route('**/*', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;

    if (url.hostname === 'web.accurx.com' && p === '/login') {
      return route.fulfill({ contentType: 'text/html', body: page(`
        <h1>Log in to Accurx</h1>
        <button type="button" onclick="location.href='https://login.microsoftonline.com/email'">Continue with NHSmail</button>`) });
    }
    if (url.hostname === 'web.accurx.com' && p.startsWith('/inbox')) {
      return route.fulfill({ contentType: 'text/html', body: page(`<a data-userflow-id="navigation-inbox-link" href="/inbox/w">Inbox</a>`) });
    }

    if (url.hostname === 'fs.nhs.net') {
      if (p === '/adfs/hrd') { hrdEmails.push(req.postData() ?? ''); return route.fulfill({ status: 200, body: 'ok' }); }
      if (p === '/adfs/submit') {
        submits++;
        const { p: password } = JSON.parse(req.postData() ?? '{}');
        return route.fulfill({ status: 200, body: password === opts.correctPassword ? 'ok' : 'bad' });
      }
      const username = url.searchParams.get('username') ?? '';
      const showLogin = url.searchParams.get('step') === 'login' || opts.adfsSkipsHrd;
      if (!showLogin) return route.fulfill({ contentType: 'text/html', body: adfsHrd() });
      const error = url.searchParams.get('err') ? 'Incorrect user ID or password. Type the correct user ID and password, and try again.' : undefined;
      return route.fulfill({ contentType: 'text/html', body: adfsLoginForm(username, error) });
    }

    if (url.hostname === 'login.microsoftonline.com') {
      if (p === '/email') {
        const next = federation === 'adfs'
          ? `${ADFS}&username=' + encodeURIComponent(document.getElementById('i0116').value) + '`
          : '/password';
        return route.fulfill({ contentType: 'text/html', body: page(`
          <input id="i0116" type="email" placeholder="Email, phone, or Skype" />
          <input id="idSIButton9" type="submit" value="Next" onclick="location.href='${next}'" />`) });
      }
      if (p === '/password') {
        return route.fulfill({ contentType: 'text/html', body: page(`
          <div id="displayName">user@nhs.net</div>
          <input id="i0118" type="password" placeholder="Password" />
          <div id="passwordError" hidden>Your account or password is incorrect.</div>
          <input id="idSIButton9" type="submit" value="Sign in" />
          <script>
            document.getElementById('idSIButton9').addEventListener('click', async () => {
              const pw = document.getElementById('i0118').value;
              await fetch('/submit', { method: 'POST', body: pw });
              if (pw === ${JSON.stringify(opts.correctPassword)}) {
                location.href = ${opts.showKmsi ? "'/kmsi'" : "'/mfa'"};
              } else {
                document.getElementById('passwordError').hidden = false;
              }
            });
          </script>`) });
      }
      if (p === '/submit') { submits++; return route.fulfill({ status: 200, body: 'ok' }); }
      if (p === '/kmsi') {
        return route.fulfill({ contentType: 'text/html', body: page(`
          <div id="KmsiCheckboxField">Stay signed in?</div>
          <input id="idBtn_Back" type="button" value="No" onclick="location.href='/mfa'" />
          <input id="idSIButton9" type="submit" value="Yes" onclick="location.href='/mfa'" />`) });
      }
      if (p === '/mfa') {
        return route.fulfill({ contentType: 'text/html', body: page(`
          <h2>Approve sign in request</h2>
          <script>setTimeout(() => { location.href = 'https://web.accurx.com/inbox/w'; }, ${opts.mfaDelayMs});</script>`) });
      }
    }
    return route.fulfill({ status: 404, body: 'not simulated: ' + req.url() });
  });

  return { submits: () => submits, hrdEmails: () => hrdEmails };
}
