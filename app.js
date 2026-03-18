PARTNER INTROS - DEPLOYMENT SUMMARY
=====================================

## CHANGES IMPLEMENTED

### 1. MASTER PASSWORD PROTECTION (4224)
- Admin URL: https://drewshafe.github.io/partner-intros/?master=4224
- Without correct password → access denied or defaults to partner mode
- Partner URLs: https://drewshafe.github.io/partner-intros/?partner=passport
- Partners CANNOT access admin by removing URL param

### 2. PARTNER SELECTOR IN ADMIN
- Dropdown in master controls shows all 12 partners
- Admin can switch between partner contexts while keeping full permissions
- Updates partner branding, logo, and filters data by selected partner_slug
- Calls DB.getAllPartnerConfigs() to populate dropdown

### 3. IMMEDIATE UI UPDATES (NO PAGE REFRESH)
All action functions now call `await loadMerchants()` after database updates:
- updateICP() - ICP dropdown changes
- updateLifecycle() - Lifecycle dropdown changes
- updatePartnerStatus() - Partner status dropdown changes
- disqualifyMerchant() - Disqualify button
- resetWorkflow() - Reset button
- toggleApproval() - Approve button
- markAsked() - Mark Asked button
- markYes() - Got Yes button
- copyAndMarkSent() - Copy & mark sent button

Changes now appear INSTANTLY without manual page refresh.

### 4. PARTNER WISH LIST WORKFLOW
- Partners see only their approved leads on Partner Wish List
- ICP dropdown is now editable on Partner Wish List
- Partner status dropdown replaces workflow indicators:
  * Intro Made
  * Prospect = Yes
  * Prospect = No
  * Meeting Scheduled
  * Demo Met
  * Gift Card Sent
- No action buttons in Actions column (dropdown handles everything)

### 5. PRE-OPTED IN WORKFLOW (PARTNER VIEW)
- Partners see ICP dropdown (editable)
- Partners see Approve button (copies to their wishlist with SI Pre Opt-In badge)
- Partners see Disqualify button (marks as ICP 3 Not a Fit)
- Approved merchants disappear from partner's Pre-Opted In view

## DEPLOYMENT STEPS

### Step 1: Update Supabase
Run this SQL in Supabase SQL Editor (if not already done):
```sql
ALTER TABLE merchants ADD COLUMN partner_status TEXT;
CREATE INDEX idx_merchants_partner_status ON merchants(partner_status);
```

### Step 2: Update db.js
Add the getAllPartnerConfigs() function from db-getAllPartnerConfigs.js:
```javascript
async getAllPartnerConfigs() {
  const { data, error } = await supabase
    .from('partner_config')
    .select('*')
    .order('partner_name');
  
  if (error) throw error;
  return data || [];
}
```

### Step 3: Update index.html
Replace the master-controls div with content from partner-selector-html.html
(Adds partner selector dropdown before existing buttons)

### Step 4: Upload app.js
Upload the new app.js to GitHub repo

### Step 5: Test
1. Test admin: https://drewshafe.github.io/partner-intros/?master=4224
2. Test partner selector dropdown switches between partners
3. Test partner view: https://drewshafe.github.io/partner-intros/?partner=passport
4. Verify immediate UI updates (no refresh needed after actions)
5. Verify approved merchants disappear from partner Pre-Opted In view

## FILES UPDATED
- app.js (full replacement)
- db.js (add getAllPartnerConfigs function)
- index.html (add partner selector to master-controls)
- add-partner-status.sql (already deployed earlier)

## ADMIN FEATURES (MASTER MODE ONLY)
✓ Partner selector dropdown
✓ Full access to all tabs and data
✓ Can edit ICP, lifecycle, workflow on all tabs
✓ Can view/edit branding and templates
✓ Can import CSV, clear data
✓ AE column visible

## PARTNER FEATURES (PARTNER MODE)
✓ Pre-Opted In: ICP dropdown, Approve button, Disqualify button
✓ Partner Wish List: ICP dropdown, Partner status dropdown
✓ ShipInsure Wish List: Lifecycle dropdown (limited options), standard workflow
✓ No AE column
✓ No master controls
✓ Data filtered by partner_slug

## SECURITY
- Master password hardcoded: 4224
- Partners cannot access admin without password
- Each partner only sees their own wishlist data
- Approved merchants isolated by partner_slug

## URLS
Master: ?master=4224
Partner examples:
- ?partner=passport
- ?partner=digital-genius
- ?partner=gorgias
(etc. for all 12 partners)
