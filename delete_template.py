from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

class DeleteTemplate:
    def __init__(self, driver, template_name):
        """
        Initialize with WebDriver instance and the template name to delete.
        """
        self.driver = driver
        self.template_name = template_name

    def _run(self):
        try:
            if not isinstance(self.template_name, str) or not self.template_name.strip():
                raise ValueError("❌ Template name is empty or invalid!")
                return
            
            try:
                # Locate all matching templates (instead of just one)
                matching_items = WebDriverWait(self.driver, 1).until(
                    EC.presence_of_all_elements_located(
                        (By.XPATH, f'//tr[th[@scope="row" and normalize-space()="{self.template_name}"]]'))
                )
            except TimeoutException:
                print(f"❌ No matching template found for '{self.template_name}'. Exiting method.")
                return  # Exit method if no match is found
            
            if not matching_items:
                print(f"❌ No matching template found for '{self.template_name}'. Exiting method.")
                return
            
            print(f"✅ Found {len(matching_items)} templates with name '{self.template_name}'. Deleting all instances...")

            for matching_item in matching_items:
                try:
                    # Locate the "Delete" button within the matching row
                    delete_button = WebDriverWait(matching_item, 5).until(
                        EC.element_to_be_clickable((By.XPATH, ".//button[contains(., 'Delete')]"))
                    )
                    delete_button.click()
                    print("🗑️ Clicked 'Delete' button.")

                    # Wait for confirmation dialog
                    confirm_delete_button = WebDriverWait(self.driver, 10).until(
                        EC.element_to_be_clickable(
                            (By.XPATH, "//div[@role='dialog']//button[span[text()='Delete']]")
                        )
                    )
                    confirm_delete_button.click()
                    print("✔️ Clicked confirm 'Delete' button.")

                    # Wait for the template to disappear
                    WebDriverWait(self.driver, 10).until(EC.staleness_of(matching_item))
                    print(f"✅ Deleted template '{self.template_name}'.")

                except TimeoutException:
                    print(f"⏳ Timeout: Could not delete template '{self.template_name}'. Skipping...")
                    continue  # Move to the next template if one fails
            return True
        except Exception as e:
            print(f"❌ Error locating template row or delete button: {e}")
            return False
