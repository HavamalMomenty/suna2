# Billing Removal Plan - Suna Application

## Overview
This document outlines the complete plan to remove all billing, payment, subscription, and Stripe-related functionality from the Suna application, making it completely free with unlimited access to all features.

To make the implementation easier, simply 1 give the free user tier all privaleges of the highest tier while 2. giving everyone the free tier 3. removing everything that allows the user to upgrade to a new tier. 

Lastly, it should also 


## Frontend Changes

### 1. Remove Billing Components
**Files to Delete:**
- [ ] `suna2/frontend/src/components/billing/account-billing-status.tsx`
- [ ] `suna2/frontend/src/components/billing/billing-modal.tsx`
- [ ] `suna2/frontend/src/components/billing/payment-required-dialog.tsx`
- [ ] `suna2/frontend/src/components/billing/usage-limit-alert.tsx`
- [ ] `suna2/frontend/src/components/payment/paywall-dialog.tsx`

### 2. Update Pricing Section
**File:** `suna2/frontend/src/components/home/sections/pricing-section.tsx`
**Changes Needed:**
- [ ] Remove entire pricing section or replace with "Free Forever" message
- [ ] Remove all Stripe integration code
- [ ] Remove plan selection logic
- [ ] Remove checkout session creation
- [ ] Remove subscription management

### 3. Update Configuration
**File:** `suna2/frontend/src/lib/config.ts`
**Changes Needed:**
- [ ] Remove `SUBSCRIPTION_TIERS` configuration
- [ ] Remove all Stripe price IDs
- [ ] Remove environment-specific tier logic
- [ ] Simplify to single "free" mode

### 4. Update Home Configuration
**File:** `suna2/frontend/src/lib/home.tsx`
**Changes Needed:**
- [ ] Remove `cloudPricingItems` array
- [ ] Remove all pricing tier definitions
- [ ] Remove Stripe price ID references
- [ ] Replace with simple "Free" tier or remove pricing entirely

### 5. Update API Client
**File:** `suna2/frontend/src/lib/api.ts`
**Changes Needed:**
- [ ] Remove all billing-related API calls:
  - [ ] `getSubscription()`
  - [ ] `createCheckoutSession()`
  - [ ] `createPortalSession()`
  - [ ] `getBillingStatus()`
- [ ] Remove `BillingError` class
- [ ] Remove subscription status types

### 6. Update Context Providers
**File:** `suna2/frontend/src/contexts/BillingContext.tsx`
**Changes Needed:**
- [ ] Remove entire file or simplify to always return "free" status
- [ ] Remove billing status checks
- [ ] Remove subscription management

### 7. Update Dashboard Components
**Files to Modify:**
- [ ] `suna2/frontend/src/components/dashboard/dashboard-content.tsx`
- [ ] `suna2/frontend/src/components/dashboard/layout-content.tsx`

**Changes Needed:**
- [ ] Remove billing error handling
- [ ] Remove usage limit alerts
- [ ] Remove subscription status displays
- [ ] Remove billing-related imports

### 8. Update Agent Components
**Files to Modify:**
- [ ] `suna2/frontend/src/components/agents/agent-preview.tsx`
- [ ] `suna2/frontend/src/components/agents/agent-builder-chat.tsx`

**Changes Needed:**
- [ ] Remove billing error handling
- [ ] Remove "upgrade plan" prompts
- [ ] Remove subscription checks

### 9. Update Thread Components
**Files to Modify:**
- [ ] `suna2/frontend/src/components/thread/agent-run-limit-dialog.tsx`
- [ ] Any other thread-related components with billing logic

**Changes Needed:**
- [ ] Remove agent run limit dialogs
- [ ] Remove usage limit checks
- [ ] Remove billing error displays

### 10. Update Hooks
**Files to Modify:**
- [ ] `suna2/frontend/src/hooks/useBillingError.ts`
- [ ] `suna2/frontend/src/hooks/react-query/threads/use-billing-status.ts`

**Changes Needed:**
- [ ] Remove billing error hooks
- [ ] Remove billing status queries
- [ ] Simplify to always return "free" status

### 11. Update App Providers
**File:** `suna2/frontend/src/app/providers.tsx`
**Changes Needed:**
- [ ] Remove `BillingProvider` from provider tree
- [ ] Remove billing context imports

### 12. Update Settings/Account Pages
**Files to Check:**
- [ ] Any settings pages with billing sections
- [ ] Account management pages
- [ ] Profile pages with subscription info

**Changes Needed:**
- [ ] Remove billing management sections
- [ ] Remove subscription status displays
- [ ] Remove payment method management

## Backend Changes

### 1. Remove Billing Service
**File:** `suna2/backend/services/billing.py`
**Action:** [ ] Delete entire file

