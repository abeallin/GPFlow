export interface LocatorDefinitions {
  [action: string]: Record<string, string[]>;
}

export function getLocatorDefinitions(): LocatorDefinitions {
  return {
    login: {
      emailInput: [
        'getByLabel("Email")',
        'css=input#user-email',
        'css=input[type="email"]',
      ],
      passwordInput: [
        'getByLabel("Password")',
        'css=input#user-password',
        'css=input[type="password"]',
      ],
      submitButton: [
        'getByRole("button", { name: /log in|sign in/i })',
        'css=button[type="submit"]',
      ],
    },
    create: {
      createLink: [
        'getByRole("link", { name: /create template/i })',
        'getByText("Create template")',
        'css=a[href*="templates/create"]',
      ],
      templateNameInput: [
        'getByLabel("Template name")',
        'css=#templateName',
        'css=input[name="templateName"]',
      ],
      messageInput: [
        'getByLabel("Message")',
        'css=#message',
        'css=textarea[name="message"]',
      ],
      individualCheckbox: [
        'getByLabel("Individual")',
        'css=#sendViaIndividualMessaging',
      ],
      batchCheckbox: [
        'getByLabel("Batch")',
        'css=#sendViaBatchMessaging',
      ],
      allowRespondCheckbox: [
        'getByLabel(/allow patients to respond/i)',
        'css=#allowPatientsToRespond',
      ],
      saveButton: [
        'getByRole("button", { name: /save/i })',
        'css=button[type="submit"]',
      ],
    },
    delete: {
      templateRow: [
        'getByRole("row", { name: "${templateName}" })',
        'xpath=//tr[th[@scope="row" and normalize-space()="${templateName}"]]',
      ],
      deleteButton: [
        'getByRole("button", { name: /delete/i })',
        'xpath=.//button[contains(., "Delete")]',
      ],
      confirmDeleteButton: [
        'getByRole("button", { name: /delete/i }).within(getByRole("dialog"))',
        'xpath=//div[@role="dialog"]//button[span[text()="Delete"]]',
      ],
    },
  };
}
