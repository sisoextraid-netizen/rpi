(function () {
/* =====================================================================
   RPI (Rumah Pelopor Indonesia) - Laporan Kunjungan Relawan & Dashboard Donasi
   Versi produksi: Supabase Auth + RLS + Storage, PWA dengan service worker.
   Skema database: supabase/schema.sql
   ===================================================================== */
const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;

const CFG = window.RPI_CONFIG || {};
const LOGO = './icons/logo.png';
const LS_DISMISS = 'rpi_install_dismissed';
const LS_INSTALLED = 'rpi_installed';
const SETTINGS_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_SETTINGS = { id: SETTINGS_ID, org_name: 'Rumah Pelopor Indonesia', org_logo_url: null, bank_accounts: [], receipt_footer_text: '' };
const EMPTY_DB = { profiles: [], donation_categories: [], donors: [], volunteer_visits: [], donations: [], settings: DEFAULT_SETTINGS };

const sb = (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

