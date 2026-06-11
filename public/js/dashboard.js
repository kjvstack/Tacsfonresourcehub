async function loadUploads() {
    const list = document.getElementById('uploadList');
    list.innerHTML = '<p>Loading...</p>';
    try {
        const res = await fetch('/api/uploads');
        if (!res.ok) throw new Error('Failed to fetch uploads');
        const items = await res.json();
        if (!items.length) {
            list.innerHTML = '<p style="color:#666">No uploads yet.</p>';
            return;
        }
        list.innerHTML = '';
        items.forEach(it => {
            const div = document.createElement('div');
            div.className = 'upload-card';
            const date = new Date(it.createdAt).toLocaleString();
            const fileType = it.mimeType ? it.mimeType.split('/')[1].toUpperCase() : 'FILE';
            div.innerHTML = `
                <strong>${escapeHtml(it.title)}</strong>
                <p style="margin:8px 0 5px; color:#555; font-size:0.9em;"><strong>Category:</strong> ${escapeHtml(it.category || 'N/A').replace(/-/g, ' ')}</p>
                <p style="margin:5px 0 5px; color:#555; font-size:0.9em;"><strong>Description:</strong> ${escapeHtml(it.description || 'N/A')}</p>
                <p style="margin:5px 0 10px; color:#777; font-size:0.85em;">Uploaded: ${date} • ${fileType}</p>
                <button class="download-btn" type="button" data-id="${it._id}" data-filename="${escapeHtml(it.originalName || it.title || 'download')}">Download</button>
            `;
            list.appendChild(div);
        });
        attachDownloadHandlers();
    } catch (err) {
        list.innerHTML = `<p style="color:red">Error loading uploads</p>`;
        console.error(err);
    }
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

function escapeHtml(s){
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

window.addEventListener('DOMContentLoaded', () => {
    loadUploads();

    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('requestId');
    const requestMessage = document.getElementById('requestUploadMessage');
    const requestInput = document.getElementById('requestId');

    if (requestId && requestMessage && requestInput) {
        requestMessage.textContent = `Upload a document to resolve request #${requestId}. After successful upload, request status will be updated.`;
        requestInput.value = requestId;
    }
});
