// Load uploads dynamically
async function loadUploads() {
    const list = document.getElementById('uploadList');
    try {
        const res = await fetch('/api/uploads');
        if (!res.ok) throw new Error('Failed to fetch uploads');
        const items = await res.json();
        if (!items.length) {
            list.innerHTML = '<p style="color:#666">No uploads yet. Check back soon!</p>';
            return;
        }
        list.innerHTML = '';
        items.forEach(it => {
            const div = document.createElement('div');
            div.className = 'upload-item';
            const date = new Date(it.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const fileType = it.mimeType ? it.mimeType.split('/')[1].toUpperCase() : 'FILE';
            div.innerHTML = `
                <div>
                    <h3>${escapeHtml(it.title)}</h3>
                    <p style="margin:5px 0; color:#666; font-size:0.9em;"><strong>Category:</strong> ${escapeHtml(it.category || 'N/A').replace(/-/g, ' ')}</p>
                    <p style="margin:5px 0; color:#666; font-size:0.9em;"><strong>Description:</strong> ${escapeHtml(it.description || 'N/A')}</p>
                    <small style="color:#999;">Uploaded ${date} • ${fileType}</small>
                </div>
                <a href="/download/${it._id}" class="download-btn">Download</a>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        list.innerHTML = '<p style="color:red">Error loading uploads</p>';
        console.error(err);
    }
}

// Handle resource request form
document.addEventListener('DOMContentLoaded', () => {
    loadUploads();

    const menuToggle = document.querySelector('.menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    console.log('Menu toggle element:', menuToggle);
    console.log('Main nav element:', mainNav);
    
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            console.log('Menu toggle clicked!');
            mainNav.classList.toggle('open');
            console.log('Toggled open class. Current classes:', mainNav.className);
        });
    } else {
        console.warn('Menu toggle or main nav not found!');
    }

    const form = document.getElementById('requestForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const statusDiv = document.getElementById('requestStatus');
            statusDiv.innerHTML = '<p style="color:#00733e">Submitting your request...</p>';
            
            const formData = new FormData(form);
            try {
                const res = await fetch('/api/request-resource', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        resourceName: formData.get('resourceName'),
                        category: formData.get('category'),
                        description: formData.get('description')
                    })
                });

                if (!res.ok) throw new Error('Failed to submit request');
                
                statusDiv.innerHTML = '<p style="color:#00733e"><strong>✅ Request submitted successfully!</strong> Our admins will review your request shortly.</p>';
                form.reset();
                setTimeout(() => {
                    statusDiv.innerHTML = '';
                }, 5000);
            } catch (err) {
                statusDiv.innerHTML = '<p style="color:red"><strong>Error:</strong> Failed to submit request. Please try again.</p>';
                console.error(err);
            }
        });
    }
});

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
