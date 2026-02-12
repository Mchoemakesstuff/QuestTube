from rembg import remove
from PIL import Image
import sys
import os

def process_image(input_path):
    print(f"Processing {input_path} with rembg...")
    try:
        if not os.path.exists(input_path):
            print(f"Error: {input_path} not found.")
            return

        img = Image.open(input_path)
        output = remove(img)
        
        # Overwrite original? Safer to save and then move.
        output.save(input_path)
        print(f"Successfully processed {input_path}")
        
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

if __name__ == "__main__":
    # Process both key assets
    process_image("coin.png")
    process_image("portal.png")