### 2. Update API Routes
**File:** `suna2/backend/api.py`
**Changes Needed:**
- [ ] Remove billing router imports
- [ ] Remove billing route registrations
- [ ] Remove billing-related dependencies

### 3. Update Configuration
**File:** `suna2/backend/utils/config.py`
**Changes Needed:**
- [ ] Remove all Stripe-related configuration:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] All `STRIPE_TIER_*_ID` properties
  - [ ] `STRIPE_PRODUCT_ID` properties
- [ ] Remove Stripe API key initialization

### 4. Update Authentication/Authorization
**Files to Check:**
- [ ] Any auth middleware that checks subscription status
- [ ] User permission checks based on billing
- [ ] Model access restrictions

**Changes Needed:**
- [ ] Remove subscription-based access controls
- [ ] Remove billing status checks
- [ ] Allow all users access to all features

### 5. Update Agent Execution
**Files to Check:**
- [ ] Agent execution services
- [ ] Model selection logic
- [ ] Usage tracking

**Changes Needed:**
- [ ] Remove usage limit enforcement
- [ ] Remove billing status checks before agent execution
- [ ] Remove model access restrictions
- [ ] Remove usage tracking

### 6. Update Database Queries
**Files to Check:**
- [ ] Any services that query subscription data
- [ ] Usage tracking queries
- [ ] Billing-related database operations

**Changes Needed:**
- [ ] Remove subscription status queries
- [ ] Remove usage limit checks
- [ ] Remove billing customer lookups

### 7. Update Error Handling
**Files to Check:**
- [ ] Error handling middleware
- [ ] API response formatting

**Changes Needed:**
- [ ] Remove billing error types
- [ ] Remove subscription-related error responses
- [ ] Remove payment required errors

## Database Changes (Optional)

### 1. Remove Billing Tables
**Tables to Consider Removing:**
- [ ] `billing_customers`
- [ ] Any usage tracking tables
- [ ] Subscription status tables

**Note:** As per requirements, these can remain if they're not accessed by the application.

## Environment Configuration

### 1. Update Environment Variables
**Files to Check:**
- [ ] `.env` files
- [ ] Docker configurations
- [ ] Deployment scripts

**Changes Needed:**
- [ ] Remove Stripe API keys
- [ ] Remove billing-related environment variables
- [ ] Remove subscription tier configurations

## Testing & Validation

### 1. Test All User Flows
- [ ] Verify no billing prompts appear
- [ ] Verify all features are accessible
- [ ] Verify no subscription checks occur
- [ ] Verify no payment dialogs appear

### 2. Test API Endpoints
- [ ] Verify billing endpoints return 404 or are removed
- [ ] Verify no billing-related errors occur
- [ ] Verify all features work without subscription

### 3. Test Authentication
- [ ] Verify users can access all features without billing
- [ ] Verify no subscription status is required
- [ ] Verify no payment information is requested

## Implementation Priority

### Phase 1: Frontend Billing Removal
1. [ ] Remove billing components
2. [ ] Update pricing section
3. [ ] Remove billing context
4. [ ] Update dashboard components

### Phase 2: Backend Billing Removal
1. [ ] Remove billing service
2. [ ] Update API routes
3. [ ] Remove billing checks from agent execution
4. [ ] Update configuration

### Phase 3: Testing & Cleanup
1. [ ] Test all user flows
2. [ ] Remove unused imports
3. [ ] Clean up configuration files
4. [ ] Verify no billing references remain

## Files Summary

**Files to Delete:**
- [ ] All files in `suna2/frontend/src/components/billing/`
- [ ] `suna2/frontend/src/components/payment/paywall-dialog.tsx`
- [ ] `suna2/backend/services/billing.py`
- [ ] `suna2/frontend/src/contexts/BillingContext.tsx`
- [ ] `suna2/frontend/src/hooks/useBillingError.ts`
- [ ] `suna2/frontend/src/hooks/react-query/threads/use-billing-status.ts`

**Files to Modify:**
- [ ] `suna2/frontend/src/components/home/sections/pricing-section.tsx`
- [ ] `suna2/frontend/src/lib/config.ts`
- [ ] `suna2/frontend/src/lib/home.tsx`
- [ ] `suna2/frontend/src/lib/api.ts`
- [ ] `suna2/frontend/src/app/providers.tsx`
- [ ] `suna2/backend/api.py`
- [ ] `suna2/backend/utils/config.py`
- [ ] All dashboard and agent components
- [ ] All thread-related components

## Notes
- This plan ensures complete removal of all billing functionality while maintaining full application functionality for all users
- Database tables can remain as long as they're not accessed by the application
- Focus on removing all user-facing billing prompts and restrictions
- Ensure no subscription checks occur during normal application usage

## Status Tracking
- [ ] Phase 1 Complete
- [ ] Phase 2 Complete  
- [ ] Phase 3 Complete
- [ ] Final Testing Complete
- [ ] Deployment Ready
