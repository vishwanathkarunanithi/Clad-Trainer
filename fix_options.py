import json
import re

JSON_FILE = "questions.json"

def fix_options():
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    fixed_count = 0
    
    # Regex to catch "c." "C." "c)" "C)" "d." "d)" etc in the middle of a string
    pattern = re.compile(r'(\s+[cdeCDE][\.\)])\s*(.*)')
    
    for q in questions:
        new_options = []
        changed = False
        
        for opt in q.get("options", []):
            if opt.startswith("IMAGE:"):
                new_options.append(opt)
                continue
                
            # Keep splitting while we find embedded options
            current_str = opt
            while True:
                match = pattern.search(current_str)
                if match:
                    # Found an embedded option!
                    first_part = current_str[:match.start()].strip()
                    if first_part:
                        new_options.append(first_part)
                    else:
                        new_options.append(current_str) # safety
                        break
                        
                    current_str = match.group(1).strip() + " " + match.group(2).strip()
                    changed = True
                else:
                    new_options.append(current_str)
                    break
                    
        if changed:
            # Clean up letters at the start of new options if they look like "c. TEXT"
            # Actually, the frontend adds A) B) C), so we should strip the manual letters!
            cleaned_options = []
            for o in new_options:
                if o.startswith("IMAGE:"):
                    cleaned_options.append(o)
                else:
                    # Strip leading "a) ", "b. ", etc
                    o = re.sub(r'^([a-fA-F][\.\)])\s*', '', o).strip()
                    cleaned_options.append(o)
            
            q["options"] = cleaned_options
            fixed_count += 1
            print(f"Fixed Q{q['id']}: {cleaned_options}")
            
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=4)
        
    print(f"Fixed {fixed_count} questions with combined options!")

if __name__ == "__main__":
    fix_options()
