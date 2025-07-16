from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

class CreateTemplate():
    def __init__(self, driver, template):
        """
        Initialize the DataParser with the file path to the CSV.
        """
        self.driver = driver
        self.template = template

    def _run(self):

        try:
            # Wait for template name input and ensure it's interactable
            template_name_element = WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//input[@id='templateName']"))
            )


            # Scroll into view to ensure visibility
            self.driver.execute_script("arguments[0].scrollIntoView();", template_name_element)

            # Ensure element is interactable
            WebDriverWait(self.driver, 10).until(EC.element_to_be_clickable((By.ID, "templateName")))

            # Clear and enter text
            template_name_element.clear()
            template_name_element.send_keys(self.template['template_name'])
            print(f"✅ Template Name: '{self.template['template_name']}' entered.")

            # Locate the message text area
            message_text = self.driver.find_element(By.ID, "message")

            # Clear the field if necessary
            message_text.clear()

            # Type the text into the field
            message_text.send_keys(
                self.template['message']
            )
            print(f"Message Body: '{self.template['message']}'.")

            # Handle checkboxes
            checkboxes = {
                "sendViaIndividualMessaging": self.template["individual"],
                "sendViaBatchMessaging": self.template["batch"],
                "allowPatientsToRespond": self.template["allow_patient_to_respond"]
            }

            for checkbox_id, expected_value in checkboxes.items():
                checkbox = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, checkbox_id))
                )
                is_checked = checkbox.is_selected()
                if expected_value != is_checked:
                    self.driver.execute_script("arguments[0].click();", checkbox)
                print(f"✅ Checkbox '{checkbox_id}' set correctly.")


            save_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
            )
            save_button.click()
            print("🚀 Clicked 'Save' button.")
            

            return True  # ✅ Return True when successful
                    
        except TimeoutException:
            print("❌ Timeout error: An element took too long to load.")
            return False
        except Exception as e:
            print(f"❌ An error occurred: {e}")
            return False
        