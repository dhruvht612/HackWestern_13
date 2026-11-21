import os

from supabase import Client, create_client

from attacksurface.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_key)
