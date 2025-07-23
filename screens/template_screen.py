import tkinter as tk
from tkinter import messagebox
from utils.helpers import create_template_object
from utils.selenium_runner import SeleniumRunner

class TemplateScreen:
    def __init__(self, root, app):
        self.root = root
        self.app = app  # Reference to main app/controller
        self.template = None
        self.template_name = None

    def show_create(self):
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
        back_button = tk.Button(nav_frame, text="Back", command=self.app.show_welcome_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
        bulk_button = tk.Button(nav_frame, text="Bulk Create Template", command=lambda: self.save_and_run_bulk("create"))
        bulk_button.pack(side=tk.RIGHT, padx=10, pady=10)

    def show_delete(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        tk.Label(self.root, text="Enter Template Name:").pack(pady=5)
        self.template_name_entry = tk.Entry(self.root, width=40)
        self.template_name_entry.pack(pady=5)
        self.template_name = self.template_name_entry.get().strip()
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)
        back_button = tk.Button(nav_frame, text="Back", command=self.app.show_welcome_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
        bulk_button = tk.Button(nav_frame, text="Bulk Delete Template", command=lambda: self.save_and_run_bulk("delete"))
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