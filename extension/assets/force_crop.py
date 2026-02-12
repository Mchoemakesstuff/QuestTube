from PIL import Image, ImageDraw
import math

def circular_crop(path):
    print(f"Circular cropping {path}...")
    try:
        img = Image.open(path).convert("RGBA")
        width, height = img.size
        
        # Create a circular mask
        mask = Image.new('L', (width, height), 0)
        draw = ImageDraw.Draw(mask)
        
        # Calculate center and radius
        # Reduce radius slightly to ensure we cut off the edge artifacts
        radius = min(width, height) / 2 - 2 
        center_x, center_y = width / 2, height / 2
        
        draw.ellipse((center_x - radius, center_y - radius, center_x + radius, center_y + radius), fill=255)
        
        # Apply mask
        result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        result.paste(img, (0, 0), mask=mask)
        
        result.save(path)
        print(f"Saved cropped {path}")
        
    except Exception as e:
        print(f"Error processing {path}: {e}")

if __name__ == "__main__":
    circular_crop("coin.png")
    circular_crop("portal.png")
