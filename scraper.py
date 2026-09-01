import time
import json
import os
from playwright.sync_api import sync_playwright

def main():
    images_dir = os.path.join(os.getcwd(), 'images')
    os.makedirs(images_dir, exist_ok=True)
    
    data = []
    
    with sync_playwright() as p:
        # Launch browser visibly so the user can log in
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        # Go to the badges page
        page.goto('https://education.ni.com/badges/pathways')
        
        print("\n" + "="*60)
        print("ACTION REQUIRED:")
        print("1. Please log in to your NI Badges account in the opened browser.")
        print("2. Navigate to an assessment and start the quiz.")
        print("3. Once you see the FIRST QUESTION on your screen, come back here.")
        print("="*60 + "\n")
        
        input("Press ENTER here ONLY when you are looking at the first question...")
        print("Starting extraction...\n")
        
        question_count = 1
        
        while True:
            # The quiz is likely in an iframe
            target_frame = None
            for frame in page.frames:
                if 'myquizscape.com' in frame.url:
                    target_frame = frame
                    break
            
            # Fallback to main page if iframe not found
            if not target_frame:
                target_frame = page.main_frame
            
            # Wait a moment for dynamic content to load
            time.sleep(2)
            
            print(f"Extracting Question {question_count}...")
            
            # Take a screenshot of the quiz container or the whole frame
            screenshot_path = os.path.join(images_dir, f'q_auto_{question_count}.png')
            
            try:
                # Try to find the quiz container to avoid capturing headers
                container = target_frame.locator('.quiz-container').first
                if container.is_visible():
                    container.screenshot(path=screenshot_path)
                else:
                    # Fallback to full frame screenshot
                    target_frame.locator('body').screenshot(path=screenshot_path)
            except Exception as e:
                print(f"Warning: Could not take screenshot for Q{question_count}: {e}")
            
            # Extract raw text for later parsing
            raw_text = ""
            try:
                raw_text = target_frame.locator('body').inner_text()
            except Exception as e:
                pass
                
            data.append({
                "id": question_count,
                "screenshot": f"images/q_auto_{question_count}.png",
                "raw_text": raw_text
            })
            
            # Look for the 'Next' button
            # Common text for next buttons in these quizzes
            next_btn = target_frame.locator('button', has_text="Next").first
            
            if next_btn.is_visible() and not next_btn.is_disabled():
                print(f"Clicking Next...")
                next_btn.click()
                question_count += 1
            else:
                print("No 'Next' button found, or it's disabled. End of quiz reached.")
                break
                
        # Save the extracted data
        with open('extracted_quiz_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
            
        print("\nExtraction complete!")
        print(f"Total questions processed: {question_count}")
        print("Data saved to 'extracted_quiz_data.json' and screenshots in 'images/'.")
        print("You can close the browser now.")
        
        # Keep browser open a bit just in case
        time.sleep(5)
        browser.close()

if __name__ == '__main__':
    main()
