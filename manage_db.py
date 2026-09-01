import json
import os
import shutil

DB_DIR = "Database"
JSON_FILE = "questions.json"

def unpack_db():
    if not os.path.exists(JSON_FILE):
        print("questions.json not found!")
        return
        
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        questions = json.load(f)
        
    if os.path.exists(DB_DIR):
        shutil.rmtree(DB_DIR)
    
    for q in questions:
        topic = q.get("topic", "Uncategorized")
        # Clean topic name for folder
        safe_topic = "".join([c for c in topic if c.isalpha() or c.isdigit() or c==' ']).strip()
        topic_dir = os.path.join(DB_DIR, safe_topic)
        os.makedirs(topic_dir, exist_ok=True)
        
        q_file = os.path.join(topic_dir, f"q_{q['id']}.json")
        with open(q_file, 'w', encoding='utf-8') as f:
            json.dump(q, f, indent=4)
            
    print(f"Successfully unpacked {len(questions)} questions into '{DB_DIR}' folder hierarchically by topic!")

def pack_db():
    if not os.path.exists(DB_DIR):
        print(f"{DB_DIR} folder not found! Cannot pack.")
        return
        
    questions = []
    
    for root, dirs, files in os.walk(DB_DIR):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    try:
                        q = json.load(f)
                        questions.append(q)
                    except json.JSONDecodeError:
                        print(f"Error reading {file_path}")
                        
    # Sort by ID so they are in consistent order
    questions.sort(key=lambda x: x.get("id", 0))
    
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=4)
        
    print(f"Successfully packed {len(questions)} questions from '{DB_DIR}' back into '{JSON_FILE}'!")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "unpack":
            unpack_db()
        elif sys.argv[1] == "pack":
            pack_db()
        else:
            print("Usage: python manage_db.py [unpack|pack]")
    else:
        # Default behavior: unpack to show the hierarchy
        unpack_db()
