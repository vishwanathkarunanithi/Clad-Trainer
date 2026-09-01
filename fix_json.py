import json
import os

JSON_FILE = "questions.json"

def fix_images():
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    fixed_count = 0
    for q in questions:
        options = q.get("options", [])
        
        # Check if there's a mix of text and image options
        text_options = [o for o in options if not o.startswith("IMAGE: ")]
        image_options = [o for o in options if o.startswith("IMAGE: ")]
        
        if len(text_options) >= 2 and len(image_options) > 0:
            # The images are very likely question diagrams that appeared below the text options
            # Move them to the question's image array
            for img_opt in image_options:
                img_src = img_opt.replace("IMAGE: ", "")
                if "image" not in q or q["image"] is None:
                    q["image"] = []
                elif not isinstance(q["image"], list):
                    q["image"] = [q["image"]]
                    
                q["image"].append(img_src)
                
            # Remove from options
            q["options"] = text_options
            fixed_count += 1
            
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=4)
        
    print(f"Fixed {fixed_count} questions by moving misplaced image options to question diagrams!")

if __name__ == "__main__":
    fix_images()
