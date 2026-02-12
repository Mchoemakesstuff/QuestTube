from PIL import Image
import math

def get_distance(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])))

def clean_image(path, bg_hints=[], tolerance=30):
    print(f"Aggressive cleaning {path}...")
    try:
        img = Image.open(path).convert("RGBA")
        width, height = img.size
        pixels = img.load()
        
        visited = set()
        to_clear = set()
        
        # Scan all borders
        border_pixels = []
        for x in range(width):
            border_pixels.append((x, 0))
            border_pixels.append((x, height - 1))
        for y in range(height):
            border_pixels.append((0, y))
            border_pixels.append((width - 1, y))
            
        for bx, by in border_pixels:
            if (bx, by) in visited:
                continue
                
            color = pixels[bx, by]
            # If transparent already, skip
            if color[3] == 0:
                continue
                
            # Heuristic: Is this a background color?
            # 1. Matches explicit hints?
            is_bg = False
            for hint in bg_hints:
                if get_distance(color, hint) < tolerance:
                    is_bg = True
                    break
            
            # 2. Or assume borders are background for these isolated sprites?
            # Yes, assume borders are background.
            is_bg = True 
            
            if is_bg:
                # Flood fill from here
                queue = [(bx, by)]
                start_color = color
                
                while queue:
                    x, y = queue.pop(0)
                    if (x, y) in visited:
                        continue
                    visited.add((x, y))
                    
                    if get_distance(pixels[x, y], start_color) <= tolerance:
                        to_clear.add((x, y))
                        pixels[x, y] = (0, 0, 0, 0) # Clear immediately
                        
                        # Add neighbors
                        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < width and 0 <= ny < height:
                                queue.append((nx, ny))

        print(f"Cleared {len(to_clear)} pixels.")
        img.save(path)
        print(f"Saved {path}")
        
    except Exception as e:
        print(f"Error processing {path}: {e}")

if __name__ == "__main__":
    # Coin: Light background
    clean_image("coin.png", bg_hints=[(255, 255, 255), (200, 200, 200)], tolerance=50)
    
    # Portal: Dark/Purple background? 
    # Actually, Portal background was ~ (55, 55, 53).
    clean_image("portal.png", bg_hints=[(55, 55, 53)], tolerance=50)
