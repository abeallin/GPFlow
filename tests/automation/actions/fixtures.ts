import { chromium, type Browser, type Page } from 'playwright-core';

export const TEMPLATES_URL = 'https://web.accurx.com/w/1/settings/templates?tab=OrganisationTemplates';

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/** Serve `html` for any request to `urlPrefix` without touching the network, then open it. */
export async function servePage(page: Page, html: string, url = TEMPLATES_URL): Promise<void> {
  await page.route('https://web.accurx.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html }),
  );
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * A minimal stand-in for the Accurx organisation-templates SPA:
 * a table of template rows, each with a Delete button that opens a
 * confirmation dialog; confirming removes the row. A "Create template"
 * link swaps in a form; saving appends a row and pushes the list URL.
 * `renderDelayMs` simulates the SPA rendering after DOMContentLoaded.
 */
export function templatesPageHtml(names: string[], opts: { renderDelayMs?: number } = {}): string {
  const rows = names
    .map(
      (n) => `<tr><td class="name">${n}</td><td>Org</td><td><button type="button" class="del">Delete</button></td></tr>`,
    )
    .join('');
  const delay = opts.renderDelayMs ?? 0;
  return `<!doctype html><html><body>
  <div id="app"></div>
  <template id="content">
    <div id="list">
      <a href="/w/1/settings/templates/create" id="create">Create template</a>
      <table><tbody id="rows">${rows}</tbody></table>
    </div>
    <div id="form" hidden>
      <label for="templateName">Template name</label><input id="templateName" />
      <label for="message">Message</label><textarea id="message"></textarea>
      <label><input type="checkbox" id="sendViaIndividualMessaging" checked /> Send via individual messaging</label>
      <label><input type="checkbox" id="sendViaBatchMessaging" /> Send via batch messaging</label>
      <label><input type="checkbox" id="allowPatientsToRespond" /> Allow patients to respond to this message</label>
      <button type="button" id="save">Save</button>
    </div>
  </template>
  <script>
    window.__saves = 0;
    function mount() {
      document.getElementById('app').appendChild(document.getElementById('content').content.cloneNode(true));
      const list = document.getElementById('list');
      const form = document.getElementById('form');
      document.querySelectorAll('button.del').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tr = btn.closest('tr');
          const dlg = document.createElement('div');
          dlg.setAttribute('role', 'dialog');
          dlg.innerHTML = '<p>Delete this template?</p><button type="button" class="confirm">Delete</button><button type="button">Cancel</button>';
          dlg.querySelector('.confirm').addEventListener('click', () => { tr.remove(); dlg.remove(); });
          document.body.appendChild(dlg);
        });
      });
      document.getElementById('create').addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState({}, '', '/w/1/settings/templates/create');
        list.hidden = true; form.hidden = false;
      });
      document.getElementById('save').addEventListener('click', () => {
        window.__saves++;
        const name = document.getElementById('templateName').value;
        const tr = document.createElement('tr');
        tr.innerHTML = '<td class="name">' + name + '</td><td>Org</td><td><button type="button" class="del">Delete</button></td>';
        document.getElementById('rows').appendChild(tr);
        form.hidden = true; list.hidden = false;
        history.pushState({}, '', '/w/1/settings/templates?tab=OrganisationTemplates');
      });
    }
    setTimeout(mount, ${delay});
  </script>
  </body></html>`;
}

export async function remainingNames(page: Page): Promise<string[]> {
  return page.locator('td.name').allInnerTexts();
}
