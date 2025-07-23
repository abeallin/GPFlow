import tkinter as tk
from tkinter import messagebox, ttk
from utils.data_parser import DataParser

class DataPreviewScreen:
    def __init__(self, root, app):
        self.root = root
        self.app = app  # Reference to main app/controller
        self.data = None
        self.parser = None
        self.links = None

    def show(self):
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
        back_button = tk.Button(nav_frame, text="Back", command=self.app.create_data_preview_screen)
        back_button.pack(side=tk.LEFT, padx=10, pady=10)
        welcome_screen_button = tk.Button(nav_frame, text="Next", command=self.app.show_welcome_screen)
        welcome_screen_button.pack(side=tk.RIGHT, padx=10) 