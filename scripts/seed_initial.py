# Simple seed script using Supabase REST (requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars)
import os, requests
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type':'application/json'}

def create_classes():
    classes = []
    for year in [3,4,5,6]:
        for c in ['M','B']:
            classes.append({'year':year,'label':f"{year}{c}"})
    resp = requests.post(f"{SUPABASE_URL}/rest/v1/classes", json=classes, headers=headers)
    print(resp.status_code, resp.text)

if __name__=='__main__':
    create_classes()
    print('Seed complete')
