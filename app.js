(() => {
  const cfg = window.CV_CONFIG;
  const pdfViewer = document.getElementById('pdfViewer');
  const viewerMessage = document.getElementById('viewerMessage');
  const fileStatus = document.getElementById('fileStatus');
  const cvMeta = document.getElementById('cvMeta');
  const downloadBtn = document.getElementById('downloadBtn');
  const heroDownloadBtn = document.getElementById('heroDownloadBtn');
  const toast = document.getElementById('toast');

  document.getElementById('year').textContent = new Date().getFullYear();

  const showToast = (message, error = false) => {
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  };

  const isConfigured = () => {
    return cfg &&
      cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_') &&
      cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');
  };

  const showSetupMessage = () => {
    viewerMessage.innerHTML = `
      <div class="pdf-icon" style="margin:auto">PDF</div>
      <h3>CV storage is not connected yet</h3>
      <p>Add your Supabase URL and anon key in <code>assets/js/config.js</code>, then upload the first PDF from the Admin page.</p>
    `;
    fileStatus.textContent = 'Storage setup required';
    cvMeta.textContent = 'Not configured';
    downloadBtn.disabled = true;
    heroDownloadBtn.disabled = true;
  };

  if (!isConfigured()) {
    showSetupMessage();
    return;
  }

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function loadCv() {
    try {
      const { data: files, error: listError } = await client.storage.from(cfg.BUCKET_NAME).list('', {
        limit: 100,
        search: cfg.FILE_NAME
      });
      if (listError) throw listError;

      const file = (files || []).find(item => item.name === cfg.FILE_NAME);
      if (!file) {
        viewerMessage.innerHTML = `
          <div class="pdf-icon" style="margin:auto">PDF</div>
          <h3>No CV uploaded yet</h3>
          <p>The administrator can upload the first PDF from the Admin page.</p>
        `;
        fileStatus.textContent = 'No public PDF found';
        cvMeta.textContent = 'Waiting for first upload';
        downloadBtn.disabled = true;
        heroDownloadBtn.disabled = true;
        return;
      }

      const { data } = client.storage.from(cfg.BUCKET_NAME).getPublicUrl(cfg.FILE_NAME);
      const version = encodeURIComponent(file.updated_at || file.created_at || Date.now());
      const publicUrl = `${data.publicUrl}?v=${version}`;

      pdfViewer.src = `${publicUrl}#toolbar=1&navpanes=0&view=FitH`;
      pdfViewer.style.display = 'block';
      viewerMessage.style.display = 'none';

      const updated = file.updated_at ? new Date(file.updated_at) : null;
      fileStatus.textContent = 'Public PDF · Always latest version';
      cvMeta.textContent = updated ? `Last updated: ${updated.toLocaleString()}` : 'Latest version';
      downloadBtn.disabled = false;
      heroDownloadBtn.disabled = false;
    } catch (err) {
      console.error(err);
      viewerMessage.innerHTML = `
        <div class="pdf-icon" style="margin:auto">PDF</div>
        <h3>Could not load the CV</h3>
        <p>Check your Supabase settings and storage policies.</p>
      `;
      fileStatus.textContent = 'Unable to load PDF';
      cvMeta.textContent = 'Connection error';
      showToast('Could not load the CV.', true);
    }
  }

  async function downloadCv() {
    try {
      downloadBtn.disabled = true;
      heroDownloadBtn.disabled = true;
      const { data, error } = await client.storage.from(cfg.BUCKET_NAME).download(cfg.FILE_NAME);
      if (error) throw error;

      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'Lutfe_Qashmar_CV.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      showToast('CV download started.');
    } catch (err) {
      console.error(err);
      showToast('Download failed. Please try again.', true);
    } finally {
      downloadBtn.disabled = false;
      heroDownloadBtn.disabled = false;
    }
  }

  downloadBtn.addEventListener('click', downloadCv);
  heroDownloadBtn.addEventListener('click', downloadCv);
  loadCv();
})();
