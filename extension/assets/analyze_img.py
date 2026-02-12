from PIL import Image
import sys

def analyze(path):
    print(f"Analyzing {path}...")
    try:
        img = Image.open(path).convert("RGBA")
        pixels = img.load()
        # Print top-left 10x10 to see background
        print("Top-Left 5x5 pixels:")
        for y in range(5):
            row = []
            for x in range(5):
                row.append(str(pixels[x, y]))
            print(f"Row {y}: " + ", ".join(row))
            
        # Check distinct colors in the first row
        colors = set()
        for x in range(img.width):
            colors.add(pixels[x, 0])
        print(f"Distinct colors in row 0: {len(colors)}")
        print(list(colors)[:5])
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        analyze(arg)
