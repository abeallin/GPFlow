from supabase import create_client, Client
from dotenv import load_dotenv
import os

SUPABASE_URL = "https://tpsdgopzqinktagwtbcy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwc2Rnb3B6cWlua3RhZ3d0YmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTI4MjgsImV4cCI6MjA2ODA2ODgyOH0.XyRmTlwjZvKfA8wg4jmv0_Wa_RmvQo9gGL2nxnho-2M"

def get_supabase_client():
    load_dotenv(override=True)
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def is_license_key_valid(license_key):
    client = get_supabase_client()
    try:
        response = client.table("runner_licenses").select("*").eq("license_key", license_key).execute()
        return bool(response.data)
    except Exception as e:
        print(f"Supabase license check error: {e}")
        return False 