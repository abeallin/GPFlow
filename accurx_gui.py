import requests
import tkinter as tk
from tkinter import messagebox, ttk, font as tkFont, simpledialog
import os
from data_parser import DataParser
from helpers import create_template_object
from login import parse_env_file, parse_license_key
from selenium_runner import SeleniumRunner
from supabase import create_client, Client
from datetime import datetime

# Helper to read/write .env
from dotenv import load_dotenv, set_key
load_dotenv()

ENV_PATH = ".env"

SUPABASE_URL = "https://tpsdgopzqinktagwtbcy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwc2Rnb3B6cWlua3RhZ3d0YmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTI4MjgsImV4cCI6MjA2ODA2ODgyOH0.XyRmTlwjZvKfA8wg4jmv0_Wa_RmvQo9gGL2nxnho-2M"

# Remove LicenseDialog and get_license_key


def main():
    from dotenv import load_dotenv
    load_dotenv(override=True)
    root = tk.Tk()
    root.withdraw()  # Hide main window until ready
    root.deiconify()  # Show main window immediately
    app = AccurxRunner(root)
    root.mainloop()

class AccurxRunner:
    def __init__(self, root):
        self.root = root
        self.root.title("Accurx Runner Application")
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
        self.create_login_screen()

    def create_login_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        template_name_label = tk.Label(self.root, text="Login", font=("Arial", 16))
        template_name_label.pack(pady=10)
        try:
            self.login_credentials = parse_env_file('.env')
            print("Parsed login credentials successfully.")
            print(f"Username: {self.login_credentials['username']}")
        except Exception as e:
            print(f"An error occurred: {e}")
        username_label = tk.Label(self.root, text="Username:")
        username_label.pack(pady=5)
        self.username_entry = tk.Entry(self.root, width=40)
        self.username_entry.insert(0, self.login_credentials["username"])
        self.username_entry.pack(pady=5)
        password_label = tk.Label(self.root, text="Password:")
        password_label.pack(pady=5)
        self.password_entry = tk.Entry(self.root, width=40, show="*")
        self.password_entry.insert(0, self.login_credentials["password"])
        self.password_entry.pack(pady=5)
        # License Key Section
        license_label = tk.Label(self.root, text="License Key:")
        license_label.pack(pady=5)
        license_key_frame = tk.Frame(self.root)
        license_key_frame.pack(pady=0)
        self.license_key_entry = tk.Entry(license_key_frame, width=32)
        try:
            license_key = parse_license_key(ENV_PATH)
        except Exception as e:
            license_key = ""
            print(f"License key not found: {e}")
        self.license_key_entry.insert(0, license_key)
        self.license_key_entry.pack(side=tk.LEFT, padx=(0, 5))
        recheck_button = tk.Button(license_key_frame, text="Validate", command=self.check_license_key)
        recheck_button.pack(side=tk.LEFT)
        # License status indicator
        self.license_status_label = tk.Label(self.root, text="License Status: Checking...", fg="gray")
        self.license_status_label.pack(pady=5)
        # Bind license key entry to check on change
        self.license_key_entry.bind("<KeyRelease>", lambda event: self.check_license_key())
        # Check license key on startup
        self.check_license_key()
        login_button = tk.Button(self.root, text="Login", command=self.handle_login)
        login_button.pack(pady=20)

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
        for widget in self.root.winfo_children():
            widget.destroy()
        welcome_label = tk.Label(self.root, text="Create or Delete Template", font=("Arial", 16))
        welcome_label.pack(pady=10)
        create_button = tk.Button(self.root, text="Create", width=20, command=self.create_template_screen)
        create_button.pack(pady=5)
        delete_button = tk.Button(self.root, text="Delete", width=20, command=self.delete_template_screen)
        delete_button.pack(pady=5)
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)
        back_button = tk.Button(nav_frame, text="Back", command=self.create_data_preview_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)

    def create_template_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        tk.Label(self.root, text="Template name").pack(pady=5)
        self.template_name_entry = tk.Entry(self.root, width=40)
        self.template_name_entry.pack(pady=5)
        tk.Label(self.root, text="Message").pack(pady=5)
        self.message_body = tk.Text(self.root, height=5, width=50)
        self.message_body.pack(pady=5)
        self.individual_checkbox_var = tk.BooleanVar(value=True)
        self.individual_checkbox = tk.Checkbutton(self.root, text="Individual", variable=self.individual_checkbox_var)
        self.individual_checkbox.pack(padx=10)
        self.batch_checkbox_var = tk.BooleanVar(value=False)
        self.batch_checkbox = tk.Checkbutton(self.root, text="Batch", variable=self.batch_checkbox_var)
        self.batch_checkbox.pack(padx=10)
        self.allow_patients_to_respond_checkbox_var = tk.BooleanVar(value=False)
        self.allow_patients_to_respond_checkbox = tk.Checkbutton(self.root, text="Allow patients to respond", variable=self.allow_patients_to_respond_checkbox_var)
        self.allow_patients_to_respond_checkbox.pack(padx=10)
        nav_frame = tk.Frame(self.root, height=100)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)
        nav_frame.pack_propagate(False)
        back_button = tk.Button(nav_frame, text="Back", command=self.show_welcome_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
        bulk_button = tk.Button(nav_frame, text="Bulk Create Template", command=lambda: self.save_and_run_bulk("create"))
        bulk_button.pack(side=tk.RIGHT, padx=10, pady=10)

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

    def delete_template_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        tk.Label(self.root, text="Enter Template Name:").pack(pady=5)
        self.template_name_entry = tk.Entry(self.root, width=40)
        self.template_name_entry.pack(pady=5)
        self.template_name = self.template_name_entry.get().strip()
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)
        back_button = tk.Button(nav_frame, text="Back", command=self.show_welcome_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
        bulk_button = tk.Button(nav_frame, text="Bulk Delete Template", command=lambda: self.save_and_run_bulk("delete"))
        bulk_button.pack(side=tk.RIGHT, padx=10, pady=10)

    def create_data_preview_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        template_name_label = tk.Label(self.root, text="Data Preview", font=("Arial", 16))
        template_name_label.pack(pady=10)
        def set_accurx_Ids(data):
            accurx_ids = self.parser.get_accurx_ids(data, return_field='Accurx_Id')
            base_url = 'https://web.accurx.com/w/{id}/settings/templates?tab=OrganisationTemplates'
            self.links = self.parser.create_accurx_links(accurx_ids, base_url=base_url)
        if self.data is None:
            try:
                self.parser = DataParser('data.csv')
                self.data = self.parser.data
                set_accurx_Ids(self.data)
            except Exception as e:
                self.data = [{"Error": f"Failed to load data: {e}"}]
        if self.data and isinstance(self.data, list) and isinstance(self.data[0], dict):
            columns = list(self.data[0].keys())
        else:
            columns = []
        filter_frame = tk.Frame(self.root)
        filter_frame.pack(pady=5, fill=tk.X)
        filter_label = tk.Label(filter_frame, text="Filter Data by Column:")
        filter_label.pack(side=tk.LEFT, padx=5)
        self.filter_var = tk.StringVar()
        self.filter_dropdown = ttk.Combobox(
            filter_frame, textvariable=self.filter_var, state="readonly"
        )
        self.filter_dropdown["values"] = columns
        self.filter_dropdown.pack(side=tk.LEFT, padx=5)
        self.filter_value_entry = tk.Entry(filter_frame, width=30)
        self.filter_value_entry.pack(side=tk.LEFT, padx=5)
        def apply_filter():
            column = self.filter_var.get()
            value = self.filter_value_entry.get()
            if not column:
                messagebox.showerror("Filter Error", "Please select a column to filter.")
                return
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
        tree_frame = tk.Frame(self.root)
        tree_frame.pack(pady=5, fill=tk.BOTH, expand=True)
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
            selectmode="browse"
        )
        tree.pack(fill=tk.BOTH, expand=True)
        h_scrollbar.config(command=tree.xview)
        v_scrollbar.config(command=tree.yview)
        for col in columns:
            tree.heading(col, text=col)
            tree.column(col, width=150, anchor=tk.W)
        def copy_cell(event):
            item_id = tree.identify_row(event.y)
            column_id = tree.identify_column(event.x)
            if item_id and column_id:
                col_index = int(column_id[1:]) - 1
                if col_index >= 0:
                    values = tree.item(item_id, "values")
                    if values and col_index < len(values):
                        cell_value = values[col_index]
                        self.root.clipboard_clear()
                        self.root.clipboard_append(cell_value)
                        self.root.update()
                        messagebox.showinfo("Copied", f"Copied value: {cell_value}")
        tree.bind("<Double-1>", copy_cell)
        def update_treeview(data):
            for item in tree.get_children():
                tree.delete(item)
            for row in data:
                values = [row.get(col, "") for col in columns]
                tree.insert("", tk.END, values=values)
        update_treeview(self.data)
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)
        back_button = tk.Button(nav_frame, text="Back", command=self.create_data_preview_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
        welcome_screen_button = tk.Button(nav_frame, text="Next", command=self.show_welcome_screen)
        welcome_screen_button.pack(side=tk.RIGHT, padx=10) 

    def check_license_key(self):
        license_key = parse_license_key(ENV_PATH)

        if license_key:
            key = self.license_key_entry.get().strip()
            print(f"Checking license key: {key}")   
        else:
            messagebox.showerror("Error", "License key is required.")
            return

        # Supabase check (async, but run in a thread for GUI responsiveness)
        import threading
        def check():
            is_active = check_license_key_supabase(key)
            if is_active:
                self.license_status_label.config(text="License Status: Active", fg="green")
                self.is_license_active = True
            else:
                self.license_status_label.config(text="License Status: Inactive", fg="red")
                self.is_license_active = False
        threading.Thread(target=check, daemon=True).start()

# Helper function for Supabase license check
def check_license_key_supabase(license_key):
    load_dotenv(override=True)

    print(f"License key: {license_key}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        # Adjust table/column names as needed
        response = supabase.table("runner_licenses").select("*").eq("license_key", license_key).execute()
        return bool(response.data)
    except Exception as e:
        print(f"Supabase license check error: {e}")
        return False

if __name__ == "__main__":
    main() 