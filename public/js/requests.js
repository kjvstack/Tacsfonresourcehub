// Load resource requests
async function loadRequests() {
    const list = document.getElementById('requestsList');
    try {
        const res = await fetch('/api/requests');
        if (!res.ok) throw new Error('Failed to fetch requests');
        const requests = await res.json();
        
        if (!requests.length) {
            list.innerHTML = '<p style="padding:20px; color:#666;">No resource requests yet.</p>';
            return;
        }

        list.innerHTML = '';
        requests.forEach((req, idx) => {
            const date = new Date(req.requestedAt).toLocaleString();
            const statusColor = req.status === 'pending' ? '#ff6b00' : '#00733e';
            const adminAnswer = req.adminAnswer ? `<p style="margin:12px 0 0; color:#444; font-size:0.9em;"><strong>Admin response:</strong> ${escapeHtml(req.adminAnswer)}</p>` : '';
            const actionButton = req.status === 'pending'
                ? `<button data-id="${req.id}" type="button" class="resolve-btn" style="margin-top:16px; padding:10px 16px; border:none; background:#00733e; color:white; border-radius:8px; cursor:pointer;">Upload Document</button>`
                : '';
            
            const div = document.createElement('div');
            div.style.cssText = 'padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px;';
            
            div.innerHTML = `
                <div style="flex:1; min-width:250px;">
                    <h3 style="margin:0 0 10px; color:#00733e;">${escapeHtml(req.resourceName)}</h3>
                    <p style="margin:5px 0; color:#666; font-size:0.9em;">
                        <strong>Category:</strong> ${escapeHtml(req.category)}
                    </p>
                    <p style="margin:5px 0; color:#666; font-size:0.9em;">
                        <strong>Description:</strong> ${escapeHtml(req.description || 'N/A')}
                    </p>
                    <p style="margin:10px 0 0; color:#999; font-size:0.85em;">
                        Requested: ${date}
                    </p>
                    ${adminAnswer}
                </div>
                <div style="text-align:center; min-width:150px;">
                    <span style="display:inline-block; padding:6px 12px; background:${statusColor}; color:white; border-radius:6px; font-size:0.85em; text-transform:uppercase;">
                        ${escapeHtml(req.status)}
                    </span>
                    ${actionButton}
                </div>
            `;
            
            if (idx !== requests.length - 1) {
                div.style.borderBottom = '1px solid #eee';
            }
            
            list.appendChild(div);
        });

        document.querySelectorAll('.resolve-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const requestId = event.target.dataset.id;
                window.location.href = `/dashboard.html?requestId=${encodeURIComponent(requestId)}`;
            });
        });
    } catch (err) {
        list.innerHTML = '<p style="padding:20px; color:red;">Error loading requests</p>';
        console.error(err);
    }
}

// Handle logout
document.addEventListener('DOMContentLoaded', () => {
    loadRequests();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const sid = new URLSearchParams(window.location.search).get('sid');
            window.location.href = `/logout?sid=${sid}`;
        });
    }
});

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
