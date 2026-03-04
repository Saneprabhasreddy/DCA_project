import os
from dotenv import load_dotenv
from pymongo import MongoClient
import sys

# Load env vars
load_dotenv()
uri = os.environ.get("MONGO_URI")
print(f"DEBUG: MONGO_URI from env: {uri}")

if not uri:
    print("ERROR: MONGO_URI is missing")
    sys.exit(1)

try:
    client = MongoClient(uri)
    # Check connection
    client.admin.command('ping')
    print("DEBUG: Connected to MongoDB successfully")
    
    db = client.get_default_database()
    print(f"DEBUG: Database Name: {db.name}")
    
    col_names = db.list_collection_names()
    print(f"DEBUG: Collections: {col_names}")
    
    if "cases" in col_names:
        count = db["cases"].count_documents({})
        print(f"DEBUG: Count in 'cases': {count}")
    else:
        print("DEBUG: 'cases' collection NOT FOUND")
        
except Exception as e:
    print(f"ERROR: {e}")
