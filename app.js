// Partner Intros - Simplified workflow with Save button
// Master admin has pending changes with Save button
// Partner changes auto-sync

(function() {
  'use strict';

  // Global state
  const STATE = {
    currentTab: 'shipinsure-optin',
    merchants: [],
    filteredMerchants: [],
    templates: {},
    partnerConfig: { partner_slug: '', partner_name: 'Partner Name' },
    isMasterMode: true,
    realtimeChannel: null,
    selectedMerchant: null,
    csvImport: null,
    csvMapping: {},
    sortColumn: 'name',
    sortDirection: 'asc',
    partnerApprovals: [],
    pendingChanges: {}, // { merchantId: { field: value } }
    isCreatingNewPartner: false,
    newPartnerData: null
  };

  // Initialize app
  async function init() {
    console.log('Initializing Partner Intros app...');
    
    // Check authentication
    checkAuthentication();
    
    // Load partner config (only if slug is set)
    if (STATE.partnerConfig.partner_slug) {
      await loadPartnerConfig();
      await loadPartnerApprovals();
    } else {
      // Master mode with no partner selected - update header
      updateHeader();
    }
    
    // Load templates
    await loadTemplates();
    
    // Load merchants for current tab
    await loadMerchants();
    
    // Set up real-time subscription
    subscribeToChanges();
    
    // Populate AE filter
    populateAEFilter();
    
    // Populate partner selector
    if (STATE.isMasterMode) {
      await populatePartnerSelector();
    }
    
    console.log('App initialized');
  }

  // Check authentication and mode
  function checkAuthentication() {
    const urlParams = new URLSearchParams(window.location.search);
    const masterPassword = urlParams.get('master');
    const partnerSlug = urlParams.get('partner');
    
    // Master mode with password
    if (masterPassword === '4224') {
      STATE.isMasterMode = true;
      STATE.partnerConfig.partner_slug = ''; // Default to no partner selected
      return;
    }
    
    // Partner mode
    if (partnerSlug) {
      STATE.isMasterMode = false;
      STATE.partnerConfig.partner_slug = partnerSlug;
      
      // Check if already authenticated this session
      const authKey = `partner_auth_${partnerSlug}`;
      const isAuthenticated = sessionStorage.getItem(authKey);
      
      if (!isAuthenticated) {
        const password = prompt(`Enter password for ${partnerSlug}:`);
        const expectedPassword = `${partnerSlug}2026`;
        
        if (password === expectedPassword) {
          sessionStorage.setItem(authKey, 'true');
        } else {
          alert('Invalid password');
          document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;"><h1>Access Denied</h1><p>Invalid partner password</p></div>';
          throw new Error('Invalid partner password');
        }
      }
      
      document.getElementById('master-controls').style.display = 'none';
      document.querySelectorAll('.master-only').forEach(el => el.style.display = 'none');
      return;
    }
    
    // No params - prompt for master code
    const code = prompt('Enter master access code:');
    if (code === '4224') {
      window.location.href = '?master=4224';
    } else {
      alert('Invalid code');
      document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;"><h1>Access Denied</h1></div>';
      throw new Error('Invalid authentication');
    }
  }

  // Update header with logos and title
  function updateHeader() {
    const partnerLogo = document.getElementById('partner-logo');
    const headerTitle = document.getElementById('header-title');
    
    if (STATE.isMasterMode && !STATE.partnerConfig.partner_slug) {
      // Admin mode, no partner selected
      partnerLogo.style.display = 'none';
      headerTitle.textContent = 'Admin Portal';
    } else if (STATE.partnerConfig.partner_slug) {
      // Partner selected or partner mode
      if (STATE.partnerConfig.logo_url) {
        partnerLogo.src = STATE.partnerConfig.logo_url;
        partnerLogo.style.display = 'block';
      } else {
        partnerLogo.style.display = 'none';
      }
      headerTitle.textContent = 'Partner Portal';
    }
  }

  // Load partner configuration
  async function loadPartnerConfig(slug) {
    if (!slug) slug = STATE.partnerConfig.partner_slug;
    if (!slug) return;
    
    try {
      const config = await DB.getPartnerConfig(slug);
      if (config) {
        STATE.partnerConfig = config;
        document.querySelector('#partner-wishlist-label').textContent = `${config.partner_name} Wish List`;
        updateHeader();
      }
    } catch (err) {
      console.error('Error loading partner config:', err);
    }
  }

  // Load partner approvals
  async function loadPartnerApprovals() {
    if (!STATE.partnerConfig.partner_slug) {
      STATE.partnerApprovals = [];
      return;
    }
    
    try {
      STATE.partnerApprovals = await DB.getPartnerApprovals(STATE.partnerConfig.partner_slug);
    } catch (err) {
      console.error('Error loading partner approvals:', err);
      STATE.partnerApprovals = [];
    }
  }

  // Populate partner selector dropdown
  async function populatePartnerSelector() {
    try {
      const partners = await DB.getAllPartnerConfigs();
      const select = document.getElementById('partner-selector');
      
      if (!select) {
        console.warn('Partner selector not found in DOM');
        return;
      }
      
      select.innerHTML = '<option value="">-- Select Partner --</option>' +
        partners.map(p => `<option value="${p.partner_slug}">${p.partner_name}</option>`).join('') +
        '<option value="__create_new__">+ Create New Partner</option>';
      
      select.addEventListener('change', async (e) => {
        const slug = e.target.value;
        
        if (slug === '__create_new__') {
          showCreatePartnerModal();
          e.target.value = ''; // Reset to "Select Partner"
          return;
        }
        
        if (slug) {
          STATE.partnerConfig.partner_slug = slug;
          await loadPartnerConfig(slug);
          await loadPartnerApprovals();
          await loadMerchants();
          updateSaveButtonVisibility();
        } else {
          // Reset to no partner selected
          STATE.partnerConfig = { partner_slug: '', partner_name: 'Partner Name' };
          STATE.partnerApprovals = [];
          updateHeader();
          await loadMerchants();
          updateSaveButtonVisibility();
        }
      });
    } catch (err) {
      console.error('Error populating partner selector:', err);
    }
  }

  // Show create partner modal
  function showCreatePartnerModal() {
    document.getElementById('new-partner-slug').value = '';
    document.getElementById('new-partner-name').value = '';
    document.getElementById('new-partner-logo').value = '';
    document.getElementById('create-partner-modal').style.display = 'flex';
  }

  // Create new partner
  function createNewPartner() {
    const slug = document.getElementById('new-partner-slug').value.trim();
    const name = document.getElementById('new-partner-name').value.trim();
    const logoUrl = document.getElementById('new-partner-logo').value.trim();
    
    if (!slug || !name) {
      alert('Partner slug and name are required');
      return;
    }
    
    // Store in state (won't save until Save button clicked)
    STATE.isCreatingNewPartner = true;
    STATE.newPartnerData = {
      partner_slug: slug,
      partner_name: name,
      logo_url: logoUrl || `https://drewshafe.github.io/partner-intros/${slug}.png`
    };
    
    // Update UI
    STATE.partnerConfig = STATE.newPartnerData;
    updateHeader();
    
    closeModal('create-partner-modal');
    updateSaveButtonVisibility();
    
    alert('New partner created. Click SAVE to persist changes.');
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
      document.getElementById('merchant-tbody').innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';
      
      let merchants = await DB.getMerchants(STATE.currentTab);
      
      // Filter by partner_slug for partner views
      if (STATE.currentTab === 'partner-wishlist' && STATE.partnerConfig.partner_slug) {
        merchants = merchants.filter(m => m.partner_slug === STATE.partnerConfig.partner_slug);
      }
      
      // Hide merchants approved by THIS partner from Pre-Opted In view
      if (STATE.currentTab === 'shipinsure-optin' && STATE.partnerConfig.partner_slug) {
        merchants = merchants.filter(m => !STATE.partnerApprovals.includes(m.id));
      }
      
      STATE.merchants = merchants;
      STATE.filteredMerchants = merchants;
      
      renderMerchants();
      updateStats();
    } catch (err) {
      console.error('Error loading merchants:', err);
      document.getElementById('merchant-tbody').innerHTML = '<tr><td colspan="10" class="error">Error loading merchants</td></tr>';
    }
  }

  // Check if field has pending changes
  function hasPendingChange(merchantId, field) {
    return STATE.pendingChanges[merchantId] && STATE.pendingChanges[merchantId][field] !== undefined;
  }

  // Track pending change
  function trackPendingChange(merchantId, field, value) {
    if (!STATE.isMasterMode) {
      // Partner changes auto-save
      updateMerchantField(merchantId, field, value, true);
      return;
    }
    
    // Master mode: track for later save
    if (!STATE.pendingChanges[merchantId]) {
      STATE.pendingChanges[merchantId] = {};
    }
    STATE.pendingChanges[merchantId][field] = value;
    
    updateSaveButtonVisibility();
    renderMerchants(); // Re-render to show yellow highlighting
  }

  // Update merchant field immediately (for partner auto-save)
  async function updateMerchantField(merchantId, field, value, setPartnerEdited = false) {
    try {
      const updates = { [field]: value };
      if (setPartnerEdited) {
        updates.partner_edited = true;
      }
      
      await DB.updateMerchant(merchantId, updates);
      console.log('Field updated:', field, value);
      await loadMerchants();
    } catch (err) {
      console.error('Error updating field:', err);
      alert('Failed to update');
    }
  }

  // Save all pending changes
  async function saveAllChanges() {
    if (Object.keys(STATE.pendingChanges).length === 0 && !STATE.isCreatingNewPartner) {
      alert('No pending changes to save');
      return;
    }
    
    try {
      // Create new partner if needed
      if (STATE.isCreatingNewPartner && STATE.newPartnerData) {
        await DB.createPartnerConfig(STATE.newPartnerData);
        STATE.isCreatingNewPartner = false;
        STATE.newPartnerData = null;
        await populatePartnerSelector();
      }
      
      // Batch update merchants
      if (Object.keys(STATE.pendingChanges).length > 0) {
        const updates = Object.entries(STATE.pendingChanges).map(([id, fields]) => ({
          id,
          fields
        }));
        
        await DB.batchUpdateMerchants(updates);
      }
      
      // Clear pending changes
      STATE.pendingChanges = {};
      updateSaveButtonVisibility();
      
      alert('✅ All changes saved successfully!');
      await loadMerchants();
    } catch (err) {
      console.error('Error saving changes:', err);
      alert('Failed to save changes: ' + err.message);
    }
  }

  // Update Save button visibility and state
  function updateSaveButtonVisibility() {
    const saveBtn = document.getElementById('save-all-btn');
    if (!saveBtn) return;
    
    const hasPending = Object.keys(STATE.pendingChanges).length > 0 || STATE.isCreatingNewPartner;
    
    if (STATE.isMasterMode && STATE.partnerConfig.partner_slug) {
      saveBtn.style.display = 'inline-flex';
      saveBtn.disabled = !hasPending;
      saveBtn.style.opacity = hasPending ? '1' : '0.5';
    } else {
      saveBtn.style.display = 'none';
    }
  }

  // Render merchant table
  function renderMerchants() {
    const tbody = document.getElementById('merchant-tbody');
    
    if (STATE.filteredMerchants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty">No merchants found</td></tr>';
      return;
    }

    tbody.innerHTML = STATE.filteredMerchants.map(m => {
      const isApproved = STATE.partnerApprovals.includes(m.id);
      const partnerEditBadge = m.partner_edited && STATE.isMasterMode ? 
        '<span class="badge badge-info" style="margin-left: 8px; font-size: 10px;">Partner Edit</span>' : '';
      
      return `
      <tr data-id="${m.id}">
        ${renderMerchantColumns(m, isApproved, partnerEditBadge)}
      </tr>
      `;
    }).join('');
  }

  // Render merchant columns based on tab
  function renderMerchantColumns(m, isApproved, partnerEditBadge) {
    const tab = STATE.currentTab;
    const isMaster = STATE.isMasterMode;
    
    // Common columns
    const merchantCol = `
      <td ${hasPendingChange(m.id, 'name') ? 'style="background: #fff9c4;"' : ''}>
        <a href="${m.url || '#'}" target="_blank" class="merchant-link">${m.name}</a>${partnerEditBadge}
      </td>
    `;
    
    const contactCol = `
      <td ${hasPendingChange(m.id, 'contact_name') || hasPendingChange(m.id, 'contact_email') ? 'style="background: #fff9c4;"' : ''}>
        <div class="contact-name">${m.contact_name || '-'}</div>
        <div class="contact-email" style="font-size: 11px; color: #666;">${m.contact_email || ''}</div>
      </td>
    `;
    
    // Tab-specific columns
    if (tab === 'shipinsure-optin') {
      return `
        ${merchantCol}
        ${contactCol}
        <td ${hasPendingChange(m.id, 'lifecycle_stage') ? 'style="background: #fff9c4;"' : ''}>
          ${renderLifecycleSelect(m)}
        </td>
        <td class="master-only" ${hasPendingChange(m.id, 'ae_email') ? 'style="background: #fff9c4;"' : ''}>
          ${(m.ae_email || '').split('@')[0]}
        </td>
        <td>
          ${renderSharedActions(m, isApproved)}
          <button class="btn-small btn-outline" onclick="APP.deleteMerchant('${m.id}')" style="margin-left: 4px; color: #dc3545;">🗑️</button>
        </td>
      `;
    }
    
    if (tab === 'partner-wishlist') {
      return `
        ${merchantCol}
        ${contactCol}
        <td ${hasPendingChange(m.id, 'lifecycle_stage') ? 'style="background: #fff9c4;"' : ''}>
          ${renderLifecycleSelect(m)}
        </td>
        <td class="master-only" ${hasPendingChange(m.id, 'ae_email') ? 'style="background: #fff9c4;"' : ''}>
          ${(m.ae_email || '').split('@')[0]}
        </td>
        <td>
          ${renderWorkflowIndicators(m, ['si_contact_yes', 'si_intro_sent'], 'SI')}
        </td>
        <td>
          ${renderWorkflowIndicators(m, ['partner_replied', 'partner_booked', 'partner_met', 'partner_sent_gift', 'partner_in_onboarding', 'partner_closed_won', 'partner_closed_lost'], 'Partner')}
        </td>
        <td ${hasPendingChange(m.id, 'notes') ? 'style="background: #fff9c4;"' : ''}>
          <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.notes || ''}">${m.notes || '-'}</div>
          <button class="btn-small btn-outline" onclick="APP.deleteMerchant('${m.id}')" style="margin-top: 4px; color: #dc3545; font-size: 10px;">🗑️ Delete</button>
        </td>
      `;
    }
    
    if (tab === 'shipinsure-wishlist') {
      return `
        ${merchantCol}
        ${contactCol}
        <td ${hasPendingChange(m.id, 'lifecycle_stage') ? 'style="background: #fff9c4;"' : ''}>
          ${renderPartnerLifecycleSelect(m)}
        </td>
        <td ${hasPendingChange(m.id, 'partner_ae_email') ? 'style="background: #fff9c4;"' : ''}>
          ${(m.partner_ae_email || '-').split('@')[0]}
        </td>
        <td>
          ${renderWorkflowIndicators(m, ['partner_contact_yes', 'partner_intro_sent'], 'Partner')}
        </td>
        <td>
          ${renderWorkflowIndicators(m, ['si_booked', 'si_met', 'si_sent_gift', 'si_in_onboarding', 'si_closed_won', 'si_closed_lost'], 'SI')}
        </td>
        <td ${hasPendingChange(m.id, 'notes') ? 'style="background: #fff9c4;"' : ''}>
          <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.notes || ''}">${m.notes || '-'}</div>
          <button class="btn-small btn-outline" onclick="APP.deleteMerchant('${m.id}')" style="margin-top: 4px; color: #dc3545; font-size: 10px;">🗑️ Delete</button>
        </td>
      `;
    }
    
    return '';
  }

  // Render lifecycle select
  function renderLifecycleSelect(m) {
    if (!STATE.isMasterMode) {
      return `<span class="badge badge-${getBadgeClass(m.lifecycle_stage)}">${m.lifecycle_stage}</span>`;
    }
    
    const pending = hasPendingChange(m.id, 'lifecycle_stage');
    const value = pending ? STATE.pendingChanges[m.id].lifecycle_stage : m.lifecycle_stage;
    
    return `
      <select class="lifecycle-select" onchange="APP.updateLifecycle('${m.id}', this.value)">
        <option ${value === 'In Deal Cycle' ? 'selected' : ''}>In Deal Cycle</option>
        <option ${value === 'Churned' ? 'selected' : ''}>Churned</option>
        <option ${value === 'Live ShipInsure Customer' ? 'selected' : ''}>Live ShipInsure Customer</option>
        <option ${value === 'Live EcoCart Customer' ? 'selected' : ''}>Live EcoCart Customer</option>
      </select>
    `;
  }

  // Render partner lifecycle select (SI Wish List only)
  function renderPartnerLifecycleSelect(m) {
    const pending = hasPendingChange(m.id, 'lifecycle_stage');
    const value = pending ? STATE.pendingChanges[m.id].lifecycle_stage : m.lifecycle_stage;
    const partnerName = STATE.partnerConfig.partner_name || 'Partner';
    
    return `
      <select class="lifecycle-select" onchange="APP.updateLifecycle('${m.id}', this.value)">
        <option ${value === 'In Deal Cycle' ? 'selected' : ''}>In Deal Cycle</option>
        <option ${value === 'Churned' ? 'selected' : ''}>Churned</option>
        <option ${value === `Live ${partnerName} Customer` ? 'selected' : ''}>Live ${partnerName} Customer</option>
      </select>
    `;
  }

  // Render workflow indicators (sequential, clickable)
  function renderWorkflowIndicators(merchant, fields, actorLabel) {
    const labels = {
      si_contact_yes: 'Contact "Yes"',
      si_intro_sent: 'Intro Sent',
      partner_replied: 'Replied',
      partner_booked: 'Booked',
      partner_met: 'Met',
      partner_sent_gift: 'Sent $',
      partner_in_onboarding: 'In Onboarding',
      partner_closed_won: 'Closed Won',
      partner_closed_lost: 'Closed Lost',
      partner_contact_yes: 'Contact "Yes"',
      partner_intro_sent: 'Intro Sent',
      si_booked: 'Booked',
      si_met: 'Met',
      si_sent_gift: 'Sent $',
      si_in_onboarding: 'In Onboarding',
      si_closed_won: 'Closed Won',
      si_closed_lost: 'Closed Lost'
    };
    
    return `
      <div class="workflow-indicators">
        ${fields.map(field => {
          const active = merchant[field] || false;
          const pending = hasPendingChange(merchant.id, field);
          const bgStyle = pending ? 'background: #fff9c4;' : '';
          
          return `
            <div class="workflow-step ${active ? 'active' : ''}" 
                 style="cursor: pointer; ${bgStyle}" 
                 onclick="APP.toggleWorkflowStep('${merchant.id}', '${field}')">
              ${active ? '✓' : '○'} ${labels[field]}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Render shared actions (Approve, Disqualify)
  function renderSharedActions(merchant, isApproved) {
    return `
      <button class="btn-small ${isApproved ? 'btn-success' : 'btn-outline'}" 
              onclick="APP.toggleApproval('${merchant.id}')">
        ${isApproved ? 'Approved' : 'Approve'}
      </button>
      <button class="btn-small btn-outline" 
              onclick="APP.disqualifyMerchant('${merchant.id}')" 
              style="margin-left: 4px;">
        Disqualify
      </button>
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

  // Delete merchant
  async function deleteMerchant(id) {
    const merchant = STATE.merchants.find(m => m.id === id);
    if (!merchant) return;
    
    if (!confirm(`Delete "${merchant.name}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      await DB.deleteMerchant(id);
      alert('✅ Merchant deleted successfully');
      await loadMerchants();
    } catch (err) {
      console.error('Error deleting merchant:', err);
      alert('Failed to delete merchant: ' + err.message);
    }
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
    const partnerName = STATE.partnerConfig.partner_name || 'Partner';
    const titles = {
      'shipinsure-optin': 'ShipInsure Pre-Opted In',
      'partner-wishlist': `${partnerName} Wish List`,
      'shipinsure-wishlist': 'ShipInsure Wish List'
    };
    
    const descriptions = {
      'shipinsure-optin': 'Merchants already opted in for partner introductions',
      'partner-wishlist': `Merchants ${partnerName} wants ShipInsure to introduce`,
      'shipinsure-wishlist': `Merchants ShipInsure wants ${partnerName} to introduce`
    };
    
    document.getElementById('tab-title').textContent = titles[tab];
    document.getElementById('tab-description').textContent = descriptions[tab];
    
    // Reset filters
    document.getElementById('search-input').value = '';
    document.getElementById('lifecycle-filter').value = 'All';
    document.getElementById('ae-filter').value = 'All';
    
    // Load merchants for new tab
    loadMerchants();
    
    // Resubscribe to real-time
    subscribeToChanges();
  }

  // Subscribe to real-time changes
  function subscribeToChanges() {
    if (STATE.realtimeChannel) {
      DB.unsubscribe(STATE.realtimeChannel);
    }
    
    STATE.realtimeChannel = DB.subscribeMerchants(STATE.currentTab, (payload) => {
      console.log('Real-time update:', payload);
      
      // Only reload if change was made by partner (not by current admin)
      if (!STATE.isMasterMode || payload.new?.partner_edited) {
        loadMerchants();
      }
    });
  }

  // Apply filters
  function applyFilters() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const lifecycle = document.getElementById('lifecycle-filter').value;
    const ae = document.getElementById('ae-filter').value;
    
    STATE.filteredMerchants = STATE.merchants.filter(m => {
      const matchesSearch = !search || 
        m.name.toLowerCase().includes(search) || 
        (m.contact_name || '').toLowerCase().includes(search);
      
      const matchesLifecycle = lifecycle === 'All' || m.lifecycle_stage === lifecycle;
      const matchesAE = ae === 'All' || m.ae_email === ae;
      
      return matchesSearch && matchesLifecycle && matchesAE;
    });
    
    sortMerchants();
    renderMerchants();
  }

  // Sort merchants
  function sortMerchants() {
    const { sortColumn, sortDirection } = STATE;
    
    STATE.filteredMerchants.sort((a, b) => {
      let aVal = a[sortColumn] || '';
      let bVal = b[sortColumn] || '';
      
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
      STATE.sortDirection = STATE.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      STATE.sortColumn = column;
      STATE.sortDirection = 'asc';
    }
    
    applyFilters();
  }

  // Update sort indicators
  function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(el => {
      el.textContent = '';
    });
    
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

  // Update lifecycle stage
  function updateLifecycle(id, lifecycle) {
    trackPendingChange(id, 'lifecycle_stage', lifecycle);
  }

  // Toggle workflow step
  function toggleWorkflowStep(id, field) {
    const merchant = STATE.merchants.find(m => m.id === id);
    if (!merchant) return;
    
    const currentValue = merchant[field] || false;
    trackPendingChange(id, field, !currentValue);
  }

  // Disqualify merchant
  async function disqualifyMerchant(id) {
    if (!confirm('Disqualify this merchant? This will mark them as not a fit.')) {
      return;
    }
    
    if (STATE.isMasterMode) {
      trackPendingChange(id, 'approved', false);
    } else {
      await updateMerchantField(id, 'approved', false, true);
    }
  }

  // Toggle approval
  async function toggleApproval(id) {
    try {
      const merchant = STATE.merchants.find(m => m.id === id);
      const isApproved = STATE.partnerApprovals.includes(id);
      
      if (isApproved) {
        alert('Already approved for this partner');
        return;
      }
      
      // Add to partner_approvals table
      await DB.addPartnerApproval(id, STATE.partnerConfig.partner_slug);
      
      // Create copy in partner wishlist
      const copy = {
        name: merchant.name,
        url: merchant.url,
        contact_name: merchant.contact_name,
        contact_title: merchant.contact_title,
        contact_email: merchant.contact_email,
        lifecycle_stage: merchant.lifecycle_stage,
        ae_email: merchant.ae_email,
        notes: merchant.notes,
        source_tab: 'partner-wishlist',
        partner_slug: STATE.partnerConfig.partner_slug,
        approved: true,
        partner_status: null,
        asked_date: null,
        merchant_yes: false,
        emailed_date: null
      };
      
      await DB.addMerchant(copy);
      
      alert('✅ Merchant approved and added to partner wish list!');
      await loadPartnerApprovals();
      await loadMerchants();
    } catch (err) {
      console.error('Error toggling approval:', err);
      alert('Failed to update approval');
    }
  }

  // Show add modal
  function showAddModal() {
    document.getElementById('new-name').value = '';
    document.getElementById('new-url').value = '';
    document.getElementById('new-contact-name').value = '';
    document.getElementById('new-contact-title').value = '';
    document.getElementById('new-contact-email').value = '';
    document.getElementById('new-lifecycle').value = 'In Deal Cycle';
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
      ae_email: document.getElementById('new-ae').value.trim(),
      notes: document.getElementById('new-notes').value.trim(),
      source_tab: STATE.currentTab,
      approved: false,
      partner_status: null,
      asked_date: null,
      merchant_yes: false,
      emailed_date: null
    };
    
    if (STATE.currentTab === 'partner-wishlist') {
      merchant.partner_slug = STATE.partnerConfig.partner_slug;
    }
    
    try {
      await DB.addMerchant(merchant);
      closeModal('add-modal');
      loadMerchants();
    } catch (err) {
      console.error('Error adding merchant:', err);
      alert('Failed to add merchant');
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
    updateLifecycle,
    toggleWorkflowStep,
    disqualifyMerchant,
    toggleApproval,
    deleteMerchant,
    showAddModal,
    addMerchant,
    saveAllChanges,
    createNewPartner,
    closeModal,
    STATE // Expose STATE for table header script
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
