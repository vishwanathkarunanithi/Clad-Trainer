document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginBtn = document.getElementById('login-btn');
    const adminPass = document.getElementById('admin-pass');
    const errorMsg = document.getElementById('login-error');

    // Simple Authentication
    loginBtn.addEventListener('click', () => {
        if (adminPass.value === 'admin123') {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            
            // Load saved sheet URL
            const savedSheet = localStorage.getItem('clad_sheet_url');
            if (savedSheet) {
                document.getElementById('sheet-url').value = savedSheet;
            }
        } else {
            errorMsg.classList.remove('hidden');
        }
    });

    // Handle Enter key for login
    adminPass.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    // Generate Link
    document.getElementById('generate-btn').addEventListener('click', () => {
        const timeLimit = document.getElementById('test-time').value;
        
        // Get the base URL (where index.html is hosted)
        let baseUrl = window.location.href.split('admin.html')[0];
        if (!baseUrl.endsWith('/')) baseUrl += '/';
        
        // Create the specific link
        const link = `${baseUrl}index.html?time=${timeLimit}`;
        
        document.getElementById('generated-link').value = link;
        document.getElementById('generated-link-container').classList.remove('hidden');
    });

    // Copy Link
    document.getElementById('copy-btn').addEventListener('click', () => {
        const copyText = document.getElementById('generated-link');
        copyText.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copy-btn');
        btn.textContent = '✅ Copied!';
        setTimeout(() => btn.textContent = '📋 Copy Link', 2000);
    });

    // Open Live Sheet
    document.getElementById('open-sheet-btn').addEventListener('click', () => {
        const url = document.getElementById('sheet-url').value.trim();
        if (url) {
            localStorage.setItem('clad_sheet_url', url);
            window.open(url, '_blank');
        } else {
            alert('Please paste your Google Sheet URL first.');
        }
    });
});
