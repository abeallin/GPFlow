from dotenv import load_dotenv
import os

def get_username(file_path):
    load_dotenv(dotenv_path=file_path)
    return os.getenv("ACCURX_USERNAME")

def get_password(file_path):
    load_dotenv(dotenv_path=file_path)
    return os.getenv("ACCURX_PASSWORD")

def get_license_key(file_path):
    load_dotenv(dotenv_path=file_path)
    return os.getenv("LICENSE_KEY")

def get_credentials(file_path):
    load_dotenv(dotenv_path=file_path)
    username = os.getenv("ACCURX_USERNAME")
    password = os.getenv("ACCURX_PASSWORD")
    license_key = os.getenv("LICENSE_KEY")
    creds = {}
    if username:
        creds["username"] = username
    if password:
        creds["password"] = password
    if license_key:
        creds["license_key"] = license_key
    return creds

# Backwards compatibility
parse_env_file = get_credentials
parse_license_key = get_license_key