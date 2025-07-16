from dotenv import load_dotenv
import os

def parse_env_file(file_path):
    """
    Parse a .env file containing login credentials.

    Args:
        file_path (str): Path to the .env file.

    Returns:
        dict: A dictionary with 'username' and 'password'.
    """
    load_dotenv(dotenv_path=file_path)
    username = os.getenv("ACCURX_USERNAME")
    password = os.getenv("ACCURX_PASSWORD")
    if username and password:
        return {"username": username, "password": password}
    else:
        raise ValueError("The .env file must contain 'ACCURX_USERNAME' and 'ACCURX_PASSWORD' keys.")
