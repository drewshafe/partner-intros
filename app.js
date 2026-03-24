// Partner Intros - app.js v2
// Changes: optin claim/unclaim, per-partner disqualification, from_optin tagging,
//          show_optin_list toggle, AE spiff tracking, partner settings modal

(function() {
  'use strict';

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
    partnerDisqualifications: [],
    pendingChanges: {},
    isCreatingNewPartner: false,
    newPartnerData: null,
    spiffs: [],
    selectedSpiff: null,
    emailPreviewMerchant: null
  };

  // ── INIT ────────────────────────────────────────────────────────────────────

  async function init() {
    console.log('Initializing Partner Intros app v2...');
    checkAuthentication();

    if (STATE.partnerConfig.partner_slug) {
      await loadPartnerConfig();
      await loadPartnerApprovals();
      await loadPartnerDisqualifications();
    } else {
      updateHeader();
    }

    await loadTemplates();
    await loadMerchants();
    subscribeToChanges();
    populateAEFilter();

    if (STATE.isMasterMode) {
      await populatePartnerSelector();
    }

    console.log('App initialized');
  }

  // ── AUTH ────────────────────────────────────────────────────────────────────

  function checkAuthentication() {
    const urlParams = new URLSearchParams(window.location.search);
    const masterPassword = urlParams.get('master');
    const partnerSlug = urlParams.get('partner');

    if (masterPassword === '4224') {
      STATE.isMasterMode = true;
      STATE.partnerConfig.partner_slug = '';
      return;
    }

    if (partnerSlug) {
      STATE.isMasterMode = false;
      STATE.partnerConfig.partner_slug = partnerSlug;

      const authKey = `partner_auth_${partnerSlug}`;
      const isAuthenticated = sessionStorage.getItem(authKey);

      if (!isAuthenticated) {
        const password = prompt(`Enter password for ${partnerSlug}:`);
        const expectedPassword = `${partnerSlug}2026`;
        if (password === expectedPassword) {
          sessionStorage.setItem(authKey, 'true');
        } else {
          alert('Invalid password');
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h1>Access Denied</h1></div>';
          throw new Error('Invalid partner password');
        }
      }

      document.getElementById('master-controls').style.display = 'none';
      document.querySelectorAll('.master-only').forEach(el => el.style.display = 'none');
      return;
    }

    const code = prompt('Enter master access code:');
    if (code === '4224') {
      window.location.href = '?master=4224';
    } else {
      alert('Invalid code');
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h1>Access Denied</h1></div>';
      throw new Error('Invalid authentication');
    }
  }

  // ── HEADER ──────────────────────────────────────────────────────────────────

  function updateHeader() {
    const partnerLogo = document.getElementById('partner-logo');
    const headerTitle = document.getElementById('header-title');
    if (STATE.isMasterMode && !STATE.partnerConfig.partner_slug) {
      partnerLogo.style.display = 'none';
      headerTitle.textContent = 'Admin Portal';
    } else if (STATE.partnerConfig.partner_slug) {
      if (STATE.partnerConfig.logo_url) {
        partnerLogo.src = STATE.partnerConfig.logo_url;
        partnerLogo.style.display = 'block';
      } else {
        partnerLogo.style.display = 'none';
      }
      headerTitle.textContent = 'Partner Portal';
    }
  }

  // ── PARTNER CONFIG ──────────────────────────────────────────────────────────

  async function loadPartnerConfig(slug) {
    if (!slug) slug = STATE.partnerConfig.partner_slug;
    if (!slug) return;

    try {
      const config = await DB.getPartnerConfig(slug);
      if (config) {
        STATE.partnerConfig = config;
        document.querySelector('#partner-wishlist-label').textContent = `${config.partner_name} Wish List`;
        updateHeader();

        // Control Pre-Opted In tab visibility based on show_optin_list flag
        // In partner mode: hide if false. In master mode: respect setting to show partner's experience.
        const optinTab = document.querySelector('[data-tab="shipinsure-optin"]');
        if (optinTab) {
          const show = config.show_optin_list !== false;
          optinTab.style.display = show ? '' : 'none';
          // If currently on optin tab and it's now hidden, switch to wishlist
          if (!show && STATE.currentTab === 'shipinsure-optin') {
            switchTab('partner-wishlist');
          }
        }

        // Show/hide spiffs tab based on whether spiff_config exists
        const spiffTab = document.querySelector('[data-tab="spiffs"]');
        if (spiffTab) {
          if (STATE.isMasterMode || config.spiff_config) {
            spiffTab.style.display = '';
          } else {
            spiffTab.style.display = 'none';
          }
        }
      }
    } catch (err) {
      console.error('Error loading partner config:', err);
    }
  }

  // ── PARTNER APPROVALS ───────────────────────────────────────────────────────

  async function loadPartnerApprovals() {
    if (!STATE.partnerConfig.partner_slug) { STATE.partnerApprovals = []; return; }
    try {
      STATE.partnerApprovals = await DB.getPartnerApprovals(STATE.partnerConfig.partner_slug);
    } catch (err) {
      console.error('Error loading partner approvals:', err);
      STATE.partnerApprovals = [];
    }
  }

  // ── PARTNER DISQUALIFICATIONS ───────────────────────────────────────────────

  async function loadPartnerDisqualifications() {
    if (!STATE.partnerConfig.partner_slug) { STATE.partnerDisqualifications = []; return; }
    try {
      STATE.partnerDisqualifications = await DB.getPartnerDisqualifications(STATE.partnerConfig.partner_slug);
    } catch (err) {
      console.error('Error loading disqualifications:', err);
      STATE.partnerDisqualifications = [];
    }
  }

  // ── PARTNER SELECTOR ────────────────────────────────────────────────────────

  async function populatePartnerSelector() {
    try {
      const partners = await DB.getAllPartnerConfigs();
      const select = document.getElementById('partner-selector');
      if (!select) return;

      select.innerHTML = '<option value="">-- Select Partner --</option>' +
        partners.map(p => `<option value="${p.partner_slug}">${p.partner_name}</option>`).join('') +
        '<option value="__create_new__">+ Create New Partner</option>';

      select.addEventListener('change', async (e) => {
        const slug = e.target.value;
        if (slug === '__create_new__') {
          showCreatePartnerModal();
          e.target.value = '';
          return;
        }
        if (slug) {
          STATE.partnerConfig.partner_slug = slug;
          await loadPartnerConfig(slug);
          await loadPartnerApprovals();
          await loadPartnerDisqualifications();
          await loadMerchants();
          updateSaveButtonVisibility();
          updatePartnerSettingsButton();
        } else {
          STATE.partnerConfig = { partner_slug: '', partner_name: 'Partner Name' };
          STATE.partnerApprovals = [];
          STATE.partnerDisqualifications = [];
          updateHeader();
          await loadMerchants();
          updateSaveButtonVisibility();
          updatePartnerSettingsButton();
          // Reset tab visibility
          document.querySelectorAll('.tab').forEach(t => t.style.display = '');
        }
      });
    } catch (err) {
      console.error('Error populating partner selector:', err);
    }
  }

  function updatePartnerSettingsButton() {
    const btn = document.getElementById('partner-settings-btn');
    if (!btn) return;
    btn.style.display = STATE.isMasterMode && STATE.partnerConfig.partner_slug ? 'inline-flex' : 'none';
  }

  // ── CREATE PARTNER ──────────────────────────────────────────────────────────

  function showCreatePartnerModal() {
    document.getElementById('new-partner-slug').value = '';
    document.getElementById('new-partner-name').value = '';
    document.getElementById('new-partner-logo').value = '';
    document.getElementById('create-partner-modal').style.display = 'flex';
  }

  function createNewPartner() {
    const slug = document.getElementById('new-partner-slug').value.trim();
    const name = document.getElementById('new-partner-name').value.trim();
    const logoUrl = document.getElementById('new-partner-logo').value.trim();
    if (!slug || !name) { alert('Partner slug and name are required'); return; }
    STATE.isCreatingNewPartner = true;
    STATE.newPartnerData = {
      partner_slug: slug,
      partner_name: name,
      logo_url: logoUrl || `https://drewshafe.github.io/partner-intros/${slug}.png`,
      show_optin_list: true,
      spiff_config: null
    };
    STATE.partnerConfig = STATE.newPartnerData;
    updateHeader();
    closeModal('create-partner-modal');
    updateSaveButtonVisibility();
    alert('New partner created locally. Click SAVE to persist.');
  }

  // ── PARTNER SETTINGS ────────────────────────────────────────────────────────

  function showPartnerSettingsModal() {
    const config = STATE.partnerConfig;
    if (!config.partner_slug) return;

    document.getElementById('settings-partner-name').textContent = config.partner_name;
    document.getElementById('settings-show-optin').checked = config.show_optin_list !== false;
    document.getElementById('settings-spiff-config').value =
      config.spiff_config ? JSON.stringify(config.spiff_config, null, 2) : '';

    document.getElementById('partner-settings-modal').style.display = 'flex';
  }

  async function savePartnerSettings() {
    const slug = STATE.partnerConfig.partner_slug;
    if (!slug) return;

    const showOptinList = document.getElementById('settings-show-optin').checked;
    const rawJson = document.getElementById('settings-spiff-config').value.trim();

    let spiffConfig = null;
    if (rawJson) {
      try {
        spiffConfig = JSON.parse(rawJson);
      } catch (e) {
        alert('Invalid JSON in spiff config. Please fix before saving.');
        return;
      }
    }

    try {
      await DB.updatePartnerConfig(slug, { show_optin_list: showOptinList, spiff_config: spiffConfig });
      STATE.partnerConfig.show_optin_list = showOptinList;
      STATE.partnerConfig.spiff_config = spiffConfig;

      // Update tab visibility live
      const optinTab = document.querySelector('[data-tab="shipinsure-optin"]');
      if (optinTab) optinTab.style.display = showOptinList ? '' : 'none';
      if (!showOptinList && STATE.currentTab === 'shipinsure-optin') switchTab('partner-wishlist');

      const spiffTab = document.querySelector('[data-tab="spiffs"]');
      if (spiffTab) spiffTab.style.display = (STATE.isMasterMode || spiffConfig) ? '' : 'none';

      closeModal('partner-settings-modal');
      alert('✅ Partner settings saved.');
    } catch (err) {
      console.error('Error saving partner settings:', err);
      alert('Failed to save settings: ' + err.message);
    }
  }

  // ── TEMPLATES ───────────────────────────────────────────────────────────────

  async function loadTemplates() {
    try {
      const [optin, partner, shipinsure] = await Promise.all([
        DB.getTemplate('shipinsure-optin'),
        DB.getTemplate('partner-wishlist'),
        DB.getTemplate('shipinsure-wishlist')
      ]);
      STATE.templates = {
        'shipinsure-optin': optin,
        'partner-wishlist': partner,
        'shipinsure-wishlist': shipinsure
      };
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  }

  // ── LOAD MERCHANTS ──────────────────────────────────────────────────────────

  async function loadMerchants() {
    try {
      document.getElementById('merchant-tbody').innerHTML =
        '<tr><td colspan="10" class="loading">Loading...</td></tr>';

      let merchants = await DB.getMerchants(STATE.currentTab);

      if (STATE.currentTab === 'shipinsure-optin') {
        // Filter out merchants claimed by any partner
        merchants = merchants.filter(m => !m.claimed_by_partner);

        // For partner-specific views, also filter disqualified + already approved
        if (STATE.partnerConfig.partner_slug) {
          merchants = merchants.filter(m => !STATE.partnerApprovals.includes(m.id));
          merchants = merchants.filter(m => !STATE.partnerDisqualifications.includes(m.id));
        }
      }

      if (STATE.currentTab === 'partner-wishlist' && STATE.partnerConfig.partner_slug) {
        merchants = merchants.filter(m => m.partner_slug === STATE.partnerConfig.partner_slug);
      }

      STATE.merchants = merchants;
      STATE.filteredMerchants = merchants;
      renderMerchants();
      updateStats();
    } catch (err) {
      console.error('Error loading merchants:', err);
      document.getElementById('merchant-tbody').innerHTML =
        '<tr><td colspan="10" class="error">Error loading merchants</td></tr>';
    }
  }

  // ── PENDING CHANGES ─────────────────────────────────────────────────────────

  function hasPendingChange(merchantId, field) {
    return STATE.pendingChanges[merchantId] && STATE.pendingChanges[merchantId][field] !== undefined;
  }

  function trackPendingChange(merchantId, field, value) {
    if (!STATE.isMasterMode) {
      updateMerchantField(merchantId, field, value, true);
      return;
    }
    if (!STATE.pendingChanges[merchantId]) STATE.pendingChanges[merchantId] = {};
    STATE.pendingChanges[merchantId][field] = value;
    updateSaveButtonVisibility();
    renderMerchants();
  }

  async function updateMerchantField(merchantId, field, value, setPartnerEdited = false) {
    try {
      const updates = { [field]: value };
      if (setPartnerEdited) updates.partner_edited = true;
      await DB.updateMerchant(merchantId, updates);
      await loadMerchants();
    } catch (err) {
      console.error('Error updating field:', err);
      alert('Failed to update');
    }
  }

  async function saveAllChanges() {
    if (Object.keys(STATE.pendingChanges).length === 0 && !STATE.isCreatingNewPartner) {
      alert('No pending changes to save');
      return;
    }
    try {
      if (STATE.isCreatingNewPartner && STATE.newPartnerData) {
        await DB.createPartnerConfig(STATE.newPartnerData);
        STATE.isCreatingNewPartner = false;
        STATE.newPartnerData = null;
        await populatePartnerSelector();
      }
      if (Object.keys(STATE.pendingChanges).length > 0) {
        const updates = Object.entries(STATE.pendingChanges).map(([id, fields]) => ({ id, fields }));
        await DB.batchUpdateMerchants(updates);
      }
      STATE.pendingChanges = {};
      updateSaveButtonVisibility();
      alert('✅ All changes saved successfully!');
      await loadMerchants();
    } catch (err) {
      console.error('Error saving changes:', err);
      alert('Failed to save changes: ' + err.message);
    }
  }

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

  // ── RENDER ──────────────────────────────────────────────────────────────────

  function renderMerchants() {
    const tbody = document.getElementById('merchant-tbody');
    if (STATE.filteredMerchants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty">No merchants found</td></tr>';
      return;
    }
    tbody.innerHTML = STATE.filteredMerchants.map(m => {
      const isApproved = STATE.partnerApprovals.includes(m.id);
      const partnerEditBadge = m.partner_edited && STATE.isMasterMode
        ? '<span class="badge badge-info" style="margin-left:8px;font-size:10px;">Partner Edit</span>'
        : '';
      return `<tr data-id="${m.id}">${renderMerchantColumns(m, isApproved, partnerEditBadge)}</tr>`;
    }).join('');
  }

  function renderMerchantColumns(m, isApproved, partnerEditBadge) {
    const tab = STATE.currentTab;
    const isMaster = STATE.isMasterMode;

    const fromOptinBadge = m.from_optin
      ? '<span class="badge badge-purple" style="margin-left:6px;font-size:10px;">From Pre-Opted In</span>'
      : '';

    const merchantCol = `
      <td ${hasPendingChange(m.id, 'name') ? 'style="background:#fff9c4;"' : ''}>
        ${m.url && m.url.trim()
          ? `<a href="${m.url}" target="_blank" class="merchant-link">${m.name}</a>`
          : `<span class="merchant-link">${m.name}</span>`
        }${partnerEditBadge}${tab === 'partner-wishlist' ? fromOptinBadge : ''}
      </td>`;

    const contactCol = `
      <td ${hasPendingChange(m.id, 'contact_name') || hasPendingChange(m.id, 'contact_title') ? 'style="background:#fff9c4;"' : ''}>
        <div class="contact-name">${m.contact_name || '-'}</div>
        <div class="contact-title">${m.contact_title || ''}</div>
      </td>`;

    if (tab === 'shipinsure-optin') {
      return `
        ${merchantCol}
        ${contactCol}
        <td ${hasPendingChange(m.id, 'lifecycle_stage') ? 'style="background:#fff9c4;"' : ''}>
          ${renderLifecycleSelect(m)}
        </td>
        <td class="master-only" ${hasPendingChange(m.id, 'ae_email') ? 'style="background:#fff9c4;"' : ''}>
          ${(m.ae_email || '').split('@')[0]}
        </td>
        <td>
          ${renderSharedActions(m, isApproved)}
          <button class="btn-small btn-outline" onclick="APP.showEditModal('${m.id}')" style="margin-left:4px;">✏️</button>
          <button class="btn-small btn-outline" onclick="APP.deleteMerchant('${m.id}')" style="margin-left:4px;color:#dc3545;">🗑️</button>
        </td>`;
    }

    if (tab === 'partner-wishlist') {
      return `
        ${merchantCol}
        ${contactCol}
        <td ${hasPendingChange(m.id, 'lifecycle_stage') ? 'style="background:#fff9c4;"' : ''}>
          ${renderLifecycleSelect(m)}
        </td>
        <td class="master-only" ${hasPendingChange(m.id, 'ae_email') ? 'style="background:#fff9c4;"' : ''}>
          ${(m.ae_email || '').split('@')[0]}
        </td>
        <td>${renderWorkflowIndicators(m, ['si_contact_yes', 'si_intro_sent'], 'SI')}</td>
        <td>${renderWorkflowIndicators(m, ['partner_replied','partner_booked','partner_met','partner_sent_gift','partner_in_onboarding','partner_closed_won','partner_closed_lost'], 'Partner')}</td>
        <td ${hasPendingChange(m.id, 'notes') ? 'style="background:#fff9c4;"' : ''}>
          <div style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.notes || ''}">${m.notes || '-'}</div>
          <button class="btn-small btn-outline" onclick="APP.showEditModal('${m.id}')" style="margin-top:4px;font-size:10px;">✏️ Edit</button>
          <button class="btn-small btn-outline" onclick="APP.deleteMerchant('${m.id}')" style="margin-top:4px;color:#dc3545;font-size:10px;">🗑️ Delete</button>
        </td>`;
    }

    if (tab === 'shipinsure-wishlist') {
      return `
        ${merchantCol}
        ${contactCol}
        <td ${hasPendingChange(m.id, 'lifecycle_stage') ? 'style="background:#fff9c4;"' : ''}>
          ${renderPartnerLifecycleSelect(m)}
        </td>
        <td ${hasPendingChange(m.id, 'partner_ae_email') ? 'style="background:#fff9c4;"' : ''}>
          ${(m.partner_ae_email || '-').split('@')[0]}
        </td>
        <td>${renderWorkflowIndicators(m, ['partner_contact_yes','partner_intro_sent'], 'Partner')}</td>
        <td>${renderWorkflowIndicators(m, ['si_booked','si_met','si_sent_gift','si_in_onboarding','si_closed_won','si_closed_lost'], 'SI')}</td>
        <td ${hasPendingChange(m.id, 'notes') ? 'style="background:#fff9c4;"' : ''}>
          <div style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.notes || ''}">${m.notes || '-'}</div>
          <button class="btn-small btn-outline" onclick="APP.showEditModal('${m.id}')" style="margin-top:4px;font-size:10px;">✏️ Edit</button>
          <button class="btn-small btn-outline" onclick="APP.deleteMerchant('${m.id}')" style="margin-top:4px;color:#dc3545;font-size:10px;">🗑️ Delete</button>
        </td>`;
    }

    return '';
  }

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
      </select>`;
  }

  function renderPartnerLifecycleSelect(m) {
    const pending = hasPendingChange(m.id, 'lifecycle_stage');
    const value = pending ? STATE.pendingChanges[m.id].lifecycle_stage : m.lifecycle_stage;
    const partnerName = STATE.partnerConfig.partner_name || 'Partner';
    return `
      <select class="lifecycle-select" onchange="APP.updateLifecycle('${m.id}', this.value)">
        <option ${value === 'In Deal Cycle' ? 'selected' : ''}>In Deal Cycle</option>
        <option ${value === 'Churned' ? 'selected' : ''}>Churned</option>
        <option ${value === `Live ${partnerName} Customer` ? 'selected' : ''}>Live ${partnerName} Customer</option>
      </select>`;
  }

  function renderWorkflowIndicators(merchant, fields, actorLabel) {
    const labels = {
      si_contact_yes: 'Contact "Yes"', si_intro_sent: 'Intro Sent',
      partner_replied: 'Replied', partner_booked: 'Booked', partner_met: 'Met',
      partner_sent_gift: 'Sent $', partner_in_onboarding: 'In Onboarding',
      partner_closed_won: 'Closed Won', partner_closed_lost: 'Closed Lost',
      partner_contact_yes: 'Contact "Yes"', partner_intro_sent: 'Intro Sent',
      si_booked: 'Booked', si_met: 'Met', si_sent_gift: 'Sent $',
      si_in_onboarding: 'In Onboarding', si_closed_won: 'Closed Won', si_closed_lost: 'Closed Lost'
    };
    return `
      <div class="workflow-indicators">
        ${fields.map(field => {
          const active = merchant[field] || false;
          const pending = hasPendingChange(merchant.id, field);
          return `
            <div class="workflow-step ${active ? 'active' : ''}"
                 style="cursor:pointer;${pending ? 'background:#fff9c4;' : ''}"
                 onclick="APP.toggleWorkflowStep('${merchant.id}', '${field}')">
              ${active ? '✓' : '○'} ${labels[field]}
            </div>`;
        }).join('')}
      </div>`;
  }

  // Shared actions for Pre-Opted In tab
  function renderSharedActions(merchant, isApproved) {
    const partnerSlug = STATE.partnerConfig.partner_slug;
    if (!partnerSlug && STATE.isMasterMode) {
      // Master with no partner selected — show read-only info
      return merchant.claimed_by_partner
        ? `<span class="badge badge-warning">Claimed by ${merchant.claimed_by_partner}</span>`
        : '<span class="badge badge-secondary">In Pool</span>';
    }
    return `
      <button class="btn-small ${isApproved ? 'btn-success' : 'btn-outline'}"
              onclick="APP.toggleApproval('${merchant.id}')">
        ${isApproved ? '✓ Approved' : 'Approve →'}
      </button>
      <button class="btn-small btn-outline"
              onclick="APP.disqualifyMerchant('${merchant.id}')"
              style="margin-left:4px;color:#856404;"
              title="Hide from your list only">
        ✕ Not a Fit
      </button>`;
  }

  function getBadgeClass(lifecycle) {
    const map = {
      'Live ShipInsure Customer': 'success', 'Live EcoCart Customer': 'success',
      'In Deal Cycle': 'info', 'Churned': 'secondary'
    };
    return map[lifecycle] || 'secondary';
  }

  // ── OPTIN CLAIM FLOW ────────────────────────────────────────────────────────

  async function toggleApproval(id) {
    const partnerSlug = STATE.partnerConfig.partner_slug;
    if (!partnerSlug) { alert('Select a partner first'); return; }

    try {
      const merchant = STATE.merchants.find(m => m.id === id);
      if (!merchant) return;

      const isApproved = STATE.partnerApprovals.includes(id);
      if (isApproved) { alert('Already approved for this partner'); return; }

      // 1. Record in partner_approvals
      await DB.addPartnerApproval(id, partnerSlug);

      // 2. Create wish-list copy tagged as from_optin
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
        partner_slug: partnerSlug,
        approved: true,
        from_optin: true,
        origin_merchant_id: id,
        partner_status: null,
        asked_date: null,
        merchant_yes: false,
        emailed_date: null
      };
      await DB.addMerchant(copy);

      // 3. Claim original — removes it from all partners' Pre-Opted In views
      await DB.claimMerchantForPartner(id, partnerSlug);

      alert(`✅ ${merchant.name} approved and added to ${STATE.partnerConfig.partner_name} Wish List.`);
      await loadPartnerApprovals();
      await loadMerchants();
    } catch (err) {
      console.error('Error approving merchant:', err);
      alert('Failed to approve: ' + err.message);
    }
  }

  // Hides merchant from THIS partner's Pre-Opted In view only
  async function disqualifyMerchant(id) {
    const partnerSlug = STATE.partnerConfig.partner_slug;
    if (!partnerSlug) { alert('Select a partner first'); return; }

    if (!confirm('Hide this merchant from your Pre-Opted In list? It stays visible to other partners.')) return;

    try {
      await DB.addPartnerDisqualification(id, partnerSlug);
      STATE.partnerDisqualifications = await DB.getPartnerDisqualifications(partnerSlug);
      await loadMerchants();
    } catch (err) {
      console.error('Error disqualifying merchant:', err);
      alert('Failed to disqualify: ' + err.message);
    }
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────

  async function deleteMerchant(id) {
    const merchant = STATE.merchants.find(m => m.id === id);
    if (!merchant) return;
    if (!confirm(`Delete "${merchant.name}"? This cannot be undone.`)) return;

    try {
      // If this wish-list entry came from Pre-Opted In, restore the original to the pool
      if (merchant.from_optin && merchant.origin_merchant_id) {
        await DB.unclaimMerchant(merchant.origin_merchant_id);
      }
      await DB.deleteMerchant(id);
      alert('✅ Merchant deleted');
      await loadMerchants();
    } catch (err) {
      console.error('Error deleting merchant:', err);
      alert('Failed to delete: ' + err.message);
    }
  }

  // ── STATS ───────────────────────────────────────────────────────────────────

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

  // ── TAB SWITCHING ────────────────────────────────────────────────────────────

  function switchTab(tab) {
    STATE.currentTab = tab;

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    const spiffsPanel = document.getElementById('spiffs-panel');
    const mainContent = document.getElementById('main-content');

    if (tab === 'spiffs') {
      if (spiffsPanel) spiffsPanel.style.display = 'block';
      if (mainContent) mainContent.style.display = 'none';
      loadSpiffs();
      return;
    }

    if (spiffsPanel) spiffsPanel.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';

    const partnerName = STATE.partnerConfig.partner_name || 'Partner';
    const titles = {
      'shipinsure-optin': 'ShipInsure Pre-Opted In',
      'partner-wishlist': `${partnerName} Wish List`,
      'shipinsure-wishlist': 'ShipInsure Wish List'
    };
    const descriptions = {
      'shipinsure-optin': 'Merchants opted in for partner introductions. Approving a merchant moves it to your Wish List.',
      'partner-wishlist': `Merchants ${partnerName} wants ShipInsure to introduce`,
      'shipinsure-wishlist': `Merchants ShipInsure wants ${partnerName} to introduce`
    };

    document.getElementById('tab-title').textContent = titles[tab] || tab;
    document.getElementById('tab-description').textContent = descriptions[tab] || '';

    document.getElementById('search-input').value = '';
    document.getElementById('lifecycle-filter').value = 'All';
    document.getElementById('ae-filter').value = 'All';

    loadMerchants();
    subscribeToChanges();
  }

  // ── REAL-TIME ────────────────────────────────────────────────────────────────

  function subscribeToChanges() {
    if (STATE.realtimeChannel) DB.unsubscribe(STATE.realtimeChannel);
    STATE.realtimeChannel = DB.subscribeMerchants(STATE.currentTab, (payload) => {
      if (!STATE.isMasterMode || payload.new?.partner_edited) loadMerchants();
    });
  }

  // ── FILTERS / SORT ───────────────────────────────────────────────────────────

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

  function sortMerchants() {
    const { sortColumn, sortDirection } = STATE;
    STATE.filteredMerchants.sort((a, b) => {
      let aVal = (a[sortColumn] || '').toString().toLowerCase();
      let bVal = (b[sortColumn] || '').toString().toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    updateSortIndicators();
  }

  function sortBy(column) {
    STATE.sortDirection = STATE.sortColumn === column && STATE.sortDirection === 'asc' ? 'desc' : 'asc';
    STATE.sortColumn = column;
    applyFilters();
  }

  function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(`sort-${STATE.sortColumn}`);
    if (indicator) indicator.textContent = STATE.sortDirection === 'asc' ? '↑' : '↓';
  }

  function handleSearch() { applyFilters(); }

  function populateAEFilter() {
    const aes = [...new Set(STATE.merchants.map(m => m.ae_email))].filter(Boolean).sort();
    const select = document.getElementById('ae-filter');
    select.innerHTML = '<option value="All">All AEs</option>' +
      aes.map(ae => `<option value="${ae}">${ae.split('@')[0]}</option>`).join('');
  }

  function updateLifecycle(id, lifecycle) { trackPendingChange(id, 'lifecycle_stage', lifecycle); }

  function toggleWorkflowStep(id, field) {
    const merchant = STATE.merchants.find(m => m.id === id);
    if (!merchant) return;
    trackPendingChange(id, field, !merchant[field]);
  }

  // ── ADD / EDIT MERCHANT ──────────────────────────────────────────────────────

  function showAddModal() {
    ['new-name','new-url','new-contact-name','new-contact-title','new-contact-email','new-notes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('new-lifecycle').value = 'In Deal Cycle';
    document.getElementById('new-ae').value = 'drew@shipinsure.io';
    document.getElementById('add-modal').style.display = 'flex';
  }

  async function addMerchant() {
    const name = document.getElementById('new-name').value.trim();
    if (!name) { alert('Merchant name is required'); return; }

    const merchant = {
      name,
      url: document.getElementById('new-url').value.trim(),
      lifecycle_stage: document.getElementById('new-lifecycle').value,
      contact_name: document.getElementById('new-contact-name').value.trim() || null,
      contact_title: document.getElementById('new-contact-title').value.trim() || null,
      contact_email: document.getElementById('new-contact-email').value.trim() || null,
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

  function showEditModal(id) {
    const merchant = STATE.merchants.find(m => m.id === id);
    if (!merchant) return;
    STATE.selectedMerchant = merchant;
    document.getElementById('edit-name').value = merchant.name || '';
    document.getElementById('edit-url').value = merchant.url || '';
    document.getElementById('edit-contact-name').value = merchant.contact_name || '';
    document.getElementById('edit-contact-title').value = merchant.contact_title || '';
    document.getElementById('edit-lifecycle').value = merchant.lifecycle_stage || 'In Deal Cycle';
    document.getElementById('edit-notes').value = merchant.notes || '';
    document.getElementById('edit-modal').style.display = 'flex';
  }

  async function saveEditMerchant() {
    if (!STATE.selectedMerchant) return;
    const name = document.getElementById('edit-name').value.trim();
    if (!name) { alert('Merchant name is required'); return; }

    const updates = {
      name,
      url: document.getElementById('edit-url').value.trim(),
      contact_name: document.getElementById('edit-contact-name').value.trim() || null,
      contact_title: document.getElementById('edit-contact-title').value.trim() || null,
      lifecycle_stage: document.getElementById('edit-lifecycle').value,
      notes: document.getElementById('edit-notes').value.trim()
    };

    try {
      await DB.updateMerchant(STATE.selectedMerchant.id, updates);
      closeModal('edit-modal');
      alert('✅ Merchant updated');
      await loadMerchants();
    } catch (err) {
      console.error('Error updating merchant:', err);
      alert('Failed to update merchant');
    }
  }

  // ── EMAIL PREVIEW ────────────────────────────────────────────────────────────

  function showEmailModal(merchantId) {
    const merchant = STATE.merchants.find(m => m.id === merchantId);
    if (!merchant) return;
    STATE.emailPreviewMerchant = merchant;

    const template = STATE.templates[STATE.currentTab] || { subject: '', body: '' };
    const subject = (template.subject || '').replace(/\{merchant\}/g, merchant.name);
    const body = (template.body || '').replace(/\{merchant\}/g, merchant.name);

    document.getElementById('email-subject').textContent = subject;
    document.getElementById('email-body').textContent = body;
    document.getElementById('email-modal').style.display = 'flex';
  }

  async function copyAndMarkSent() {
    const merchant = STATE.emailPreviewMerchant;
    if (!merchant) return;
    const template = STATE.templates[STATE.currentTab] || { subject: '', body: '' };
    const text = `Subject: ${template.subject}\n\n${template.body}`.replace(/\{merchant\}/g, merchant.name);
    try {
      await navigator.clipboard.writeText(text);
      await DB.updateMerchant(merchant.id, { emailed_date: new Date().toISOString().split('T')[0] });
      closeModal('email-modal');
      alert('✅ Email copied and marked as sent');
      await loadMerchants();
    } catch (err) {
      console.error('Error in copyAndMarkSent:', err);
    }
  }

  async function copyEmail() {
    const merchant = STATE.emailPreviewMerchant;
    if (!merchant) return;
    const template = STATE.templates[STATE.currentTab] || { subject: '', body: '' };
    const text = `Subject: ${template.subject}\n\n${template.body}`.replace(/\{merchant\}/g, merchant.name);
    try {
      await navigator.clipboard.writeText(text);
      closeModal('email-modal');
    } catch (err) {
      console.error('Error copying email:', err);
    }
  }

  // ── SPIFFS ───────────────────────────────────────────────────────────────────

  async function loadSpiffs() {
    const slug = STATE.partnerConfig.partner_slug;
    try {
      STATE.spiffs = await DB.getAESpiffs(slug || null);
      renderSpiffs();
    } catch (err) {
      console.error('Error loading spiffs:', err);
    }
  }

  function renderSpiffs() {
    const panel = document.getElementById('spiffs-panel');
    if (!panel) return;

    const config = STATE.partnerConfig.spiff_config || null;
    const partnerName = STATE.partnerConfig.partner_name || 'Partner';
    const spiffs = STATE.spiffs;

    panel.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="font-size:20px;margin-bottom:4px;">💰 AE Spiff Tracker — ${partnerName}</h2>
            <p style="color:#7f8c8d;font-size:14px;">Log gift card / spiff payouts sent to AEs after qualified demos or closed deals</p>
          </div>
          ${STATE.isMasterMode ? `<button class="btn-primary" onclick="APP.showLogSpiffModal()">+ Log Spiff</button>` : ''}
        </div>

        ${config ? `
          <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:20px;">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#2c3e50;">Current Offer Terms</h3>
            ${renderSpiffConfigSummary(config)}
            ${renderVolumeBonusProgress(config, spiffs)}
          </div>
        ` : STATE.isMasterMode ? `
          <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px;margin-bottom:20px;font-size:13px;color:#856404;">
            No spiff program configured for this partner. Use ⚙️ Partner Settings to add one.
          </div>
        ` : ''}

        <div style="background:#fff;border-radius:8px;border:1px solid #e0e0e0;overflow:hidden;">
          <div style="padding:12px 16px;background:#f8f9fa;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:13px;">Spiff Log</strong>
            <span style="font-size:12px;color:#7f8c8d;">${spiffs.length} total · $${spiffs.reduce((s,x) => s + Number(x.spiff_amount||0), 0).toLocaleString()} paid out</span>
          </div>
          ${spiffs.length === 0
            ? '<div style="padding:32px;text-align:center;color:#7f8c8d;font-size:13px;">No spiffs logged yet</div>'
            : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead style="background:#f8f9fa;">
                  <tr>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Merchant</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">AE</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Trigger</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Type</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Amount</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Gift Card</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Sent</th>
                    <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Notes</th>
                    ${STATE.isMasterMode ? '<th style="padding:10px 12px;border-bottom:1px solid #dee2e6;"></th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${spiffs.map(s => `
                    <tr style="border-bottom:1px solid #f0f0f0;">
                      <td style="padding:10px 12px;font-weight:500;">${s.merchant_name}</td>
                      <td style="padding:10px 12px;">
                        <div>${s.ae_name || '-'}</div>
                        <div style="font-size:11px;color:#7f8c8d;">${s.ae_email || ''}</div>
                      </td>
                      <td style="padding:10px 12px;">
                        <span class="badge badge-${s.trigger_event === 'demo_met' ? 'info' : 'success'}">
                          ${s.trigger_event === 'demo_met' ? 'Demo Met' : 'Closed Won'}
                        </span>
                      </td>
                      <td style="padding:10px 12px;">
                        <span class="badge badge-secondary" style="font-size:10px;">
                          ${s.spiff_type === 'per_intro' ? 'Per Intro' : s.spiff_type === 'volume_bonus' ? 'Volume Bonus' : 'Target Merchant'}
                        </span>
                      </td>
                      <td style="padding:10px 12px;font-weight:600;color:#28a745;">$${Number(s.spiff_amount).toLocaleString()}</td>
                      <td style="padding:10px 12px;">
                        ${s.gift_card_type || '-'}
                        ${s.gift_card_code ? `<div style="font-size:10px;color:#7f8c8d;font-family:monospace;">${s.gift_card_code}</div>` : ''}
                      </td>
                      <td style="padding:10px 12px;">${s.sent_date || '-'}</td>
                      <td style="padding:10px 12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.notes||''}">${s.notes || '-'}</td>
                      ${STATE.isMasterMode ? `<td style="padding:10px 12px;"><button class="btn-small btn-outline" style="color:#dc3545;font-size:11px;" onclick="APP.deleteSpiff('${s.id}')">✕</button></td>` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>`;
  }

  function renderSpiffConfigSummary(config) {
    if (!config) return '<p style="color:#7f8c8d;font-size:13px;">No program configured.</p>';
    let html = '<div style="font-size:13px;">';

    if (config.per_intro_amount) {
      html += `<div style="margin-bottom:8px;"><strong>Per Qualified Intro:</strong> $${config.per_intro_amount}`;
      if (config.merchant_portion || config.rep_portion) {
        html += ` <span style="color:#7f8c8d;">($${config.merchant_portion} to merchant / $${config.rep_portion} to AE)</span>`;
      }
      html += '</div>';
    }

    if (config.trigger) {
      html += `<div style="margin-bottom:8px;"><strong>Trigger:</strong> ${config.trigger === 'demo_met' ? 'Demo Met' : 'Closed Won'}</div>`;
    }

    if (config.gift_card_type) {
      html += `<div style="margin-bottom:8px;"><strong>Gift Card Type:</strong> ${config.gift_card_type}</div>`;
    }

    if (config.expiry) {
      html += `<div style="margin-bottom:8px;"><strong>Offer Expires:</strong> ${config.expiry}</div>`;
    }

    if (config.target_merchants && config.target_merchants.length) {
      html += `<div style="margin-bottom:8px;"><strong>Target Merchants:</strong> ${config.target_merchants.join(', ')}</div>`;
    }

    if (config.volume_bonuses && config.volume_bonuses.length) {
      html += `<div style="margin-bottom:4px;"><strong>Volume Bonuses:</strong></div>`;
      config.volume_bonuses.forEach(b => {
        html += `<div style="margin-left:12px;margin-bottom:4px;color:#495057;">• ${b.threshold} intros in ${b.period} → +$${b.bonus} bonus (stacks)</div>`;
      });
    }

    html += '</div>';
    return html;
  }

  function renderVolumeBonusProgress(config, spiffs) {
    if (!config || !config.volume_bonuses || !config.volume_bonuses.length) return '';
    let html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e0e0e0;">';
    html += '<strong style="font-size:13px;">Volume Bonus Progress</strong>';

    config.volume_bonuses.forEach(b => {
      const count = spiffs.filter(s => s.sent_date && s.sent_date.substring(0, 7) === b.period).length;
      const pct = Math.min(100, Math.round((count / b.threshold) * 100));
      const unlocked = count >= b.threshold;
      html += `
        <div style="margin-top:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
            <span><strong>${b.period}:</strong> ${count} / ${b.threshold} intros for +$${b.bonus} bonus</span>
            <span style="font-weight:600;color:${unlocked ? '#28a745' : '#495057'};">${unlocked ? '✅ UNLOCKED' : `${b.threshold - count} to go`}</span>
          </div>
          <div style="background:#e0e0e0;border-radius:4px;height:8px;">
            <div style="background:${unlocked ? '#28a745' : '#3498db'};height:8px;border-radius:4px;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>`;
    });

    html += '</div>';
    return html;
  }

  function showLogSpiffModal() {
    if (!STATE.isMasterMode) return;
    const config = STATE.partnerConfig.spiff_config;

    document.getElementById('spiff-merchant-name').value = '';
    document.getElementById('spiff-ae-name').value = '';
    document.getElementById('spiff-ae-email').value = '';
    document.getElementById('spiff-trigger').value = 'demo_met';
    document.getElementById('spiff-type').value = 'per_intro';
    document.getElementById('spiff-amount').value = config ? (config.per_intro_amount || '') : '';
    document.getElementById('spiff-gift-card-type').value = config ? (config.gift_card_type || 'Amazon') : 'Amazon';
    document.getElementById('spiff-gift-card-code').value = '';
    document.getElementById('spiff-sent-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('spiff-notes').value = '';

    document.getElementById('log-spiff-modal').style.display = 'flex';
  }

  async function logSpiff() {
    const partnerSlug = STATE.partnerConfig.partner_slug;
    if (!partnerSlug) { alert('Select a partner first'); return; }

    const merchantName = document.getElementById('spiff-merchant-name').value.trim();
    const amount = parseFloat(document.getElementById('spiff-amount').value);

    if (!merchantName) { alert('Merchant name is required'); return; }
    if (isNaN(amount) || amount <= 0) { alert('Enter a valid spiff amount'); return; }

    const spiff = {
      partner_slug: partnerSlug,
      merchant_name: merchantName,
      ae_name: document.getElementById('spiff-ae-name').value.trim() || null,
      ae_email: document.getElementById('spiff-ae-email').value.trim() || null,
      trigger_event: document.getElementById('spiff-trigger').value,
      spiff_type: document.getElementById('spiff-type').value,
      spiff_amount: amount,
      gift_card_type: document.getElementById('spiff-gift-card-type').value || null,
      gift_card_code: document.getElementById('spiff-gift-card-code').value.trim() || null,
      sent_date: document.getElementById('spiff-sent-date').value || null,
      notes: document.getElementById('spiff-notes').value.trim() || null,
      created_by: 'drew@shipinsure.io'
    };

    try {
      await DB.addAESpiff(spiff);
      closeModal('log-spiff-modal');
      alert('✅ Spiff logged');
      await loadSpiffs();
    } catch (err) {
      console.error('Error logging spiff:', err);
      alert('Failed to log spiff: ' + err.message);
    }
  }

  async function deleteSpiff(id) {
    if (!confirm('Delete this spiff record?')) return;
    try {
      await DB.deleteAESpiff(id);
      await loadSpiffs();
    } catch (err) {
      console.error('Error deleting spiff:', err);
      alert('Failed to delete spiff: ' + err.message);
    }
  }

  // ── MODAL UTILS ──────────────────────────────────────────────────────────────

  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

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
    showEditModal,
    saveEditMerchant,
    saveAllChanges,
    createNewPartner,
    closeModal,
    showEmailModal,
    copyAndMarkSent,
    copyEmail,
    showPartnerSettingsModal,
    savePartnerSettings,
    showLogSpiffModal,
    logSpiff,
    deleteSpiff,
    STATE
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
