// Partner Intros - Main Application Logic
// Follows tradeshow-tracker patterns

(function() {
  'use strict';

  // Global state
  const STATE = {
    currentTab: 'shipinsure-optin',
    merchants: [],
    filteredMerchants: [],
    templates: {},
    partnerConfig: { partner_slug: 'digital-genius', partner_name: 'Partner Name' },
    isMasterMode: true,
    realtimeChannel: null,
    selectedMerchant: null
  };

  // Initialize app
  async function init() {
    console.log('Initializing Partner Intros app...');
    
    // Load partner config
    await loadPartnerConfig();
    
    // Load templates
    await loadTemplates();
    
    // Load merchants for current tab
    await loadMerchants();
    
    // Set up real-time subscription
    subscribeToChanges();
    
    // Populate AE filter
    populateAEFilter();
    
    // Check URL params for partner mode
    checkPartnerMode();
    
    console.log('App initialized');
  }

  // Check URL for partner parameter
  function checkPartnerMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const partnerSlug = urlParams.get('partner');
    
    if (partnerSlug) {
      STATE.isMasterMode = false;
      loadPartnerConfig(partnerSlug);
      document.getElementById('master-controls').style.display = 'none';
      document.querySelectorAll('.master-only').forEach(el => el.style.display = 'none');
    }
  }

  // Load partner configuration
  async function loadPartnerConfig(slug = 'digital-genius') {
    try {
      const config = await DB.getPartnerConfig(slug);
      if (config) {
        STATE.partnerConfig = config;
        document.getElementById('partner-name').textContent = config.partner_name;
        document.querySelector('#partner-wishlist-label').textContent = `${config.partner_name} Wish List`;
        
        if (config.logo_url) {
          const logoEl = document.getElementById('partner-logo');
          logoEl.src = config.logo_url;
          logoEl.style.display = 'block';
          document.getElementById('logo-placeholder').style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error loading partner config:', err);
    }
  }

  // Load email templates
  async function loadTemplates() {
    try {
      const optin = await DB.getTemplate('shipinsure-optin');
      const partner = await DB.getTemplate('partner-wishlist');
      const shipinsure = await DB.getTemplate('shipinsure-wishlist');
      
      STATE.templates = {
        'shipinsure-optin': optin,
        'partner-wishlist': partner,
        'shipinsure-wishlist': shipinsure
      };
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  }

  // Load merchants for current tab
  async function loadMerchants() {
    try {
      document.getElementById('merchant-tbody').innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';
      
      const merchants = await DB.getMerchants(STATE.currentTab);
      STATE.merchants = merchants;
      STATE.filteredMerchants = merchants;
      
      renderMerchants();
      updateStats();
    } catch (err) {
      console.error('Error loading merchants:', err);
      document.getElementById('merchant-tbody').innerHTML = '<tr><td colspan="8" class="error">Error loading merchants</td></tr>';
    }
  }

  // Render merchant table
  function renderMerchants() {
    const tbody = document.getElementById('merchant-tbody');
    
    if (STATE.filteredMerchants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No merchants found</td></tr>';
      return;
    }

    tbody.innerHTML = STATE.filteredMerchants.map(m => `
      <tr data-id="${m.id}">
        <td>
          <a href="${m.url || '#'}" target="_blank" class="merchant-link">${m.name}</a>
        </td>
        <td>
          <div class="contact-name">${m.contact_name || '-'}</div>
          <div class="contact-title">${m.contact_title || ''}</div>
        </td>
        <td>
          <span class="badge badge-${getBadgeClass(m.lifecycle_stage)}">${m.lifecycle_stage}</span>
        </td>
        <td class="master-only">${(m.ae_email || '').split('@')[0]}</td>
        <td>
          <select class="icp-select" onchange="APP.updateICP('${m.id}', this.value)" ${!canEditICP() ? 'disabled' : ''}>
            <option ${m.icp_fit === 'ICP 1 (Best)' ? 'selected' : ''}>ICP 1 (Best)</option>
            <option ${m.icp_fit === 'ICP 2 (Good)' ? 'selected' : ''}>ICP 2 (Good)</option>
            <option ${m.icp_fit === 'ICP 3 (Not a Fit)' ? 'selected' : ''}>ICP 3 (Not a Fit)</option>
            <option ${m.icp_fit === 'Not Sure' ? 'selected' : ''}>Not Sure</option>
          </select>
        </td>
        <td>
          <div class="workflow-indicators">
            <div class="workflow-step ${m.asked_date ? 'active' : ''}">
              ${m.asked_date ? '✓' : '○'} Asked
            </div>
            <div class="workflow-step ${m.merchant_yes ? 'active' : ''}">
              ${m.merchant_yes ? '✓' : '○'} Yes
            </div>
            <div class="workflow-step ${m.emailed_date ? 'active' : ''}">
              ${m.emailed_date ? '✓' : '○'} Sent
            </div>
          </div>
        </td>
        <td>
          <button class="btn-small ${m.approved ? 'btn-success' : 'btn-outline'}" onclick="APP.toggleApproval('${m.id}')">
            ${m.approved ? 'Approved' : 'Approve'}
          </button>
        </td>
        <td>
          ${getActionButtons(m)}
        </td>
      </tr>
    `).join('');
  }

  // Get action buttons based on workflow state
  function getActionButtons(merchant) {
    if (!merchant.asked_date) {
      return `<button class="btn-small btn-info" onclick="APP.markAsked('${merchant.id}')">Mark Asked</button>`;
    }
    if (merchant.asked_date && !merchant.merchant_yes) {
      return `<button class="btn-small btn-warning" onclick="APP.markYes('${merchant.id}')">Got Yes</button>`;
    }
    if (merchant.merchant_yes && !merchant.emailed_date) {
      return `<button class="btn-small btn-primary" onclick="APP.generateEmail('${merchant.id}')">📧 Email</button>`;
    }
    return '<span class="workflow-complete">✓ Complete</span>';
  }

  // Get badge class for lifecycle
  function getBadgeClass(lifecycle) {
    const map = {
      'Live ShipInsure Customer': 'success',
      'Live Partner Customer': 'purple',
      'In Deal Cycle': 'info',
      'Churned': 'secondary'
    };
    return map[lifecycle] || 'secondary';
  }

  // Check if ICP can be edited
  function canEditICP() {
    if (STATE.isMasterMode) return true;
    if (STATE.currentTab === 'shipinsure-optin') return true;
    return false;
  }

  // Update stats
  async function updateStats() {
    try {
      const stats = await DB.getStats(STATE.currentTab);
      document.getElementById('stat-total').textContent = stats.total || 0;
      document.getElementById('stat-approved').textContent = stats.approved || 0;
      document.getElementById('stat-asked').textContent = stats.asked || 0;
      document.getElementById('stat-yes').textContent = stats.yes_received || 0;
      document.getElementById('stat-emailed').textContent = stats.emailed || 0;
    } catch (err) {
      console.error('Error updating stats:', err);
    }
  }

  // Switch tabs
  function switchTab(tab) {
    STATE.currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    // Update tab header
    const titles = {
      'shipinsure-optin': 'ShipInsure Pre-Opted In',
      'partner-wishlist': `${STATE.partnerConfig.partner_name} Wish List`,
      'shipinsure-wishlist': 'ShipInsure Wish List'
    };
    
    const descriptions = {
      'shipinsure-optin': 'Merchants already opted in for partner introductions',
      'partner-wishlist': `Merchants ${STATE.partnerConfig.partner_name} wants ShipInsure to introduce`,
      'shipinsure-wishlist': `Merchants ShipInsure wants ${STATE.partnerConfig.partner_name} to introduce`
    };
    
    document.getElementById('tab-title').textContent = titles[tab];
    document.getElementById('tab-description').textContent = descriptions[tab];
    
    // Reset filters
    document.getElementById('search-input').value = '';
    document.getElementById('lifecycle-filter').value = 'All';
    document.getElementById('icp-filter').value = 'All';
    document.getElementById('ae-filter').value = 'All';
    
    // Load merchants for new tab
    loadMerchants();
    
    // Resubscribe to real-time
    subscribeToChanges();
  }

  // Subscribe to real-time changes
  function subscribeToChanges() {
    // Unsubscribe from previous channel
    if (STATE.realtimeChannel) {
      DB.unsubscribe(STATE.realtimeChannel);
    }
    
    // Subscribe to current tab
    STATE.realtimeChannel = DB.subscribeMerchants(STATE.currentTab, (payload) => {
      console.log('Real-time update:', payload);
      loadMerchants(); // Reload merchants on any change
    });
  }

  // Apply filters
  function applyFilters() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const lifecycle = document.getElementById('lifecycle-filter').value;
    const icp = document.getElementById('icp-filter').value;
    const ae = document.getElementById('ae-filter').value;
    
    STATE.filteredMerchants = STATE.merchants.filter(m => {
      const matchesSearch = !search || 
        m.name.toLowerCase().includes(search) || 
        (m.contact_name || '').toLowerCase().includes(search);
      
      const matchesLifecycle = lifecycle === 'All' || m.lifecycle_stage === lifecycle;
      const matchesICP = icp === 'All' || m.icp_fit === icp;
      const matchesAE = ae === 'All' || m.ae_email === ae;
      
      return matchesSearch && matchesLifecycle && matchesICP && matchesAE;
    });
    
    renderMerchants();
  }

  // Handle search
  function handleSearch(value) {
    applyFilters();
  }

  // Populate AE filter
  function populateAEFilter() {
    const aes = [...new Set(STATE.merchants.map(m => m.ae_email))].filter(Boolean).sort();
    const select = document.getElementById('ae-filter');
    select.innerHTML = '<option value="All">All AEs</option>' + 
      aes.map(ae => `<option value="${ae}">${ae.split('@')[0]}</option>`).join('');
  }

  // Update ICP
  async function updateICP(id, icp) {
    try {
      await DB.updateMerchant(id, { icp_fit: icp });
      console.log('ICP updated');
    } catch (err) {
      console.error('Error updating ICP:', err);
      alert('Failed to update ICP');
    }
  }

  // Toggle approval
  async function toggleApproval(id) {
    try {
      const merchant = STATE.merchants.find(m => m.id === id);
      await DB.updateMerchant(id, { approved: !merchant.approved });
    } catch (err) {
      console.error('Error toggling approval:', err);
      alert('Failed to update approval');
    }
  }

  // Mark as asked
  async function markAsked(id) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await DB.updateMerchant(id, { asked_date: today });
    } catch (err) {
      console.error('Error marking as asked:', err);
      alert('Failed to update');
    }
  }

  // Mark merchant yes
  async function markYes(id) {
    try {
      await DB.updateMerchant(id, { merchant_yes: true });
    } catch (err) {
      console.error('Error marking yes:', err);
      alert('Failed to update');
    }
  }

  // Generate email
  function generateEmail(id) {
    const merchant = STATE.merchants.find(m => m.id === id);
    if (!merchant) return;
    
    STATE.selectedMerchant = merchant;
    
    const template = STATE.templates[STATE.currentTab];
    if (!template) {
      alert('Template not found');
      return;
    }
    
    const firstName = (merchant.contact_name || '').split(' ')[0] || 'there';
    const partnerName = STATE.partnerConfig.partner_name;
    
    let subject = template.subject || '';
    let body = template.body || '';
    
    // Replace variables
    const replacements = {
      '{merchant_name}': merchant.name,
      '{first_name}': firstName,
      '{partner_name}': partnerName,
      '{partner_rep}': '[Partner Rep Name]',
      '{partner_focus}': '[partner focus area]',
      '{partner_solution}': '[what partner solves]',
      '{shipinsure_rep}': '[ShipInsure Rep]',
      '{partner_value_prop}': '[Partner value proposition]'
    };
    
    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replaceAll(key, value);
      body = body.replaceAll(key, value);
    });
    
    document.getElementById('email-subject').textContent = subject;
    document.getElementById('email-body').textContent = body;
    document.getElementById('email-modal').style.display = 'flex';
  }

  // Copy email to clipboard
  function copyEmail() {
    const subject = document.getElementById('email-subject').textContent;
    const body = document.getElementById('email-body').textContent;
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    
    navigator.clipboard.writeText(fullEmail).then(() => {
      alert('Email copied to clipboard!');
    });
  }

  // Copy and mark as sent
  async function copyAndMarkSent() {
    copyEmail();
    
    if (STATE.selectedMerchant) {
      try {
        const today = new Date().toISOString().split('T')[0];
        await DB.updateMerchant(STATE.selectedMerchant.id, { emailed_date: today });
        closeModal('email-modal');
      } catch (err) {
        console.error('Error marking as emailed:', err);
      }
    }
  }

  // Show add modal
  function showAddModal() {
    // Clear form
    document.getElementById('new-name').value = '';
    document.getElementById('new-url').value = '';
    document.getElementById('new-contact-name').value = '';
    document.getElementById('new-contact-title').value = '';
    document.getElementById('new-contact-email').value = '';
    document.getElementById('new-lifecycle').value = 'In Deal Cycle';
    document.getElementById('new-icp').value = 'Not Sure';
    document.getElementById('new-ae').value = 'drew@shipinsure.io';
    document.getElementById('new-notes').value = '';
    
    document.getElementById('add-modal').style.display = 'flex';
  }

  // Add merchant
  async function addMerchant() {
    const name = document.getElementById('new-name').value.trim();
    const contactName = document.getElementById('new-contact-name').value.trim();
    
    if (!name || !contactName) {
      alert('Merchant name and contact name are required');
      return;
    }
    
    const merchant = {
      name,
      url: document.getElementById('new-url').value.trim(),
      lifecycle_stage: document.getElementById('new-lifecycle').value,
      contact_name: contactName,
      contact_title: document.getElementById('new-contact-title').value.trim(),
      contact_email: document.getElementById('new-contact-email').value.trim(),
      icp_fit: document.getElementById('new-icp').value,
      ae_email: document.getElementById('new-ae').value.trim(),
      notes: document.getElementById('new-notes').value.trim(),
      source_tab: STATE.currentTab,
      approved: false,
      asked_date: null,
      merchant_yes: false,
      emailed_date: null
    };
    
    try {
      await DB.addMerchant(merchant);
      closeModal('add-modal');
      loadMerchants();
    } catch (err) {
      console.error('Error adding merchant:', err);
      alert('Failed to add merchant');
    }
  }

  // Handle CSV upload
  async function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const merchants = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          
          return {
            name: values[0] || '',
            url: values[1] || '',
            lifecycle_stage: values[2] || 'In Deal Cycle',
            contact_name: values[3] || '',
            contact_title: values[4] || '',
            contact_email: values[5] || '',
            icp_fit: values[6] || 'Not Sure',
            ae_email: values[7] || 'drew@shipinsure.io',
            notes: values[8] || '',
            source_tab: STATE.currentTab,
            approved: false,
            asked_date: null,
            merchant_yes: false,
            emailed_date: null
          };
        })
        .filter(m => m.name && m.contact_name);
      
      if (merchants.length === 0) {
        alert('No valid merchants found in CSV');
        return;
      }
      
      await DB.bulkUpsertMerchants(merchants);
      alert(`Imported ${merchants.length} merchants successfully!`);
      loadMerchants();
    } catch (err) {
      console.error('Error importing CSV:', err);
      alert('Failed to import CSV');
    }
    
    event.target.value = ''; // Reset file input
  }

  // Export CSV
  function exportCSV() {
    const headers = ['Name', 'URL', 'Lifecycle', 'Contact Name', 'Contact Title', 'Contact Email', 'ICP Fit', 'AE', 'Notes'];
    const rows = STATE.filteredMerchants.map(m => [
      m.name,
      m.url || '',
      m.lifecycle_stage,
      m.contact_name || '',
      m.contact_title || '',
      m.contact_email || '',
      m.icp_fit,
      m.ae_email || '',
      m.notes || ''
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${STATE.currentTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  // Show branding modal
  function showBrandingModal() {
    document.getElementById('branding-name').value = STATE.partnerConfig.partner_name;
    document.getElementById('master-mode').checked = STATE.isMasterMode;
    document.getElementById('branding-modal').style.display = 'flex';
  }

  // Handle logo upload
  function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const logoUrl = e.target.result;
      document.getElementById('logo-preview-img').src = logoUrl;
      document.getElementById('logo-preview').style.display = 'block';
      STATE.partnerConfig.logo_base64 = logoUrl;
    };
    reader.readAsDataURL(file);
  }

  // Save branding
  async function saveBranding() {
    const partnerName = document.getElementById('branding-name').value.trim();
    
    if (!partnerName) {
      alert('Partner name is required');
      return;
    }
    
    try {
      const updates = {
        partner_name: partnerName
      };
      
      if (STATE.partnerConfig.logo_base64) {
        updates.logo_url = STATE.partnerConfig.logo_base64;
      }
      
      await DB.updatePartnerConfig(STATE.partnerConfig.partner_slug, updates);
      await loadPartnerConfig(STATE.partnerConfig.partner_slug);
      closeModal('branding-modal');
      alert('Branding saved!');
    } catch (err) {
      console.error('Error saving branding:', err);
      alert('Failed to save branding');
    }
  }

  // Toggle master mode
  function toggleMasterMode(enabled) {
    STATE.isMasterMode = enabled;
    document.getElementById('master-controls').style.display = enabled ? 'flex' : 'none';
    document.querySelectorAll('.master-only').forEach(el => {
      el.style.display = enabled ? '' : 'none';
    });
  }

  // Show template editor
  function showTemplateEditor() {
    // Load current templates into form
    if (STATE.templates['shipinsure-optin']) {
      document.getElementById('template-optin-subject').value = STATE.templates['shipinsure-optin'].subject || '';
      document.getElementById('template-optin-body').value = STATE.templates['shipinsure-optin'].body || '';
    }
    
    if (STATE.templates['partner-wishlist']) {
      document.getElementById('template-partner-subject').value = STATE.templates['partner-wishlist'].subject || '';
      document.getElementById('template-partner-body').value = STATE.templates['partner-wishlist'].body || '';
    }
    
    if (STATE.templates['shipinsure-wishlist']) {
      document.getElementById('template-shipinsure-subject').value = STATE.templates['shipinsure-wishlist'].subject || '';
      document.getElementById('template-shipinsure-body').value = STATE.templates['shipinsure-wishlist'].body || '';
    }
    
    document.getElementById('template-modal').style.display = 'flex';
  }

  // Save templates
  async function saveTemplates() {
    try {
      await DB.updateTemplate('shipinsure-optin', {
        subject: document.getElementById('template-optin-subject').value,
        body: document.getElementById('template-optin-body').value
      });
      
      await DB.updateTemplate('partner-wishlist', {
        subject: document.getElementById('template-partner-subject').value,
        body: document.getElementById('template-partner-body').value
      });
      
      await DB.updateTemplate('shipinsure-wishlist', {
        subject: document.getElementById('template-shipinsure-subject').value,
        body: document.getElementById('template-shipinsure-body').value
      });
      
      await loadTemplates();
      closeModal('template-modal');
      alert('Templates saved!');
    } catch (err) {
      console.error('Error saving templates:', err);
      alert('Failed to save templates');
    }
  }

  // Close modal
  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }

  // Expose public API
  window.APP = {
    init,
    switchTab,
    handleSearch,
    applyFilters,
    updateICP,
    toggleApproval,
    markAsked,
    markYes,
    generateEmail,
    copyEmail,
    copyAndMarkSent,
    showAddModal,
    addMerchant,
    handleCSVUpload,
    exportCSV,
    showBrandingModal,
    handleLogoUpload,
    saveBranding,
    toggleMasterMode,
    showTemplateEditor,
    saveTemplates,
    closeModal
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
