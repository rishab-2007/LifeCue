import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(
    os.path.join(os.path.dirname(__file__), ".env"),
    override=True
)

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "lifecue")

client = MongoClient(MONGODB_URL)

try:
    client.admin.command("ping")
    print("MongoDB connected successfully! ✅")
except Exception as e:
    print("MongoDB connection failed ❌")
    print(e)

db = client[DATABASE_NAME]