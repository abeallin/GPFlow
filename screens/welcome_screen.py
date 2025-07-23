import tkinter as tk

class WelcomeScreen:
    def __init__(self, root, app):
        self.root = root
        self.app = app  # Reference to main app/controller

    def show(self):
        for widget in self.root.winfo_children():
            widget.destroy()
        welcome_label = tk.Label(self.root, text="Create or Delete Template", font=("Arial", 16))
        welcome_label.pack(pady=10)
        create_button = tk.Button(self.root, text="Create", width=20, command=self.app.create_template_screen)
        create_button.pack(pady=5)
        delete_button = tk.Button(self.root, text="Delete", width=20, command=self.app.delete_template_screen)
        delete_button.pack(pady=5)
        nav_frame = tk.Frame(self.root)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X)
        back_button = tk.Button(nav_frame, text="Back", command=self.app.create_data_preview_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10) 