import tkinter as tk
from tkinter import messagebox
from utils.login import get_credentials, get_license_key
from utils.supabase_utils import is_license_key_valid

ENV_PATH = ".env"

class LoginScreen:
    def __init__(self, root, app):
        self.root = root
        self.app = app  # Reference to main app/controller
        self.is_license_active = False
        self.login_credentials = get_credentials(ENV_PATH)

    def show(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        template_name_label = tk.Label(self.root, text="Login", font=("Arial", 16))
        template_name_label.pack(pady=10)
        username_label = tk.Label(self.root, text="Username:")
        username_label.pack(pady=5)
        self.username_entry = tk.Entry(self.root, width=40)
        self.username_entry.insert(0, self.login_credentials.get("username", ""))
        self.username_entry.pack(pady=5)
        password_label = tk.Label(self.root, text="Password:")
        password_label.pack(pady=5)
        self.password_entry = tk.Entry(self.root, width=40, show="*")
        self.password_entry.insert(0, self.login_credentials.get("password", ""))
        self.password_entry.pack(pady=5)
        # License Key Section
        license_label = tk.Label(self.root, text="License Key:")
        license_label.pack(pady=5)
        license_key_frame = tk.Frame(self.root)
        license_key_frame.pack(pady=0)
        self.license_key_entry = tk.Entry(license_key_frame, width=32)
        try:
            license_key = get_license_key(ENV_PATH)
        except Exception as e:
            license_key = ""
            print(f"License key not found: {e}")
        self.license_key_entry.insert(0, license_key)
        self.license_key_entry.pack(side=tk.LEFT, padx=(0, 5))
        validate_button = tk.Button(license_key_frame, text="Validate", command=self.check_license_key)
        validate_button.pack(side=tk.LEFT)
        # License status indicator
        self.license_status_label = tk.Label(self.root, text="License Status: Checking...", fg="gray")
        self.license_status_label.pack(pady=5)
        # Bind license key entry to check on change
        self.license_key_entry.bind("<KeyRelease>", lambda event: self.check_license_key())
        # Check license key on startup
        self.check_license_key()
        login_button = tk.Button(self.root, text="Login", command=self.handle_login)
        login_button.pack(pady=20)

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

    def handle_login(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()
        if not username or not password:
            messagebox.showerror("Login Error", "Username and Password are required.")
            return
        if not self.is_license_active:
            messagebox.showerror("License Error", "License key is not valid. Please validate your license key before logging in.")
            return
        messagebox.showinfo("Login Success", f"Welcome, {username}!")
        # Call main app's method to proceed to next screen
        self.app.create_data_preview_screen() 