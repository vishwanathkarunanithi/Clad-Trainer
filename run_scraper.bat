@echo off
echo Setting up environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate

echo Checking for Playwright...
python -c "import playwright" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Playwright...
    pip install playwright
)

echo Ensuring Chromium browser is downloaded...
playwright install chromium

echo Starting Scraper...
python scraper.py
pause
