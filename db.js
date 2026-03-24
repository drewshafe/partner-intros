// Database layer - Supabase client and all DB operations
// Partner Intros - v2 (optin claim/unclaim, disqualifications, AE spiffs)

const DB = (function() {
  'use strict';

  const supabaseUrl = 'https://yquqoutrnqtietntxhan.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdXFvdXRybnF0aWV0bnR4aGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjg1NDEsImV4cCI6MjA4ODg0NDU0MX0.qMKkxYtrOHQt7Wr2Iq2NYdxP0cuQNGabcoq3RPrtWyM';
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // ── PARTNER CONFIG ──────────────────────────────────────────────────────────

  async function getPartnerConfig(slug) {
    const { data, error } = await supabase
      .from('partner_config')
      .select('*')
      .eq('partner_slug', slug)
      .single();
    if (error) { console.error('Error fetching partner config:', error); return null; }
    return data;
  }

  async function getAllPartnerConfigs() {
    const { data, error } = await supabase
      .from('partner_config')
      .select('*')
      .order('partner_name');
    if (error) throw error;
    return data || [];
  }

  async function createPartnerConfig(config) {
    const { data, error } = await supabase
      .from('partner_config')
      .insert([config])
      .select();
    if (error) throw error;
    return data[0];
  }

  async function updatePartnerConfig(slug, updates) {
    const { error } = await supabase
      .from('partner_config')
      .update(updates)
      .eq('partner_slug', slug);
    if (error) throw error;
  }

  // ── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

  async function getTemplate(tab) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('tab', tab)
      .single();
    if (error) { console.error('Error fetching template:', error); return { subject: '', body: '' }; }
    return data;
  }

  async function updateTemplate(tab, updates) {
    const { error } = await supabase
      .from('email_templates')
      .upsert({ tab, ...updates }, { onConflict: 'tab' });
    if (error) throw error;
  }

  // ── MERCHANTS ───────────────────────────────────────────────────────────────

  async function getMerchants(tab) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('source_tab', tab)
      .order('name');
    if (error) { console.error('Error fetching merchants:', error); return []; }
    return data || [];
  }

  async function addMerchant(merchant) {
    const { data, error } = await supabase
      .from('merchants')
      .insert([merchant])
      .select();
    if (error) throw error;
    return data;
  }

  async function updateMerchant(id, updates) {
    const { error } = await supabase
      .from('merchants')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  async function batchUpdateMerchants(updates) {
    const promises = updates.map(({ id, fields }) =>
      supabase.from('merchants').update(fields).eq('id', id)
    );
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) { console.error('Batch update errors:', errors); throw new Error('Some updates failed'); }
    return results;
  }

  async function deleteMerchant(id) {
    const { error } = await supabase.from('merchants').delete().eq('id', id);
    if (error) throw error;
  }

  async function bulkUpsertMerchants(merchants) {
    const { data, error } = await supabase
      .from('merchants')
      .upsert(merchants, { onConflict: 'name,contact_email', ignoreDuplicates: false });
    if (error) throw error;
    return data;
  }

  // Claim an optin merchant for a partner — removes it from the shared pool
  async function claimMerchantForPartner(merchantId, partnerSlug) {
    const { error } = await supabase
      .from('merchants')
      .update({ claimed_by_partner: partnerSlug, claimed_at: new Date().toISOString() })
      .eq('id', merchantId);
    if (error) throw error;
  }

  // Unclaim a merchant — restores it to the shared optin pool
  async function unclaimMerchant(merchantId) {
    const { error } = await supabase
      .from('merchants')
      .update({ claimed_by_partner: null, claimed_at: null })
      .eq('id', merchantId);
    if (error) throw error;
  }

  async function getStats(tab) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('source_tab', tab);
    if (error) { console.error('Error fetching stats:', error); return { total: 0, approved: 0, asked: 0, yes_received: 0, emailed: 0 }; }
    const merchants = data || [];
    return {
      total: merchants.length,
      approved: merchants.filter(m => m.approved).length,
      asked: merchants.filter(m => m.asked_date).length,
      yes_received: merchants.filter(m => m.merchant_yes).length,
      emailed: merchants.filter(m => m.emailed_date).length
    };
  }

  async function clearTabData(tab) {
    const { error } = await supabase.from('merchants').delete().eq('source_tab', tab);
    if (error) throw error;
    return { deleted: 1 };
  }

  // ── PARTNER APPROVALS ───────────────────────────────────────────────────────

  async function getPartnerApprovals(partnerSlug) {
    const { data, error } = await supabase
      .from('partner_approvals')
      .select('merchant_id')
      .eq('partner_slug', partnerSlug);
    if (error) return [];
    return data.map(a => a.merchant_id);
  }

  async function addPartnerApproval(merchantId, partnerSlug) {
    const { error } = await supabase
      .from('partner_approvals')
      .insert([{ merchant_id: merchantId, partner_slug: partnerSlug }]);
    if (error) throw error;
  }

  // ── PARTNER DISQUALIFICATIONS ───────────────────────────────────────────────

  // Returns array of merchant_ids disqualified by this partner
  async function getPartnerDisqualifications(partnerSlug) {
    const { data, error } = await supabase
      .from('partner_disqualifications')
      .select('merchant_id')
      .eq('partner_slug', partnerSlug);
    if (error) { console.error('Error fetching disqualifications:', error); return []; }
    return data.map(d => d.merchant_id);
  }

  // Hides a merchant from one partner's Pre-Opted In view only
  async function addPartnerDisqualification(merchantId, partnerSlug, reason = null) {
    const { error } = await supabase
      .from('partner_disqualifications')
      .upsert(
        { merchant_id: merchantId, partner_slug: partnerSlug, reason },
        { onConflict: 'partner_slug,merchant_id' }
      );
    if (error) throw error;
  }

  // ── AE SPIFFS ───────────────────────────────────────────────────────────────

  async function getAESpiffs(partnerSlug) {
    let query = supabase
      .from('ae_spiffs')
      .select('*')
      .order('created_at', { ascending: false });
    if (partnerSlug) query = query.eq('partner_slug', partnerSlug);
    const { data, error } = await query;
    if (error) { console.error('Error fetching spiffs:', error); return []; }
    return data || [];
  }

  async function addAESpiff(spiff) {
    const { data, error } = await supabase
      .from('ae_spiffs')
      .insert([spiff])
      .select();
    if (error) throw error;
    return data[0];
  }

  async function deleteAESpiff(id) {
    const { error } = await supabase.from('ae_spiffs').delete().eq('id', id);
    if (error) throw error;
  }

  // ── REAL-TIME ───────────────────────────────────────────────────────────────

  function subscribeMerchants(tab, callback) {
    const channel = supabase
      .channel(`merchants-${tab}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'merchants',
        filter: `source_tab=eq.${tab}`
      }, callback)
      .subscribe();
    return channel;
  }

  function unsubscribe(channel) {
    if (channel) supabase.removeChannel(channel);
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────────────

  return {
    getPartnerConfig,
    getAllPartnerConfigs,
    createPartnerConfig,
    updatePartnerConfig,
    getTemplate,
    updateTemplate,
    getMerchants,
    addMerchant,
    updateMerchant,
    batchUpdateMerchants,
    deleteMerchant,
    bulkUpsertMerchants,
    claimMerchantForPartner,
    unclaimMerchant,
    getPartnerApprovals,
    addPartnerApproval,
    getPartnerDisqualifications,
    addPartnerDisqualification,
    getStats,
    clearTabData,
    getAESpiffs,
    addAESpiff,
    deleteAESpiff,
    subscribeMerchants,
    unsubscribe
  };
})();
