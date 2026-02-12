import requests
import sys
import os

API_KEY = sys.argv[1] if len(sys.argv) > 1 else None
IMAGE_PATH = sys.argv[2] if len(sys.argv) > 2 else "portal.png"

def remove_bg(api_key, path):
    print(f"Calling Remove.bg API for {path}...")
    
    if not api_key:
        print("Error: API Key is required.")
        return

    try:
        response = requests.post(
            'https://api.remove.bg/v1.0/removebg',
            files={'image_file': open(path, 'rb')},
            data={'size': 'auto'},
            headers={'X-Api-Key': api_key},
        )
        
        if response.status_code == requests.codes.ok:
            with open(path, 'wb') as out:
                out.write(response.content)
            print(f"Successfully removed background from {path}")
        else:
            print(f"Error: {response.status_code} {response.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    if not API_KEY:
        print("Usage: python3 call_removebg.py <API_KEY> <IMAGE_PATH>")
    else:
        remove_bg(API_KEY, IMAGE_PATH)
