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
                    <button class="download-btn" type="button" data-id="${it._id}" data-filename="${escapeHtml(it.originalName || it.title || 'download')}">Download</button>
                `;
            list.appendChild(div);
        });
            attachDownloadHandlers();
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

function showDownloadToast(message) {
    let toast = document.getElementById('downloadToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'downloadToast';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = 'rgba(0,0,0,0.9)';
        toast.style.color = '#fff';
        toast.style.padding = '14px 18px';
        toast.style.borderRadius = '10px';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        toast.style.zIndex = '9999';
        toast.style.fontSize = '0.95rem';
        toast.style.maxWidth = '320px';
        toast.style.lineHeight = '1.4';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3200);
}

async function downloadResource(id, filename) {
    try {
        const response = await fetch(`/download/${id}`);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        showDownloadToast(`Downloaded: ${filename}`);
    } catch (err) {
        console.error(err);
        showDownloadToast('Download failed. Please try again.');
    }
}

function attachDownloadHandlers() {
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const filename = btn.dataset.filename || 'download';
            downloadResource(id, filename);
        });
    });
}
