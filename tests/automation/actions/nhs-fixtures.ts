import type { Page } from 'playwright-core';

/**
 * Simulates the NHSmail (Microsoft Entra) SSO hop entirely through request
 * interception: no network access. Pages are served for these URLs:
 *
 *   https://web.accurx.com/login?product=2              Accurx login with "Continue with NHSmail"
 *   https://login.microsoftonline.com/email             email + Next (#i0116, #idSIButton9)
 *   https://login.microsoftonline.com/password          password + Sign in (#i0118, #idSIButton9)
 *   https://login.microsoftonline.com/kmsi              "Stay signed in?" Yes (#idSIButton9)
 *   https://login.microsoftonline.com/mfa               "Approve sign in request", redirects to inbox after mfaDelayMs
 *   https://web.accurx.com/inbox/w                      inbox with the nav link the login code waits for
 */
export interface NhsSimOptions {
  correctPassword: string;
  mfaDelayMs: number;
  showKmsi?: boolean;
}

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;

export async function installNhsSimulation(pw: Page, opts: NhsSimOptions): Promise<{ submits: () => number }> {
  let submits = 0;

  await pw.route('**/*', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;

    if (url.hostname === 'web.accurx.com' && p === '/login') {
      return route.fulfill({ contentType: 'text/html', body: page(`
        <h1>Log in to Accurx</h1>
        <button type="button" onclick="location.href='https://login.microsoftonline.com/email'">Continue with NHSmail</button>
        <a href="/login?product=2&showLoginForm=true">Log in with email and password</a>`) });
    }
    if (url.hostname === 'web.accurx.com' && p.startsWith('/inbox')) {
      return route.fulfill({ contentType: 'text/html', body: page(`<a data-userflow-id="navigation-inbox-link" href="/inbox/w">Inbox</a>`) });
    }
    if (url.hostname === 'login.microsoftonline.com') {
      if (p === '/email') {
        return route.fulfill({ contentType: 'text/html', body: page(`
          <input id="i0116" type="email" placeholder="Email, phone, or Skype" />
          <input id="idSIButton9" type="submit" value="Next" onclick="location.href='/password'" />`) });
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
      if (p === '/submit') {
        submits++;
        return route.fulfill({ status: 200, body: 'ok' });
      }
      if (p === '/kmsi') {
        return route.fulfill({ contentType: 'text/html', body: page(`
          <div id="KmsiCheckboxField">Stay signed in?</div>
          <input id="idBtn_Back" type="button" value="No" onclick="location.href='/mfa'" />
          <input id="idSIButton9" type="submit" value="Yes" onclick="location.href='/mfa'" />`) });
      }
      if (p === '/mfa') {
        return route.fulfill({ contentType: 'text/html', body: page(`
          <h2>Approve sign in request</h2>
          <p>Open your Authenticator app and approve the request.</p>
          <script>setTimeout(() => { location.href = 'https://web.accurx.com/inbox/w'; }, ${opts.mfaDelayMs});</script>`) });
      }
    }
    return route.fulfill({ status: 404, body: 'not simulated: ' + req.url() });
  });

  return { submits: () => submits };
}
