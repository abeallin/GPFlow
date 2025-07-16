import csv
import pandas as pd

class DataParser:
    def __init__(self, file_path):
        """
        Initialize the DataParser with the file path to the CSV.
        """
        self.file_path = file_path
        self.data = self._read_csv_as_dict()

    def parse(self):
        """Read the CSV file and store the data."""
        try:
            self.data = pd.read_csv(self.file_path)
        except Exception as e:
            raise ValueError(f"Error reading CSV file: {e}")

    def _read_csv_as_dict(self):
        """Reads a CSV file and stores it as a list of dictionaries."""
        try:
            with open(self.file_path, mode="r", encoding="utf-8-sig") as file:
                csv_reader = csv.DictReader(file)
                return [row for row in csv_reader]
        except FileNotFoundError:
            print(f"The file '{self.file_path}' was not found. Check the file path.")
            return []
        except Exception as e:
            print(f"An error occurred: {e}")
            return []

    def filter_by_fields(self, filters):
        """
        Filters the data by multiple fields and values, allowing partial matches.

        Args:
            filters (dict): A dictionary of field-value pairs to filter by.

        Returns:
            list: A list of dictionaries that match the filters.
        """
        return [
            item
            for item in self.data
            if all(
                str(item.get(field, "")).strip().lower().startswith(str(value).strip().lower())
                for field, value in filters.items()
            )
        ]

    def get_accurx_ids(self, filtered_data=None, return_field=None):
        """
        Extracts a specific field from the filtered dataset.

        Args:
            filtered_data (list): A list of dictionaries containing filtered results.
            return_field (str): The field to extract from matching rows.

        Returns:
            list: A list of extracted field values.
        """
        if not self.data:
            print("The dataset is empty.")
            return []

        if not return_field:
            raise ValueError("You must specify a 'return_field' to extract values.")

        dataset = filtered_data if filtered_data else self.data
        result = list(set(item.get(return_field) for item in dataset if return_field in item))

        if not result:
            print(f"No matching data found for field: {return_field}")

        return result

    def create_accurx_links(self, accurx_ids, base_url):
        """
        Generates web links based on the filtered data and a specified field.

        Args:
            accurx_ids (list): A list of extracted field values.
            base_url (str): The base URL format with placeholders for the dictionary keys.

        Returns:
            list: A list of generated web links.
        """
        if not accurx_ids:
            print("No data provided to generate links.")
            return []

        try:
            links = [base_url.format(id=value) for value in accurx_ids]
            return links
        except KeyError as e:
            print(f"Missing key in base_url or data_list item: {e}")
            return []

    def filter(self):
        """
        Prompt the user to input filter criteria interactively.

        Returns:
            dict: A dictionary of filter criteria.
        """
        if not self.data:
            raise ValueError("The dataset is empty. No filters can be applied.")

        available_columns = {col.lower(): col for col in self.data[0].keys()}
        print("Available columns:", ", ".join(available_columns.values()))
        print("Type 'done' to finish adding filters.")

        filters = {}
        while True:
            field = input("Enter the column name to filter on (or 'done' to finish): ").strip().lower()
            if field == "done":
                break
            if field not in available_columns:
                print(f"Invalid column. Choose from: {', '.join(available_columns.values())}")
                continue

            value = input(f"Enter the value(s) to filter '{available_columns[field]}' by (comma-separated for multiple values): ").strip()
            values = [v.strip() for v in value.split(",")]

            filters[available_columns[field]] = values if len(values) > 1 else values[0]

        if filters:
            filtered_data = [
                row
                for row in self.data
                if all(
                    row.get(field) in (value if isinstance(value, list) else [value])
                    for field, value in filters.items()
                )
            ]
            print(f"\nFilters applied: {filters}")
            print(f"Filtered {len(filtered_data)} rows out of {len(self.data)}.")
        else:
            print("No filters applied.")
            filtered_data = self.data

    def sort_by_field(self, field, ascending=True):
        """
        Sorts the dataset by the specified field.

        Args:
            field (str): The column name to sort by.
            ascending (bool): If True, sorts in ascending order; otherwise, sorts in descending order.

        Returns:
            list: A sorted list of dictionaries.
        """
        if not self.data:
            print("The dataset is empty. Sorting cannot be applied.")
            return []

        if field not in self.data[0]:
            print(f"Invalid field '{field}'. Available columns: {', '.join(self.data[0].keys())}")
            return []

        try:
            sorted_data = sorted(self.data, key=lambda x: str(x.get(field, "")).lower(), reverse=not ascending)
            print(f"✅ Data sorted by '{field}' ({'ascending' if ascending else 'descending'})")
            return sorted_data
        except Exception as e:
            print(f"❌ Error sorting data: {e}")
            return []

