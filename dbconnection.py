from pymongo import MongoClient
import pymongo
import os
from os.path import join, dirname
from dotenv import load_dotenv
import certifi

dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

SECRET_KEY_DASHBOARD = os.environ.get("SECRET_KEY_DASHBOARD")
MONGODB_URI = os.environ.get("MONGODB_URI")
DB = os.environ.get("DB")

if not MONGODB_URI:
    raise ValueError("MONGODB_URI not set in environment variables")
if not DB:
    raise ValueError("DB not set in environment variables")
if not isinstance(DB, str):
    raise TypeError(f"DB must be a string, got {type(DB)}: {DB}")

# Gunakan certifi agar SSL handshake sukses di Railway
client = MongoClient(MONGODB_URI, tlsCAFile=certifi.where())
db = client[DB]

# Jangan query DB saat import, tapi lewat fungsi
def ensure_indexes():
    try:
        if 'transaction' in db.list_collection_names():
            db.transaction.create_index([("expired", pymongo.ASCENDING)], expireAfterSeconds=60 * 60 * 24 * 30)
    except Exception as e:
        print("[WARNING] Gagal membuat index transaction:", e)