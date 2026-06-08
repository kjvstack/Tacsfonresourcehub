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
            const date = new Date(it.uploadedAt).toLocaleString();
            div.innerHTML = `
                <strong>${escapeHtml(it.originalName)}</strong>
                <p style="margin:8px 0 10px; color:#555;">Uploaded: ${date}</p>
                <a class="download-btn" href="/files/${encodeURIComponent(it.filename)}">Download</a>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        list.innerHTML = `<p style="color:red">Error loading uploads</p>`;
        console.error(err);
    }
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
