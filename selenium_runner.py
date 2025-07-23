import os
import re
import glob
import platform
import time
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidSessionIdException
from screen_saver import Screensaver
from create_template import CreateTemplate
from delete_template import DeleteTemplate

class SeleniumRunner:
    def __init__(self, gui):
        self.gui = gui
        self.LOGIN_URL = "https://web.accurx.com/login?product=2&showLoginForm=true"
        self.INBOX_URL = "https://web.accurx.com/inbox/w"
        self.TWO_FACTOR_URL = "https://web.accurx.com/two-factor-auth"

    def run(self, source):
        try:
            screensaver = Screensaver()
            screensaver.disable_screensaver()
            chrome_profile_path = self.get_chrome_profile_path()
            options = Options()
            options.add_argument(f"user-data-dir={chrome_profile_path}")
            options.add_argument("profile-directory=Default")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--disable-extensions")
            options.add_argument("--remote-debugging-port=9222")
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            driver.get(self.LOGIN_URL)
            for _ in range(20):
                time.sleep(0.5)
                print(f"🔍 Checking... Current URL: {driver.current_url}")
                if self.INBOX_URL in driver.current_url:
                    print("✅ Redirected successfully, login not required.")
                    break
            if driver.current_url.startswith(self.LOGIN_URL):
                print("🔐 Logging in...")
                try:
                    user_email = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input#user-email"))
                    )
                    user_email.clear()
                    user_email.send_keys(self.gui.login_credentials['username'])
                    user_password = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input#user-password"))
                    )
                    user_password.clear()
                    user_password.send_keys(self.gui.login_credentials['password'])
                    login_button = WebDriverWait(driver, 10).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
                    )
                    login_button.click()
                    print("🚀 Login button clicked, waiting for authentication...")
                except Exception as e:
                    print(f"❌ Login failed: {e}")
            if self.TWO_FACTOR_URL in driver.current_url:
                print("🔐 Two-Factor Authentication required.")
                WebDriverWait(driver, 300).until(
                    lambda d: self.INBOX_URL in d.current_url and d.execute_script("return document.readyState") == "complete"
                )
                print("✅ 2FA completed, redirected to INBOX_URL.")
            WebDriverWait(driver, 15).until(
                lambda d: self.INBOX_URL in d.current_url and d.execute_script("return document.readyState") == "complete"
            )
            print("✅ Successfully logged in and redirected.")
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//a[@data-active='true' and @data-userflow-id='navigation-inbox-link']"))
            )
            logging.info("✅ Successfully logged in and redirected.")
            logging.info(f"📊 Number of templates to be processed: {len(self.gui.links)}")
            template_count = 0
            failed_links = set()
            self.failed_links = []
            def process_link(driver, link, attempt=1):
                nonlocal template_count
                try:
                    if not driver.session_id:
                        logging.error("❌ WebDriver session lost. Restarting...")
                        driver = self.restart_driver(driver, service, options)
                    driver.get(link)
                    logging.info(f"🔗 Navigated to: {link}")
                    WebDriverWait(driver, 10).until(
                        lambda d: d.execute_script("return document.readyState") == "complete"
                    )
                    if source == "create":
                        create_template = CreateTemplate(driver, self.gui.template)
                        success = create_template._run()
                        if success:
                            template_count += 1
                            if match := re.search(r'\d+', link):
                                logging.info(f"✅ {template_count}: Created Template for AccurxId - {match.group()}")
                    else:
                        delete_instance = DeleteTemplate(driver, self.gui.template_name)
                        success = delete_instance._run()
                        if success:
                            template_count += 1
                            if match := re.search(r'\d+', link):
                                logging.info(f"✅ {template_count}: Deleted Template for AccurxId - {match.group()}")
                    time.sleep(2)
                    screensaver.start_mouse_movement()
                    return True
                except (InvalidSessionIdException, TimeoutException, WebDriverException) as e:
                    logging.error(f"⚠️ Error processing {link}: {e}")
                    driver.save_screenshot(f"errors/error_{template_count}.png")
                    if attempt < 2:
                        logging.warning(f"🔄 Retrying {link} (Attempt {attempt+1})...")
                        success = process_link(driver, link, attempt + 1)
                        if success:
                            failed_links.discard(link)
                            return True
                        else:
                            failed_links.add(link)
                            return False
                except Exception as e:
                    logging.error(f"❌ Unexpected error: {e}")
                    driver.save_screenshot(f"errors/unexpected_error_{template_count}.png")
                    failed_links.add(link)
            for index, link in enumerate(self.gui.links):
                logging.info(f"📄 Processing row {index+1} of {len(self.gui.links)}: {link}")
                process_link(driver, link)
            logging.info(f"✅ Total templates successfully processed: {template_count}")
            if failed_links:
                logging.error(f"⚠️ {len(failed_links)} templates failed permanently. See logs.")
                for link in failed_links:
                    logging.error(f"❌ Permanent failure: {link}")
        except Exception as e:
            logging.error(f"🔥 Critical error: {e}")
            try:
                driver.save_screenshot("errors/critical_error.png")
            except:
                pass
        finally:
            try:
                screensaver.enable_screensaver()
                driver.quit()
            except:
                pass
    def restart_driver(self, driver, service, options):
        logging.info("🔄 Restarting WebDriver...")
        try:
            driver.quit()
        except:
            pass
        time.sleep(2)
        return webdriver.Chrome(service=service, options=options)
    def get_chrome_profile_path(self):
        system = platform.system()
        if system == "Windows":
            base_path = os.path.join(os.getenv("LOCALAPPDATA"), "Google", "Chrome", "User Data")
        elif system == "Darwin":
            base_path = os.path.expanduser("~/Library/Application Support/Google/Chrome")
        elif system == "Linux":
            base_path = os.path.expanduser("~/.config/google-chrome")
        else:
            raise Exception("Unsupported OS")
        profiles = glob.glob(os.path.join(base_path, "Profile *"))
        if os.path.exists(os.path.join(base_path, "Default")):
            return os.path.join(base_path, "Default")
        elif profiles:
            return profiles[0]
        else:
            raise Exception(f"No Chrome profile found in {base_path}") 