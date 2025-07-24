# GP Flow

**Version:** 6.0.0  
**Author:** Abel Ghebrezadik  
**Email:** abel_g@hotmail.co.uk  
**Date:** 2025-07-04

## Overview
GP Flow is a Python application for automating template creation and deletion in the Accurx web platform. It features a Tkinter GUI and uses Selenium for browser automation. The project is designed to streamline workflows for users who need to manage templates in bulk.

## Features
- Login screen with credential management
- Data preview and filtering from CSV
- Create and delete templates in Accurx
- Bulk operations support
- User-friendly GUI

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd GPFlow
   ```
2. **Install dependencies:**
   - Python 3.7+
   - Install required packages:
     ```bash
     pip install -r requirements.txt
     ```
3. **Prepare environment:**
   - Create a `.env` file in the project root with your Accurx username and password:
     ```env
     username=YOUR_USERNAME
     password=YOUR_PASSWORD
     ```
   - Ensure `Data.csv` is present and up to date with the required data.

## Usage
- Run the main application:
  ```bash
  python GPFlow.py
  ```
- Follow the on-screen instructions to log in, preview data, and create or delete templates.

## File Structure
- `GPFlow.py` - Main application entry point
- `gpflow_gui.py` - GUI logic for the application
- `create_template.py` - Logic for creating templates
- `delete_template.py` - Logic for deleting templates
- `Data.csv` - Data source for templates
- `archive/` - Archived scripts
- `release/` - Compiled releases and executables
- `screens/` - GUI screens
  - `login_screen.py` - Login screen UI
  - `data_preview_screen.py` - Data preview and filtering UI
  - `template_screen.py` - Template management UI
  - `welcome_screen.py` - Welcome screen UI
- `utils/` - Utility modules
  - `data_parser.py` - Data parsing utilities
  - `helpers.py` - Helper functions
  - `login.py` - Login and environment parsing
  - `screen_saver.py` - Screensaver functionality
  - `selenium_runner.py` - Selenium automation utilities
  - `supabase_utils.py` - Supabase integration helpers

## Notes
- ChromeDriver is managed automatically via `webdriver_manager`.
- The application uses Tkinter for the GUI and Selenium for browser automation.
- Sensitive information (credentials) should only be stored in the `.env` file (never commit this file).

## Contributing
Pull requests and suggestions are welcome! Please open an issue first to discuss any major changes.

## License
This project is for internal use. Contact the author for licensing details.