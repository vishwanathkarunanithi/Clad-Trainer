import json
import re

JSON_FILE = "questions.json"

def fix_all():
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    for q in questions:
        changed = False
        
        # 1. Check if option A is merged into question text
        # Example: "What is this? a. 5" or "What is this? a) 5"
        q_text = q["text"]
        match_a = re.search(r'\s+a[\.\)]\s*(.*)$', q_text, re.IGNORECASE)
        if match_a and len(q["options"]) == 3:
            # Extract option A
            opt_a = match_a.group(1).strip()
            # Remove it from question text
            q["text"] = q_text[:match_a.start()].strip()
            # Prepend to options
            q["options"].insert(0, opt_a)
            changed = True
            
        # 2. Check for 'b)', 'c)', 'd)' embedded in options
        # We will split options that contain other options
        pattern = re.compile(r'(\s+[bcde][\.\)])\s*(.*)', re.IGNORECASE)
        new_options = []
        for opt in q.get("options", []):
            if opt.startswith("IMAGE:"):
                new_options.append(opt)
                continue
                
            current_str = opt
            while True:
                match = pattern.search(current_str)
                if match:
                    first_part = current_str[:match.start()].strip()
                    if first_part:
                        new_options.append(first_part)
                    else:
                        new_options.append(current_str)
                        break
                        
                    current_str = match.group(2).strip()
                    changed = True
                else:
                    new_options.append(current_str)
                    break
        
        if changed:
            q["options"] = new_options
            
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=4)
        
    print("Fixed option bugs!")

if __name__ == "__main__":
    fix_all()
