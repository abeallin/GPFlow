import requests
import tkinter as tk
from tkinter import messagebox, ttk, font as tkFont, simpledialog
import os
from utils.data_parser import DataParser
from utils.helpers import create_template_object
from utils.login import get_credentials, get_license_key
from utils.selenium_runner import SeleniumRunner
from supabase import create_client, Client
from datetime import datetime
from utils.supabase_utils import is_license_key_valid
from screens.login_screen import LoginScreen
from screens.data_preview_screen import DataPreviewScreen
from screens.template_screen import TemplateScreen
from screens.welcome_screen import WelcomeScreen

# Helper to read/write .env
from dotenv import load_dotenv, set_key
load_dotenv()

ENV_PATH = ".env"

# Remove LicenseDialog and get_license_key


def main():
    from dotenv import load_dotenv
    load_dotenv(override=True)
    root = tk.Tk()
    root.withdraw()  # Hide main window until ready
    root.deiconify()  # Show main window immediately
    app = GPFlow(root)
    root.mainloop()

class GPFlow:
    def __init__(self, root):
        self.root = root
        self.root.title("GP Flow Application")
        self.root.geometry("600x500")
        self.root.configure(bg="#F3F4F6")
        roboto_font = tkFont.Font(family="Roboto", size=12)
        self.root.option_add("*Font", roboto_font)
        self.is_authenticated = False
        self.data = None
        self.parser = None
        self.login_credentials = None
        self.template = None
        self.template_name = None
        self.links = None
        self.login_screen = LoginScreen(self.root, self)
        self.data_preview_screen = DataPreviewScreen(self.root, self)
        self.template_screen = TemplateScreen(self.root, self)
        self.welcome_screen = WelcomeScreen(self.root, self)
        self.login_screen.show()

    def handle_login(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()
        if not username or not password:
            messagebox.showerror("Login Error", "Username and Password are required.")
            return
        if not getattr(self, 'is_license_active', False):
            messagebox.showerror("License Error", "License key is not valid. Please validate your license key before logging in.")
            return
        messagebox.showinfo("Login Success", f"Welcome, {username}!")
        self.create_data_preview_screen()

    def show_welcome_screen(self):
        self.welcome_screen.show()

    def create_template_screen(self):
        self.template_screen.show_create()

    def delete_template_screen(self):
        self.template_screen.show_delete()

    def save_and_run_bulk(self, source):
        self.handle_inputs(source)
        runner = SeleniumRunner(self)
        runner.run(source)

    def handle_inputs(self, source):
        template_name = self.template_name_entry.get().strip()
        if source == "delete":
            self.template_name = template_name
            return messagebox.showinfo("Success",f"Template Name: {template_name}\n")
        message = self.message_body.get("1.0", tk.END).strip()
        individual = self.individual_checkbox_var.get()
        batch = self.batch_checkbox_var.get()
        allow_patients_to_respond = self.allow_patients_to_respond_checkbox_var.get()
        self.template = create_template_object(template_name, message, individual, batch, allow_patients_to_respond)
        messagebox.showinfo(
            "Success",
            f"Template Name: {template_name}\n"
            f"Body: {message}\n"
            f"Individual: {individual}\n"
            f"Batch: {batch}\n"
            f"Allow Patients to Respond: {allow_patients_to_respond}"
        )

    def create_data_preview_screen(self):
        self.data_preview_screen.show()

    def check_license_key(self):
        license_key = get_license_key(ENV_PATH)
        if license_key:
            key = self.license_key_entry.get().strip()
            print(f"Checking license key: {key}")   
        else:
            messagebox.showerror("Error", "License key is required.")
            return
        import threading
        def check():
            is_active = is_license_key_valid(key)
            if is_active:
                self.license_status_label.config(text="License Status: Active", fg="green")
                self.is_license_active = True
            else:
                self.license_status_label.config(text="License Status: Inactive", fg="red")
                self.is_license_active = False
        threading.Thread(target=check, daemon=True).start()

if __name__ == "__main__":
    main() 