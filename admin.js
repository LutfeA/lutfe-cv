(() => {
  const cfg = window.CV_CONFIG;
  const loginPanel = document.getElementById('loginPanel');
  const dashboardPanel = document.getElementById('dashboardPanel');
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const signedInAs = document.getElementById('signedInAs');
  const toast = document.getElementById('toast');
  const fileInput = document.getElementById('fileInput');
  const chooseFileBtn = document.getElementById('chooseFileBtn');
  const uploadZone = document.getElementById('uploadZone');
  const selectedFile = document.getElementById('selectedFile');
  const selectedFileName = document.getElementById('selectedFileName');
  const selectedFileSize = document.getElementById('selectedFileSize');
  const uploadBtn = document.getElementById('uploadBtn');
  const progressBox = document.getElementById('progressBox');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');
  const successBox = document.getElementById('successBox');
  const adminCurrentStatus = document.getElementById('adminCurrentStatus');
  const openCurrentBtn = document.getElementById('openCurrentBtn');

  let chosenFile = null;
  let client = null;

  const showToast = (message, error = false) => {
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3400);
  };

  const isConfigured = () => cfg &&
    cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_') &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

  if (!isConfigured()) {
    loginBtn.disabled = true;
    showToast('Configure assets/js/config.js before using Admin.', true);
    return;
  }

  client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function setSessionUI(session) {
    const loggedIn = !!session;
    loginPanel.classList.toggle('hidden', loggedIn);
    dashboardPanel.classList.toggle('hidden', !loggedIn);
    if (loggedIn) {
      signedInAs.textContent = `Signed in as ${session.user.email}`;
      refreshCurrentFile();
    }
  }

  async function refreshCurrentFile() {
    try {
      const { data: files, error } = await client.storage.from(cfg.BUCKET_NAME).list('', { search: cfg.FILE_NAME, limit: 100 });
      if (error) throw error;
      const file = (files || []).find(f => f.name === cfg.FILE_NAME);
      if (!file) {
        adminCurrentStatus.textContent = 'No CV uploaded yet';
        openCurrentBtn.classList.add('hidden');
        return;
      }
      const updated = file.updated_at ? new Date(file.updated_at).toLocaleString() : 'Available';
      adminCurrentStatus.textContent = `Updated ${updated} · ${formatBytes(file.metadata?.size || 0)}`;
      const { data } = client.storage.from(cfg.BUCKET_NAME).getPublicUrl(cfg.FILE_NAME);
      openCurrentBtn.href = `${data.publicUrl}?v=${Date.now()}`;
      openCurrentBtn.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      adminCurrentStatus.textContent = 'Could not read storage';
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setSessionUI(data.session);
      loginForm.reset();
      showToast('Signed in successfully.');
    } catch (err) {
      console.error(err);
      showToast('Invalid login or account access is not configured.', true);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In →';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    setSessionUI(null);
    chosenFile = null;
    selectedFile.classList.add('hidden');
    showToast('Signed out.');
  });

  function handleChosenFile(file) {
    successBox.classList.add('hidden');
    if (!file) return;
    const maxBytes = (cfg.MAX_FILE_SIZE_MB || 15) * 1024 * 1024;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      showToast('Please choose a PDF file only.', true);
      fileInput.value = '';
      return;
    }
    if (file.size > maxBytes) {
      showToast(`File is too large. Maximum is ${cfg.MAX_FILE_SIZE_MB || 15} MB.`, true);
      fileInput.value = '';
      return;
    }

    chosenFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = `${formatBytes(file.size)} · Ready to upload`;
    selectedFile.classList.remove('hidden');
  }

  chooseFileBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleChosenFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach(type => uploadZone.addEventListener(type, (e) => {
    e.preventDefault(); e.stopPropagation(); uploadZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(type => uploadZone.addEventListener(type, (e) => {
    e.preventDefault(); e.stopPropagation(); uploadZone.classList.remove('dragover');
  }));
  uploadZone.addEventListener('drop', (e) => handleChosenFile(e.dataTransfer.files[0]));

  uploadBtn.addEventListener('click', async () => {
    if (!chosenFile) return;

    uploadBtn.disabled = true;
    progressBox.classList.remove('hidden');
    successBox.classList.add('hidden');
    progressText.textContent = 'Uploading and replacing current CV…';
    progressPercent.textContent = '35%';
    progressBar.style.width = '35%';

    try {
      const { error } = await client.storage.from(cfg.BUCKET_NAME).upload(cfg.FILE_NAME, chosenFile, {
        upsert: true,
        contentType: 'application/pdf',
        cacheControl: '60'
      });
      if (error) throw error;

      progressPercent.textContent = '100%';
      progressBar.style.width = '100%';
      progressText.textContent = 'Upload complete';
      successBox.classList.remove('hidden');
      showToast('CV updated successfully.');
      await refreshCurrentFile();

      setTimeout(() => {
        progressBox.classList.add('hidden');
        progressBar.style.width = '0%';
      }, 1200);
    } catch (err) {
      console.error(err);
      showToast('Upload failed. Check your storage policies.', true);
      progressText.textContent = 'Upload failed';
      progressPercent.textContent = '0%';
      progressBar.style.width = '0%';
    } finally {
      uploadBtn.disabled = false;
    }
  });

  client.auth.getSession().then(({ data }) => setSessionUI(data.session));
  client.auth.onAuthStateChange((_event, session) => setSessionUI(session));
})();
