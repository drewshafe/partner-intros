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
    selectedMerchant: null,
    csvImport: null,
    csvMapping: {},
    sortColumn: 'name',
    sortDirection: 'asc'
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

    tbody.innerHTML = STATE.filteredMerchants.map(m => {
      const siOptinBadge = m.notes && m.notes.includes('[SI Pre Opt-In]') ? 
        '<span class="badge badge-purple" style="margin-left: 8px; font-size: 10px;">SI Pre Opt-In</span>' : '';
      
      return `
      <tr data-id="${m.id}">
        <td>
          <a href="${m.url || '#'}" target="_blank" class="merchant-link">${m.name}</a>${siOptinBadge}
        </td>
        <td>
          <div class="contact-name">${m.contact_name || '-'}</div>
          <div class="contact-title">${m.contact_title || ''}</div>
        </td>
        <td>
          ${canEditLifecycle(m) ? `
            <select class="lifecycle-select" onchange="APP.updateLifecycle('${m.id}', this.value)">
              ${getLifecycleOptions(m)}
            </select>
          ` : `
            <span class="badge badge-${getBadgeClass(m.lifecycle_stage)}">${m.lifecycle_stage}</span>
          `}
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
          ${shouldShowApproveButton() ? `
            <button class="btn-small ${m.approved ? 'btn-success' : 'btn-outline'}" onclick="APP.toggleApproval('${m.id}')">
              ${m.approved ? 'Approved' : 'Approve'}
            </button>
          ` : '-'}
        </td>
        <td>
          ${getActionButtons(m)}
        </td>
      </tr>
      `;
    }).join('');
  }

  // Get action buttons based on workflow state
  function getActionButtons(merchant) {
    const tab = STATE.currentTab;
    const isMaster = STATE.isMasterMode;
    
    // Reset button logic
    const showReset = isMaster || tab === 'shipinsure-wishlist';
    const resetBtn = showReset ? 
      `<button class="btn-small btn-outline" onclick="APP.resetWorkflow('${merchant.id}')" style="margin-left: 4px;">Reset</button>` : '';
    
    // ShipInsure Pre-Opted In (partner view): Only approve
    if (tab === 'shipinsure-optin' && !isMaster) {
      return `<button class="btn-small ${merchant.approved ? 'btn-success' : 'btn-outline'}" onclick="APP.toggleApproval('${merchant.id}')">
        ${merchant.approved ? 'Approved' : 'Approve'}
      </button>`;
    }
    
    // Partner Wish List (partner view): Only approve
    if (tab === 'partner-wishlist' && !isMaster) {
      return `<button class="btn-small ${merchant.approved ? 'btn-success' : 'btn-outline'}" onclick="APP.toggleApproval('${merchant.id}')">
        ${merchant.approved ? 'Approved' : 'Approve'}
      </button>`;
    }
    
    // ShipInsure Wish List (partner view): Full workflow, NO approve
    if (tab === 'shipinsure-wishlist' && !isMaster) {
      if (!merchant.asked_date) {
        return `<button class="btn-small btn-info" onclick="APP.markAsked('${merchant.id}')">Mark Asked</button>${resetBtn}`;
      }
      if (merchant.asked_date && !merchant.merchant_yes) {
        return `<button class="btn-small btn-warning" onclick="APP.markYes('${merchant.id}')">Got Yes</button>${resetBtn}`;
      }
      if (merchant.merchant_yes && !merchant.emailed_date) {
        return `<button class="btn-small btn-primary" onclick="APP.generateEmail('${merchant.id}')">📧 Email</button>${resetBtn}`;
      }
      return `<span class="workflow-complete">✓ Complete</span>${resetBtn}`;
    }
    
    // Master mode: Full workflow + approve
    if (!merchant.asked_date) {
      return `<button class="btn-small btn-info" onclick="APP.markAsked('${merchant.id}')">Mark Asked</button>${resetBtn}`;
    }
    if (merchant.asked_date && !merchant.merchant_yes) {
      return `<button class="btn-small btn-warning" onclick="APP.markYes('${merchant.id}')">Got Yes</button>${resetBtn}`;
    }
    if (merchant.merchant_yes && !merchant.emailed_date) {
      return `<button class="btn-small btn-primary" onclick="APP.generateEmail('${merchant.id}')">📧 Email</button>${resetBtn}`;
    }
    return `<span class="workflow-complete">✓ Complete</span>${resetBtn}`;
  }

  // Check if lifecycle can be edited
  function canEditLifecycle(merchant) {
    const tab = STATE.currentTab;
    const isMaster = STATE.isMasterMode;
    
    // Master can edit everywhere
    if (isMaster) return true;
    
    // Partner can edit on ShipInsure Wish List only
    if (tab === 'shipinsure-wishlist') return true;
    
    return false;
  }

  // Get lifecycle options based on context
  function getLifecycleOptions(merchant) {
    const tab = STATE.currentTab;
    const stage = merchant.lifecycle_stage;
    
    // ShipInsure Wish List: Partner-focused options
    if (tab === 'shipinsure-wishlist' && !STATE.isMasterMode) {
      return `
        <option ${stage === 'In Deal Cycle' ? 'selected' : ''}>In Deal Cycle</option>
        <option ${stage === 'Customer' ? 'selected' : ''}>Customer</option>
        <option ${stage === 'Churned' ? 'selected' : ''}>Churned</option>
      `;
    }
    
    // Master mode: Full options
    return `
      <option ${stage === 'In Deal Cycle' ? 'selected' : ''}>In Deal Cycle</option>
      <option ${stage === 'Churned' ? 'selected' : ''}>Churned</option>
      <option ${stage === 'Live ShipInsure Customer' ? 'selected' : ''}>Live ShipInsure Customer</option>
      <option ${stage === 'Live EcoCart Customer' ? 'selected' : ''}>Live EcoCart Customer</option>
    `;
  }

  // Get badge class for lifecycle
  function getBadgeClass(lifecycle) {
    const map = {
      'Live ShipInsure Customer': 'success',
      'Live EcoCart Customer': 'success',
      'In Deal Cycle': 'info',
      'Churned': 'secondary'
    };
    return map[lifecycle] || 'secondary';
  }

  // Check if approve button should show
  function shouldShowApproveButton() {
    const tab = STATE.currentTab;
    const isMaster = STATE.isMasterMode;
    
    // Master sees approve everywhere
    if (isMaster) return true;
    
    // Partner does NOT see approve on ShipInsure Wish List
    if (tab === 'shipinsure-wishlist') return false;
    
    // Partner sees approve on other tabs
    return true;
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
    
    // Control Add Merchant button visibility
    const addBtn = document.getElementById('add-merchant-btn');
    if (addBtn) {
      // Hide on shipinsure-optin for partners
      const showAdd = STATE.isMasterMode || tab !== 'shipinsure-optin';
      addBtn.style.display = showAdd ? 'inline-flex' : 'none';
    }
    
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
    
    // Apply sorting
    sortMerchants();
    
    renderMerchants();
  }

  // Sort merchants
  function sortMerchants() {
    const { sortColumn, sortDirection } = STATE;
    
    STATE.filteredMerchants.sort((a, b) => {
      let aVal = a[sortColumn] || '';
      let bVal = b[sortColumn] || '';
      
      // Handle string comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    updateSortIndicators();
  }

  // Sort by column
  function sortBy(column) {
    if (STATE.sortColumn === column) {
      // Toggle direction
      STATE.sortDirection = STATE.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to asc
      STATE.sortColumn = column;
      STATE.sortDirection = 'asc';
    }
    
    applyFilters();
  }

  // Update sort indicators
  function updateSortIndicators() {
    // Clear all indicators
    document.querySelectorAll('.sort-indicator').forEach(el => {
      el.textContent = '';
    });
    
    // Set active indicator
    const indicator = document.getElementById(`sort-${STATE.sortColumn}`);
    if (indicator) {
      indicator.textContent = STATE.sortDirection === 'asc' ? '↑' : '↓';
    }
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

  // Update lifecycle stage
  async function updateLifecycle(id, lifecycle) {
    try {
      await DB.updateMerchant(id, { lifecycle_stage: lifecycle });
      console.log('Lifecycle updated');
    } catch (err) {
      console.error('Error updating lifecycle:', err);
      alert('Failed to update lifecycle');
    }
  }

  // Reset workflow and approval to defaults
  async function resetWorkflow(id) {
    if (!confirm('Reset this merchant\'s workflow and approval status?')) {
      return;
    }
    
    try {
      await DB.updateMerchant(id, {
        approved: false,
        asked_date: null,
        merchant_yes: false,
        emailed_date: null
      });
      await loadMerchants();
    } catch (err) {
      console.error('Error resetting workflow:', err);
      alert('Failed to reset workflow');
    }
  }

  // Toggle approval
  async function toggleApproval(id) {
    try {
      const merchant = STATE.merchants.find(m => m.id === id);
      const tab = STATE.currentTab;
      const isMaster = STATE.isMasterMode;
      
      // Partner approving from ShipInsure Pre-Opted In: Copy to their wishlist
      if (!isMaster && tab === 'shipinsure-optin') {
        if (merchant.approved) {
          alert('Already approved and copied to your wish list');
          return;
        }
        
        // Create copy in partner wishlist
        const copy = {
          name: merchant.name,
          url: merchant.url,
          contact_name: merchant.contact_name,
          contact_title: merchant.contact_title,
          contact_email: merchant.contact_email,
          lifecycle_stage: merchant.lifecycle_stage,
          icp_fit: merchant.icp_fit,
          ae_email: merchant.ae_email,
          notes: `[SI Pre Opt-In] ${merchant.notes || ''}`.trim(),
          source_tab: 'partner-wishlist',
          approved: false,
          asked_date: null,
          merchant_yes: false,
          emailed_date: null
        };
        
        await DB.addMerchant(copy);
        
        // Mark original as approved
        await DB.updateMerchant(id, { approved: true });
        
        alert('✅ Merchant approved and added to your wish list!');
        await loadMerchants();
        return;
      }
      
      // Master or other tabs: Normal toggle
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
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        alert('CSV file is empty or invalid');
        return;
      }
      
      // Parse CSV (handle quoted fields)
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };
      
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(parseCSVLine);
      
      // Store parsed data
      STATE.csvImport = { headers, rows };
      
      // Show mapper modal
      showCSVMapper(headers);
      
    } catch (err) {
      console.error('Error reading CSV:', err);
      alert('Failed to read CSV file');
    }
    
    event.target.value = ''; // Reset file input
  }

  // Show CSV mapper modal
  function showCSVMapper(headers) {
    const fields = [
      { key: 'name', label: 'Company/Merchant Name', required: true },
      { key: 'contactName', label: 'Contact Name', required: false },
      { key: 'contactEmail', label: 'Contact Email', required: false },
      { key: 'contactTitle', label: 'Contact Title', required: false },
      { key: 'lifecycleStage', label: 'Lifecycle Stage', required: false },
      { key: 'icpFit', label: 'ICP Fit', required: false },
      { key: 'aeEmail', label: 'AE/Owner', required: false },
      { key: 'optinDate', label: 'Opt-in Date', required: false },
      { key: 'notes', label: 'Notes', required: false }
    ];
    
    // Auto-detect mappings
    const mapping = {};
    const headersLower = headers.map(h => h.toLowerCase().trim());
    
    fields.forEach(field => {
      const patterns = {
        name: ['company name', 'merchant name', 'company', 'merchant', 'ticket name', 'name'],
        contactName: ['contact name', 'contact', 'ticket name', 'name'],
        contactEmail: ['contact email', 'email'],
        contactTitle: ['contact title', 'title', 'job title'],
        lifecycleStage: ['lifecycle stage', 'lifecycle', 'stage', 'ticket status', 'status'],
        icpFit: ['icp fit', 'icp', 'fit'],
        aeEmail: ['ae owner', 'ae', 'owner', 'ticket owner', 'assigned to'],
        optinDate: ['opt-in date', 'optin date', 'create date', 'created', 'date'],
        notes: ['notes', 'description', 'comments']
      };
      
      const matchPatterns = patterns[field.key] || [];
      const found = headersLower.findIndex(h => 
        matchPatterns.some(p => h.includes(p) || p.includes(h))
      );
      
      if (found >= 0) mapping[field.key] = found;
    });
    
    STATE.csvMapping = mapping;
    
    // Render mapper
    const container = document.getElementById('csv-mapper-fields');
    container.innerHTML = fields.map(field => `
      <div class="mapper-row">
        <label>${field.label}${field.required ? ' *' : ''}</label>
        <select class="csv-field-select" data-field="${field.key}">
          <option value="">-- Skip --</option>
          ${headers.map((h, i) => `
            <option value="${i}" ${mapping[field.key] === i ? 'selected' : ''}>${h}</option>
          `).join('')}
        </select>
      </div>
    `).join('');
    
    // Add change listeners
    container.querySelectorAll('.csv-field-select').forEach(select => {
      select.addEventListener('change', () => {
        const field = select.dataset.field;
        STATE.csvMapping[field] = select.value === '' ? undefined : parseInt(select.value);
      });
    });
    
    document.getElementById('csv-mapper-modal').style.display = 'flex';
  }

  // Confirm CSV mapping and import
  async function confirmCSVMapping() {
    const { headers, rows } = STATE.csvImport;
    const mapping = STATE.csvMapping;
    
    // Validate required fields
    if (mapping.name === undefined && mapping.contactName === undefined) {
      alert('You must map either Company Name or Contact Name');
      return;
    }
    
    const merchants = [];
    
    for (const row of rows) {
      const getValue = (key) => {
        const idx = mapping[key];
        return idx !== undefined ? (row[idx] || '').trim() : '';
      };
      
      // Use company name, or fall back to contact name if no company
      const companyName = getValue('name') || getValue('contactName') || 'Unknown';
      const contactName = getValue('contactName') || getValue('name') || '';
      
      const merchant = {
        name: companyName,
        contact_name: contactName,
        contact_email: getValue('contactEmail'),
        contact_title: getValue('contactTitle'),
        lifecycle_stage: getValue('lifecycleStage') || 'In Deal Cycle',
        icp_fit: getValue('icpFit') || 'Not Sure',
        ae_email: getValue('aeEmail') || '',
        notes: getValue('notes'),
        source_tab: 'shipinsure-optin',
        approved: false,
        asked_date: getValue('optinDate') || null,
        merchant_yes: false,
        emailed_date: null,
        url: ''
      };
      
      if (merchant.name) merchants.push(merchant);
    }
    
    if (merchants.length === 0) {
      alert('No valid merchants found in CSV');
      return;
    }
    
    try {
      await DB.bulkUpsertMerchants(merchants);
      
      closeModal('csv-mapper-modal');
      alert(`Imported ${merchants.length} merchants successfully!`);
      
      // Reload list
      await loadMerchants();
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import: ' + err.message);
    }
  }

  // Clear all data (delete activity logs first, then merchants)
  async function clearAllData() {
    if (!confirm('⚠️ This will DELETE ALL merchants and activity logs from the current tab. This cannot be undone. Are you sure?')) {
      return;
    }
    
    try {
      const tabName = STATE.currentTab;
      const result = await DB.clearTabData(tabName);
      
      if (result.deleted === 0) {
        alert('No data to clear');
        return;
      }
      
      alert(`✅ Deleted ${result.deleted} merchants and their activity logs`);
      
      // Reload
      await loadMerchants();
      
    } catch (err) {
      console.error('Error clearing data:', err);
      alert('Failed to clear data: ' + err.message);
    }
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
    sortBy,
    updateICP,
    updateLifecycle,
    resetWorkflow,
    toggleApproval,
    markAsked,
    markYes,
    generateEmail,
    copyEmail,
    copyAndMarkSent,
    showAddModal,
    addMerchant,
    handleCSVUpload,
    confirmCSVMapping,
    clearAllData,
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
