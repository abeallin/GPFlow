import os
import re
import glob
import platform
import time
import tkinter as tk
import logging
from tkinter import messagebox
from tkinter import ttk
import pandas as pd
from create_template import CreateTemplate
from data_parser import DataParser
from delete_template import DeleteTemplate
from screen_saver import Screensaver
from helpers import create_template_object
from login import parse_env_file
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from tkinter import font as tkFont
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidSessionIdException

class AccurxRunner:
    def __init__(self, root):
        """
        Initialize the application.
        """
        # Install ChromeDriver on the fly
        ChromeDriverManager().install()

        self.LOGIN_URL = "https://web.accurx.com/login?product=2&showLoginForm=true"
        self.INBOX_URL = "https://web.accurx.com/inbox/w"
        self.TWO_FACTOR_URL = "https://web.accurx.com/two-factor-auth"

        self.root = root
        self.root.title("Accurx Runner Application")
        self.root.geometry("600x500")
        self.root.configure(bg="#F3F4F6")  # Light gray background

        # Load the Roboto font
        roboto_font = tkFont.Font(family="Roboto", size=12)

        # Set the root font using option_add
        self.root.option_add("*Font", roboto_font)        
        # Initialize user authentication state
        self.is_authenticated = False
        self.data = None
        self.parser = None
        self.login_credentials = None
        self.template = None
        self.template_name = None
        self.links = None
        # self.category_dropdown_values = []  # Ensure it is initialized
        # self.snomed_dropdown_values = []  # Same for SNOMED dropdown
        # Create the login screen
        self.create_login_screen()
        # Configure logging
        logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    def create_login_screen(self):
        """
        Display the login screen.
        """
        # Clear previous widgets
        for widget in self.root.winfo_children():
            widget.destroy()

        # Template Name
        template_name_label = tk.Label(self.root, text="Login", font=("Arial", 16))
        template_name_label.pack(pady=10)

        try:
            self.login_credentials = parse_env_file('.env')
            print("Parsed login credentials successfully.")
            print(f"Username: {self.login_credentials['username']}")
        except Exception as e:
            print(f"An error occurred: {e}")

        # Username
        username_label = tk.Label(self.root, text="Username:")
        username_label.pack(pady=5)
        self.username_entry = tk.Entry(self.root, width=40)
        self.username_entry.insert(0, self.login_credentials["username"])  # Prefill username
        self.username_entry.pack(pady=5)

        # Password
        password_label = tk.Label(self.root, text="Password:")
        password_label.pack(pady=5)
        self.password_entry = tk.Entry(self.root, width=40, show="*")
        self.password_entry.insert(0, self.login_credentials["password"])  # Prefill password
        self.password_entry.pack(pady=5)

        # Login Button
        login_button = tk.Button(self.root, text="Login", command=self.handle_login)
        login_button.pack(pady=20)

    def handle_login(self):
        """
        Handle user login.
        """
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()

        if not username or not password:
            messagebox.showerror("Login Error", "Username and Password are required.")
            return
        
        messagebox.showinfo("Login Success", f"Welcome, {username}!")
        self.create_data_preview_screen()
        
    def show_welcome_screen(self):
        """Display the welcome screen with Create and Delete options."""
        for widget in self.root.winfo_children():
            widget.destroy()

        welcome_label = tk.Label(self.root, text="Create or Delete Template", font=("Arial", 16))
        welcome_label.pack(pady=10)

        create_button = tk.Button(self.root, text="Create", width=20, command=self.create_template_screen)
        create_button.pack(pady=5)

        delete_button = tk.Button(self.root, text="Delete", width=20, command=self.delete_template_screen)
        delete_button.pack(pady=5)

        # Bottom navigation frame for Back button
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)

        back_button = tk.Button(nav_frame, text="Back", command=self.create_data_preview_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)

    def create_template_screen(self):
        """
        Main application screen for user input and filtering.
        """

        # Clear previous widgets
        for widget in self.root.winfo_children():
            widget.destroy()
        
        # Input fields
        tk.Label(self.root, text="Template name").pack(pady=5)
        self.template_name_entry = tk.Entry(self.root, width=40)
        self.template_name_entry.pack(pady=5)

        # tk.Label(self.root, text="Category").pack(pady=5)
        # self.category_var = tk.StringVar()  # Fix: Replace Entry with StringVar
        # self.category_dropdown = ttk.Combobox(self.root, textvariable=self.category_var, state="readonly")
        # self.category_dropdown["values"] = self.category_dropdown_values
        # self.category_dropdown.pack(pady=5)

        tk.Label(self.root, text="Message").pack(pady=5)
        self.message_body = tk.Text(self.root, height=5, width=50)
        self.message_body.pack(pady=5)

        # tk.Label(self.root, text="SNOMED code (optional)").pack(pady=5)
        # self.snomed_var = tk.StringVar()  # Fix: Replace Entry with StringVar
        # self.snomed_dropdown = ttk.Combobox(self.root, textvariable=self.snomed_var, state="readonly", width=80)
        # self.snomed_dropdown["values"] = self.snomed_dropdown_values
        # self.snomed_dropdown.pack(pady=5)

        self.individual_checkbox_var = tk.BooleanVar(value=True)  # Default to True
        self.individual_checkbox = tk.Checkbutton(self.root, text="Individual", variable=self.individual_checkbox_var)
        self.individual_checkbox.pack(padx=10)

        self.batch_checkbox_var = tk.BooleanVar(value=False)  # Default to False
        self.batch_checkbox = tk.Checkbutton(self.root, text="Batch", variable=self.batch_checkbox_var)
        self.batch_checkbox.pack(padx=10)

        self.allow_patients_to_respond_checkbox_var = tk.BooleanVar(value=False)  # Default to False
        self.allow_patients_to_respond_checkbox = tk.Checkbutton(self.root, text="Allow patients to respond", variable=self.allow_patients_to_respond_checkbox_var)
        self.allow_patients_to_respond_checkbox.pack(padx=10)

        # Create new template
        template_name = self.template_name_entry.get()
        # category = self.category_var.get()
        message = self.message_body.get("1.0", tk.END).strip()
        # snomed = self.snomed_var.get()
        individual = self.individual_checkbox_var.get()
        batch = self.batch_checkbox_var.get()
        allow_patients_to_respond = self.allow_patients_to_respond_checkbox_var.get()   
        
        # self.template = create_template_object(template_name, category, snomed, message, individual, batch, allow_patients_to_respond)
        self.template = create_template_object(template_name, message, individual, batch, allow_patients_to_respond)

        # Bottom navigation frame for Back button
        nav_frame = tk.Frame(self.root, height=100)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)  # Ensure it takes space
        nav_frame.pack_propagate(False)  # Prevents the frame from collapsing

        back_button = tk.Button(nav_frame, text="Back", command=self.show_welcome_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)

        bulk_button = tk.Button(nav_frame, text="Bulk Create Template", command=lambda: self.save_and_run_bulk("create"))
        bulk_button.pack(side=tk.RIGHT, padx=10, pady=10)
        
        # if not self.category_dropdown_values and not self.snomed_dropdown_values:
        #     # ✅ Run Selenium in a separate thread after UI loads
        #     self.root.after(0, lambda: threading.Thread(target=self.selenium_runner_filler, daemon=True).start())

        # self.refresh_dropdowns()
    
    def save_and_run_bulk(self, source):
        """
        Save the current template data before running bulk creation.
        """
        # ✅ Save user inputs
        self.handle_inputs(source)  

        # ✅ Run the bulk creation after saving
        self.selenium_runner(source)
        
    # def dropdown_filler(self, driver):
    #     """
    #     Runs Selenium automation to extract dropdown values and update the Tkinter dropdown.
    #     """
    #     try:
    #             print("Extracting dropdown values using Selenium...")

    #             create_template = WebDriverWait(driver, 10).until(
    #                 EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-userflow-id='message-templates-create-button']"))
    #             )
    #             create_template.click()

    #             # Locate and click the category dropdown
    #             category_element = WebDriverWait(driver, 10).until(
    #                 EC.element_to_be_clickable((By.ID, "category-select"))  # Replace with actual ID
    #             )
    #             category_element.click()  # Open the dropdown

    #             # Wait for options to appear and extract them
    #             category_options = WebDriverWait(driver, 10).until(
    #                 EC.presence_of_all_elements_located((By.XPATH, "//ul[@role='listbox']/li"))
    #             )
                
    #             self.category_dropdown_values = [category_option.text.strip() for category_option in category_options if category_option.text.strip()]

    #             # Locate and click the SNOMED dropdown
    #             snomed_element = WebDriverWait(driver, 10).until(
    #                 EC.element_to_be_clickable((By.ID, "snomedCode"))  # Replace with actual ID
    #             )
    #             snomed_element.click()  # Open the dropdown

    #             # Wait for options to appear and extract them
    #             snomed_options = WebDriverWait(driver, 10).until(
    #                 EC.presence_of_all_elements_located((By.XPATH, "//div[@role='option']"))
    #             )
                
    #             self.snomed_dropdown_values = [snomed_option.text.strip() for snomed_option in snomed_options if snomed_option.text.strip()]

    #     except Exception as e:
    #         print(f"Error during Selenium execution: {e}")
    #         self.driver.save_screenshot("selenium_error.png")  # Debugging screenshot

    #     finally:
    #         self.driver.quit()

    def handle_inputs(self, source):
        """
        Handle the submission of user inputs.
        """
        template_name = self.template_name_entry.get().strip()
        if source == "delete":
            self.template_name = template_name
            return messagebox.showinfo("Success",f"Template Name: {template_name}\n")
        
        # category = self.category_var.get().strip()
        message = self.message_body.get("1.0", tk.END).strip()
        # snomed = self.snomed_var.get().strip()
        individual = self.individual_checkbox_var.get()
        batch = self.batch_checkbox_var.get()
        allow_patients_to_respond = self.allow_patients_to_respond_checkbox_var.get()

        # self.template = create_template_object(template_name, category, snomed, message, individual, batch, allow_patients_to_respond)
        self.template = create_template_object(template_name, message, individual, batch, allow_patients_to_respond)

        # Display the collected data in a success message
        messagebox.showinfo(
            "Success",
            f"Template Name: {template_name}\n"
            # f"Category: {category}\n"
            f"Body: {message}\n"
            # f"SNOMED: {snomed}\n"
            f"Individual: {individual}\n"
            f"Batch: {batch}\n"
            f"Allow Patients to Respond: {allow_patients_to_respond}"
        )

    def delete_template_screen(self):
        """
        Main application screen for user input and filtering.
        """
        # Clear previous widgets
        for widget in self.root.winfo_children():
            widget.destroy()

        # Input fields
        tk.Label(self.root, text="Enter Template Name:").pack(pady=5)
        self.template_name_entry = tk.Entry(self.root, width=40)
        self.template_name_entry.pack(pady=5)
              
        # Set Template Name to Delete
        self.template_name = self.template_name_entry.get().strip()
        
        # Bottom navigation frame for Back button
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)

        back_button = tk.Button(nav_frame, text="Back", command=self.show_welcome_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)

        # bulk_button = tk.Button(nav_frame, text="Bulk Delete Template", command=partial(self.selenium_runner, source="delete"))
        bulk_button = tk.Button(nav_frame, text="Bulk Delete Template", command=lambda: self.save_and_run_bulk("delete"))

        bulk_button.pack(side=tk.RIGHT, padx=10, pady=10)

    def create_data_preview_screen(self):
        """
        Display the data preview screen with filter at the top and copying functionality.
        """
        # Clear previous widgets
        for widget in self.root.winfo_children():
            widget.destroy()

        # Template name
        template_name_label = tk.Label(self.root, text="Data Preview", font=("Arial", 16))
        template_name_label.pack(pady=10)
        
        # Set Accurx Ids
        def set_accurx_Ids(data):
            # Get Accurx IDs for the filters
            accurx_ids = self.parser.get_accurx_ids(data, return_field='Accurx_Id')

            # Generate web links for the filtered Accurx IDs
            base_url = 'https://web.accurx.com/w/{id}/settings/templates?tab=OrganisationTemplates'
            self.links = self.parser.create_accurx_links(accurx_ids, base_url=base_url)

        # Load dataset using DataParser
        if self.data is None:
            try:
                self.parser = DataParser('data.csv')  # Instantiate the DataParser with the CSV file path
                self.data = self.parser.data  # Assuming parse() returns a list of dictionaries
                set_accurx_Ids(self.data)
            except Exception as e:
                self.data = [{"Error": f"Failed to load data: {e}"}]

        # Extract columns dynamically
        if self.data and isinstance(self.data, list) and isinstance(self.data[0], dict):
            columns = list(self.data[0].keys())
        else:
            columns = []

        # Filter Section at the Top
        filter_frame = tk.Frame(self.root)
        filter_frame.pack(pady=5, fill=tk.X)

        filter_label = tk.Label(filter_frame, text="Filter Data by Column:")
        filter_label.pack(side=tk.LEFT, padx=5)

        self.filter_var = tk.StringVar()
        self.filter_dropdown = ttk.Combobox(
            filter_frame, textvariable=self.filter_var, state="readonly"
        )
        self.filter_dropdown["values"] = columns  # Set dropdown values from columns
        self.filter_dropdown.pack(side=tk.LEFT, padx=5)

        self.filter_value_entry = tk.Entry(filter_frame, width=30)
        self.filter_value_entry.pack(side=tk.LEFT, padx=5)

        def apply_filter():
            column = self.filter_var.get()
            value = self.filter_value_entry.get()

            # Validate filter input
            if not column:
                messagebox.showerror("Filter Error", "Please select a column to filter.")
                return

            # Filter the data
            filtered_data = [
                row for row in self.data 
                if str(row.get(column, "")).strip().lower().startswith(value.strip().lower())
            ]
            if not filtered_data:
                messagebox.showwarning("No Results", f"No data found for {column} = '{value}'.")
            else:
                update_treeview(filtered_data)
                set_accurx_Ids(filtered_data)

        filter_button = tk.Button(filter_frame, text="Apply Filter", command=apply_filter)
        filter_button.pack(side=tk.LEFT, padx=5)

        # Create Treeview with Scrollbars
        tree_frame = tk.Frame(self.root)
        tree_frame.pack(pady=5, fill=tk.BOTH, expand=True)

        # Horizontal and vertical scrollbars
        h_scrollbar = ttk.Scrollbar(tree_frame, orient=tk.HORIZONTAL)
        h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)

        v_scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL)
        v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        tree = ttk.Treeview(
            tree_frame,
            columns=columns,
            show="headings",
            height=15,
            xscrollcommand=h_scrollbar.set,
            yscrollcommand=v_scrollbar.set,
            selectmode="browse"  # Allow single selection for easier cell copying
        )
        tree.pack(fill=tk.BOTH, expand=True)

        h_scrollbar.config(command=tree.xview)
        v_scrollbar.config(command=tree.yview)

        # Set up column headings
        for col in columns:
            tree.heading(col, text=col)
            tree.column(col, width=150, anchor=tk.W)

        # Copy single cell value on double-click
        def copy_cell(event):
            item_id = tree.identify_row(event.y)  # Get the row ID
            column_id = tree.identify_column(event.x)  # Get the column ID (e.g., "#1", "#2")
            
            if item_id and column_id:
                # Convert column ID (e.g., "#1") to column index (0-based)
                col_index = int(column_id[1:]) - 1
                if col_index >= 0:
                    # Get the cell value
                    values = tree.item(item_id, "values")
                    if values and col_index < len(values):
                        cell_value = values[col_index]
                        self.root.clipboard_clear()
                        self.root.clipboard_append(cell_value)
                        self.root.update()
                        messagebox.showinfo("Copied", f"Copied value: {cell_value}")

        tree.bind("<Double-1>", copy_cell)  # Bind double-click to copy the cell value

        # Update Treeview Function
        def update_treeview(data):
            for item in tree.get_children():
                tree.delete(item)
            for row in data:
                values = [row.get(col, "") for col in columns]
                tree.insert("", tk.END, values=values)

        # Insert rows into Treeview
        update_treeview(self.data)

        # Bottom navigation frame for Back button
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)

        back_button = tk.Button(nav_frame, text="Back", command=self.create_data_preview_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
       
        # ✅ Forward button to create a new template
        welcome_screen_button = tk.Button(nav_frame, text="Next", command=self.show_welcome_screen)
        welcome_screen_button.pack(side=tk.RIGHT, padx=10)
    
    def refresh_dropdowns(self):
        """
        Refresh the dropdown values in the UI after Selenium finishes running.
        """
        self.category_dropdown["values"] = self.category_dropdown_values
        self.snomed_dropdown["values"] = self.snomed_dropdown_values

        # ✅ Set a default value if list is not empty
        if self.category_dropdown_values:
            self.category_var.set(self.category_dropdown_values[0])

        if self.snomed_dropdown_values:
            self.snomed_var.set(self.snomed_dropdown_values[0])

    # Function to restart WebDriver
    def restart_driver(self, driver, service, options):
        logging.info("🔄 Restarting WebDriver...")
        try:
            driver.quit()  # Close existing session
        except:
            pass  # Ignore errors if driver is already closed
        time.sleep(2)  # Allow cleanup time
        return webdriver.Chrome(service=service, options=options)

    def selenium_runner(self, source):           
    
        try:
            screensaver = Screensaver()
            screensaver.disable_screensaver()
            
            # Set up Chrome with the detected profile
            chrome_profile_path = self.get_chrome_profile_path()
            options = Options()
            options.add_argument(f"user-data-dir={chrome_profile_path}")
            options.add_argument("profile-directory=Default")  # Use the default profile
            options.add_argument("--no-sandbox")  # Helps avoid crashes in Linux
            options.add_argument("--disable-dev-shm-usage")  # Prevents Chrome from running out of memory
            options.add_argument("--disable-gpu")  # Helps in headless mode
            options.add_argument("--disable-extensions")  # Prevents crashes from Chrome extensions
            options.add_argument("--remote-debugging-port=9222")  # Keeps DevTools connection stable

            # Initialize WebDriver
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            
            # driver.get("https://web.accurx.com/login")         
            driver.get(self.LOGIN_URL)

            # Step 1: Check if already redirected (before attempting login)
            for _ in range(20):  # 10 seconds
                time.sleep(0.5)  
                print(f"🔍 Checking... Current URL: {driver.current_url}")
                
                if self.INBOX_URL in driver.current_url:
                    print("✅ Redirected successfully, login not required.")
                    break  # Exit early if already logged in

            # Step 2: If still on login page, attempt login
            if driver.current_url.startswith(self.LOGIN_URL):
                print("🔐 Logging in...")

                try:
                    # Wait for email field and enter username
                    user_email = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input#user-email"))
                    )
                    user_email.clear()
                    user_email.send_keys(self.login_credentials['username'])

                    # Wait for password field and enter password
                    user_password = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input#user-password"))
                    )
                    user_password.clear()
                    user_password.send_keys(self.login_credentials['password'])

                    # Wait for and click login button
                    login_button = WebDriverWait(driver, 10).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
                    )
                    login_button.click()

                    print("🚀 Login button clicked, waiting for authentication...")

                except Exception as e:
                    print(f"❌ Login failed: {e}")

            # Step 3: Handle Two-Factor Authentication (if applicable)
            if self.TWO_FACTOR_URL in driver.current_url:
                print("🔐 Two-Factor Authentication required.")
                
                WebDriverWait(driver, 300).until(  # Wait up to 5 minutes
                    lambda d: self.INBOX_URL in d.current_url and
                            d.execute_script("return document.readyState") == "complete"
                )
                print("✅ 2FA completed, redirected to INBOX_URL.")

            # Step 4: Final confirmation that login is successful before proceeding
            WebDriverWait(driver, 15).until(
                lambda d: self.INBOX_URL in d.current_url and 
                        d.execute_script("return document.readyState") == "complete"
            )
            print("✅ Successfully logged in and redirected.")

            # Step 5: Ensure the inbox page is fully loaded before proceeding
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//a[@data-active='true' and @data-userflow-id='navigation-inbox-link']"))
            )

            logging.info("✅ Successfully logged in and redirected.")

            logging.info(f"📊 Number of templates to be processed: {len(self.links)}")

            template_count = 0
            failed_links = set()  # Track failed rows   
            #list.sort(self.links) # Sort

            self.failed_links = []  # Track failed rows for retry

            def process_link(driver, link, attempt=1):
                """Process a single link with retry logic."""
                nonlocal template_count  # Allow modifying the outer variable

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
                        create_template = CreateTemplate(driver, self.template)
                        success = create_template._run()
                        
                        if success:  # ✅ Only increment if successful 
                            template_count += 1
                            if match := re.search(r'\d+', link):
                                logging.info(f"✅ {template_count}: Created Template for AccurxId - {match.group()}")

                    else:  # Delete templates
                        
                        delete_instance = DeleteTemplate(driver, self.template_name) 
                        success = delete_instance._run()
                        
                        if success:  # ✅ Only increment if successful 
                            template_count += 1
                            if match := re.search(r'\d+', link):
                                logging.info(f"✅ {template_count}: Deleted Template for AccurxId - {match.group()}")

                    time.sleep(2)
                    screensaver.start_mouse_movement()
                    
                    return True

                except (InvalidSessionIdException, TimeoutException, WebDriverException) as e:
                    logging.error(f"⚠️ Error processing {link}: {e}")
                    driver.save_screenshot(f"errors/error_{index}.png")

                    if attempt < 2:  # Only retry once
                        logging.warning(f"🔄 Retrying {link} (Attempt {attempt+1})...")
                        success = process_link(driver, link, attempt + 1)
                        
                        if success:
                            failed_links.discard(link) # Remove failed link
                            return True
                        else:
                            failed_links.add(link)  # Store permanently failed link
                            return False

                except Exception as e:
                    logging.error(f"❌ Unexpected error: {e}")
                    driver.save_screenshot(f"errors/unexpected_error_{index}.png")
                    failed_links.add(link)  # Store failed link for retry
                                   
            # 🔄 **Process All Rows**
            for index, link in enumerate(self.links):
                logging.info(f"📄 Processing row {index+1} of {len(self.links)}: {link}")
                process_link(driver, link)
                
            logging.info(f"✅ Total templates successfully processed: {template_count}")

            # ❌ **Log Permanently Failed Links**
            if failed_links:
                logging.error(f"⚠️ {len(failed_links)} templates failed permanently. See logs.")
                for link in failed_links:
                    logging.error(f"❌ Permanent failure: {link}")

        except Exception as e:
                    logging.error(f"🔥 Critical error: {e}")
                    driver.save_screenshot("errors/critical_error.png")

        finally:
            if driver:
                screensaver.enable_screensaver()
                driver.quit()

    def selenium_runner_filler(self):           
    
        try:

            # Set up Chrome with the detected profile
            chrome_profile_path = self.get_chrome_profile_path()
            chrome_options = Options()
            chrome_options.add_argument(f"user-data-dir={chrome_profile_path}")
            chrome_options.add_argument("profile-directory=Default")  # Use the default profile

            # Initialize and Set Up WebDriver
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
                      
            # Login to the application
            # Open the Accurx login page
            # driver.get("https://web.accurx.com/login")
            driver.get(self.LOGIN_URL)

            for _ in range(20):  # 20 * 0.5s = 10 seconds
                time.sleep(0.5)  # Small delay to allow redirects
                print(f"🔍 Checking... Current URL: {driver.current_url}")
                if self.INBOX_URL in driver.current_url:
                    print("✅ Redirected successfully.")
                    break

            if driver.current_url == self.LOGIN_URL:
                print("Logging in.")

                # Log into Accurx account page
                user_email = WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "input#user-email"))
                )
                user_email.send_keys(self.login_credentials['username'])

                user_password = WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "input#user-password"))
                )
                user_password.send_keys(self.login_credentials['password'])

                login_button = WebDriverWait(driver, 30).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
                )
                login_button.click()

                WebDriverWait(driver, 10).until(lambda driver: driver.execute_script("return document.readyState") == "complete")
                                 
                if self.TWO_FACTOR_URL == driver.current_url:
                    # Wait until URL changes after authentication
                    WebDriverWait(driver, 300).until(  # 300 seconds (5 minutes)
                        lambda d: d.current_url != self.TWO_FACTOR_URL and
                                d.execute_script("return document.readyState") == "complete"
                    )

                    # Wait for the redirect to the patients search page
                    WebDriverWait(driver, 10).until(
                        lambda d: d.current_url == "https://web.accurx.com/inbox/w/1669/my" and
                                d.execute_script("return document.readyState") == "complete"
                    )
            elif self.INBOX_URL == driver.current_url:
                print("Already logged in. Skipping login process.")
                WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.XPATH, "//a[@data-active='true' and @data-userflow-id='navigation-inbox-link']"))
                )
                
            driver.get("https://web.accurx.com/w/1669/settings/templates?tab=OrganisationTemplates")
            
            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )

            create_workspace_button = WebDriverWait(driver, 20).until(
                EC.element_to_be_clickable((By.XPATH, "//a[@href='/w/1669/settings/templates/create?isWorkspaceTemplate=true']"))
            )
            create_workspace_button.click()
            
            # Locate and click the category dropdown
            category_element = WebDriverWait(driver, 50).until(
                EC.element_to_be_clickable((By.ID, "category-select"))  # Replace with actual ID
            )
            category_element.click()  # Open the dropdown

            # Wait for options to appear and extract them
            category_options = WebDriverWait(driver, 50).until(
                EC.presence_of_all_elements_located((By.XPATH, "//div[@role='option']"))
            )
            
            self.category_dropdown_values = [category_option.text.strip() for category_option in category_options if category_option.text.strip()]

            if category_options:
                top_option = category_options[0]
                top_option.click()

            # Locate and click the SNOMED dropdown
            snomed_element = WebDriverWait(driver, 50).until(
                EC.element_to_be_clickable((By.XPATH, "//div[@data-testid='select-snomedCode']"))  # Replace with actual ID
            )
            snomed_element.click()  # Open the dropdown

            # Wait for options to appear and extract them
            snomed_options = WebDriverWait(driver, 1000).until(
                EC.presence_of_all_elements_located((By.XPATH, "//div[@role='option']"))
            )
            
            self.snomed_dropdown_values = [snomed_option.text.strip() for snomed_option in snomed_options if snomed_option.text.strip()]

            if snomed_options:
                top_option = snomed_options[0]
                top_option.click()

        except Exception as e:
            print(f"Error during Selenium execution: {e}")
            driver.save_screenshot("selenium_error.png")  # Debugging screenshot

        finally:
            driver.quit()
        
        self.root.after(100, self.refresh_dropdowns)


    def get_chrome_profile_path(self):
            """Dynamically find the Chrome user profile path based on the OS."""
            system = platform.system()

            if system == "Windows":
                base_path = os.path.join(os.getenv("LOCALAPPDATA"), "Google", "Chrome", "User Data")
            elif system == "Darwin":  # macOS
                base_path = os.path.expanduser("~/Library/Application Support/Google/Chrome")
            elif system == "Linux":
                base_path = os.path.expanduser("~/.config/google-chrome")
            else:
                raise Exception("Unsupported OS")

            # Find available profiles dynamically
            profiles = glob.glob(os.path.join(base_path, "Profile *"))  # Matches "Profile 1", "Profile 2", etc.

            if os.path.exists(os.path.join(base_path, "Default")):
                return os.path.join(base_path, "Default")  # Use Default if available
            elif profiles:
                return profiles[0]  # Use the first detected profile
            else:
                raise Exception(f"No Chrome profile found in {base_path}")

if __name__ == "__main__":
    root = tk.Tk()
    app = AccurxRunner(root)
    root.mainloop()