from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Service-role client: this microservice is a trusted internal caller,
# equivalent to how Node.js's supabaseClient.js uses the service role key.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)