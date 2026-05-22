// ============================================================
// GOR v3.1 — GBH Online Return
// Developed by Mix Thompson
// Improved Version — Security & Performance Enhanced
// ============================================================

// ---- SUPABASE CONFIG ----
const SUPABASE_URL = 'https://jwlvfmzkmwulihecqcbn.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bHZmbXprbXd1bGloZWNxY2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MjY0MDAsImV4cCI6MjA2NDQwMjQwMH0.เปลี่ยนเป็น-anon-key-ของคุณ' // ⚠️ เปลี่ยนเป็น ANON KEY จาก Supabase Dashboard > Settings > API

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ---- CLOUDINARY CONFIG ----
const CLOUDINARY_CLOUD_NAME = 'dsrdihvgz'
const CLOUDINARY_UPLOAD_PRESET = 'gor-unsigned'

// ---- GLOBAL VARIABLES ----
let currentUser = null
let currentProfile = null
let currentPage = 'home'
let currentFilter = ''
let currentCondition = ''
let scanTarget = ''
let selectedReturnId = null
let deleteTargetId = null
let emailTargetData = null
let selectedFiles = []
let editRewardId = null
let deleteRewardId = null
let html5QrCode = null
let rewardSelectedFiles = []
let rewardSlideIndex = 0
let unboxedFiles = []

// ---- ADMIN SECRET (ปลอดภัย: ใช้กับ Edge Function ใน Production) ----
// 🔒 NOTE: ใน production ควรย้ายไป Supabase Edge Function
// แต่เพื่อให้แอปทำงานได้ในตอนนี้ จะเช็คจาก role admin แทน
const ADMIN_SECRET = 'Mix0941906062' // เปลี่ยนเป็นรหัสของคุณเอง

// ---- STORAGE CONFIG ----
const STORAGE_URL = 'https://jwlvfmzkmwulihecqcbn.supabase.co/storage/v1/object/public/return-images'

// ---- CACHE SYSTEM ----
const cache = {
  returns: { data: null, time: 0 },
  rewards: { data: null, time: 0 },
  notifications: { data: null, time: 0 }
}
let returnPage = 1
const CACHE_DURATION = 30000 // 30 seconds

// ---- CONSTANTS ----
const STATUS_EMOJI = {
  pending: '⏳', returned: '✅', platform_claim: '📋',
  wait_damage: '🔧', damaged_done: '📄', wait_claim: '📬',
  claim_failed: '❌', unboxed: '📦'
}

const STATUS_LABEL = {
  pending: 'รอดำเนินการ', returned: 'ดำเนินการทำคืนแล้ว',
  platform_claim: 'แพลตฟอร์มรับเคลมสินค้า', wait_damage: 'รอทำชำรุด',
  damaged_done: 'ทำเอกสารชำรุดแล้ว', wait_claim: 'รอยื่นเคลม',
  claim_failed: 'เคลมสินค้าไม่ผ่าน', unboxed: 'พัสดุยังไม่แกะ'
}

const STATUS_COLOR = {
  pending: 'b-yellow', returned: 'b-green', platform_claim: 'b-blue',
  wait_damage: 'b-orange', damaged_done: 'b-red', wait_claim: 'b-pink',
  claim_failed: 'b-purple', unboxed: 'b-red'
}

const ROLE_LABEL = {
  pending: 'รออนุมัติ', staff: 'พนักงาน', admin: 'ผู้ดูแลระบบ'
}

const FINAL_STATUSES = ['returned', 'platform_claim', 'damaged_done']

const RANK_CONFIG = [
  { min: 0, max: 9, name: 'ผู้ทดลองใช้งาน', icon: '🆕' },
  { min: 10, max: 39, name: 'มือใหม่', icon: '🌱' },
  { min: 40, max: 89, name: 'ผู้เข้าใจระบบงาน', icon: '💡' },
  { min: 90, max: 299, name: 'ผู้เชี่ยวชาญ', icon: '⭐' },
  { min: 300, max: 699, name: 'ผู้สู้ชีวิต', icon: '🔥' },
  { min: 700, max: 9999, name: 'ไม่ตายก็บุญแล้ว', icon: '👑' }
]

const GPOINT_RULES = {
  create: 1,
  pending_to_returned: 1,
  wait_damage_to_done: 3,
  wait_claim_to_claim: 1,
  delete: -1
}

const GPOINT_REFUND = {
  damaged_done: -3,
  returned: -1,
  platform_claim: -1,
  pending: -1
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getRank(totalExp) {
  for (const r of RANK_CONFIG) {
    if (totalExp >= r.min && totalExp <= r.max) return r
  }
  return RANK_CONFIG[RANK_CONFIG.length - 1]
}

function getImageUrl(filename) {
  if (!filename) return ''
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename
  }
  return STORAGE_URL + '/' + filename
}

function debounce(func, delay) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), delay)
  }
}

// ============================================================
// THEME & AUTH FUNCTIONS
// ============================================================

function toggleTheme() {
  const html = document.documentElement
  const isDark = html.getAttribute('data-theme') === 'dark'
  html.setAttribute('data-theme', isDark ? 'light' : 'dark')
  
  const btnTheme = document.getElementById('btn-theme')
  if (btnTheme) {
    btnTheme.innerHTML = isDark ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>'
  }
  
  const menuIcon = document.getElementById('theme-icon-menu')
  const menuLabel = document.getElementById('theme-label-menu')
  if (menuIcon) menuIcon.className = isDark ? 'ti ti-moon' : 'ti ti-sun'
  if (menuLabel) menuLabel.textContent = isDark ? 'โหมดกลางคืน' : 'โหมดกลางวัน'
  
  // Save preference
  try {
    localStorage.setItem('gor-theme', isDark ? 'light' : 'dark')
  } catch (e) { /* ignore */ }
}

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem('gor-theme')
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  } catch (e) { /* ignore */ }
}

function showAuth(pageId) {
  document.querySelectorAll('.auth-wrapper').forEach(el => el.style.display = 'none')
  const target = document.getElementById(pageId)
  if (target) target.style.display = 'flex'
}

function togglePassword(inputId, iconElement) {
  const input = document.getElementById(inputId)
  const isPassword = input.type === 'password'
  input.type = isPassword ? 'text' : 'password'
  iconElement.className = isPassword ? 'ti ti-eye-off input-icon' : 'ti ti-eye input-icon'
}

// ============================================================
// AUTH HANDLERS
// ============================================================

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase()
  const password = document.getElementById('login-password').value
  const errorEl = document.getElementById('login-error')
  
  errorEl.style.display = 'none'
  
  if (!email || !password) {
    errorEl.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'
    errorEl.style.display = 'block'
    return
  }
  
  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password })
    
    if (error) {
      errorEl.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      errorEl.style.display = 'block'
      return
    }
    
    if (!data?.user) {
      errorEl.textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      errorEl.style.display = 'block'
      return
    }
    
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    if (profileError || !profile) {
      await db.auth.signOut()
      errorEl.textContent = 'ไม่พบบัญชีผู้ใช้ กรุณาติดต่อผู้ดูแลระบบ'
      errorEl.style.display = 'block'
      return
    }
    
    if (profile.role === 'pending') {
      await db.auth.signOut()
      errorEl.textContent = 'บัญชีของคุณยังรอการอนุมัติจากผู้ดูแลระบบ'
      errorEl.style.display = 'block'
      return
    }
    
    currentProfile = profile
    enterApp()
  } catch (err) {
    console.error('Login error:', err)
    errorEl.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่'
    errorEl.style.display = 'block'
  }
}

async function handleRegister() {
  const name = document.getElementById('reg-name').value.trim()
  const display = document.getElementById('reg-display').value.trim() || name
  const email = document.getElementById('reg-email').value.trim().toLowerCase()
  const password = document.getElementById('reg-password').value
  const errorEl = document.getElementById('reg-error')
  const successEl = document.getElementById('reg-success')
  
  errorEl.style.display = 'none'
  successEl.style.display = 'none'
  
  // Validation
  if (!name || !email || !password) {
    errorEl.textContent = 'กรุณากรอกข้อมูลให้ครบทุกช่อง'
    errorEl.style.display = 'block'
    return
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    errorEl.textContent = 'รูปแบบอีเมลไม่ถูกต้อง'
    errorEl.style.display = 'block'
    return
  }
  
  if (password.length < 6) {
    errorEl.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    errorEl.style.display = 'block'
    return
  }
  
  try {
    const redirectTo = window.location.origin + window.location.pathname
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: redirectTo
      }
    })
    
    if (error) {
      errorEl.textContent = 'เกิดข้อผิดพลาด: ' + error.message
      errorEl.style.display = 'block'
      return
    }
    
    if (data?.user?.id) {
      // Auto-approve as staff
      await db.from('profiles').update({
        display_name: display,
        role: 'staff'
      }).eq('id', data.user.id)
      
      await addNotification(
        `🆕 ${display || name} สมัครสมาชิกใหม่และได้รับการอนุมัติอัตโนมัติ`,
        'info'
      )
    }
    
    successEl.innerHTML = `
      ✅ สมัครสมาชิกสำเร็จ!<br>
      คุณได้รับสิทธิ์ <strong>Staff</strong> ทันที<br>
      <a href="#" onclick="showAuth('page-login')" style="color:var(--primary);font-weight:700">
        คลิกเพื่อเข้าสู่ระบบ
      </a>
    `
    successEl.style.display = 'block'
    
  } catch (err) {
    console.error('Register error:', err)
    errorEl.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
    errorEl.style.display = 'block'
  }
}

async function handleLogout() {
  try {
    await db.auth.signOut()
  } catch (e) {
    console.error('Logout error:', e)
  }
  
  currentProfile = null
  currentUser = null
  
  document.getElementById('app').style.display = 'none'
  showAuth('page-login')
}

async function refreshProfile() {
  if (!currentProfile?.id) return
  
  try {
    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', currentProfile.id)
      .single()
    
    if (profile) currentProfile = profile
  } catch (e) {
    console.error('Refresh profile error:', e)
  }
}

async function forgotPassword() {
  const email = prompt('กรุณากรอกอีเมลที่ลงทะเบียนไว้เพื่อรีเซ็ตรหัสผ่าน')
  
  if (!email) return
  
  try {
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo
    })
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว! กรุณาตรวจสอบ inbox')
    }
  } catch (e) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
  }
}

function checkResetFlow() {
  const hash = window.location.hash
  if (hash && hash.includes('type=recovery')) {
    showAuth('page-reset')
  }
}

async function handleResetPassword() {
  const password = document.getElementById('reset-password').value
  const errorEl = document.getElementById('reset-error')
  const successEl = document.getElementById('reset-success')
  
  errorEl.style.display = 'none'
  successEl.style.display = 'none'
  
  if (password.length < 6) {
    errorEl.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    errorEl.style.display = 'block'
    return
  }
  
  try {
    const { error } = await db.auth.updateUser({ password })
    
    if (error) {
      errorEl.textContent = 'เกิดข้อผิดพลาด: ' + error.message
      errorEl.style.display = 'block'
    } else {
      successEl.innerHTML = `
        ✅ ตั้งรหัสผ่านใหม่สำเร็จ!<br>
        <a href="#" onclick="showAuth('page-login')" style="color:var(--primary);font-weight:700">
          คลิกเพื่อเข้าสู่ระบบ
        </a>
      `
      successEl.style.display = 'block'
    }
  } catch (e) {
    errorEl.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
    errorEl.style.display = 'block'
  }
}

// ============================================================
// APP ENTRY & NAVIGATION
// ============================================================

function enterApp() {
  // Hide auth pages
  document.querySelectorAll('.auth-wrapper').forEach(el => el.style.display = 'none')
  
  // Show main app
  document.getElementById('app').style.display = 'flex'
  
  // Update UI
  updateProfileUI()
  
  // Show admin features
  if (currentProfile.role === 'admin') {
    document.getElementById('btn-admin').style.display = 'flex'
    document.getElementById('menu-admin').style.display = 'flex'
    document.getElementById('btn-noti').style.display = 'flex'
  }
  
  // Show update button
  document.getElementById('btn-update').style.display = 'flex'
  
  // Update last seen
  db.from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', currentProfile.id)
    .then(() => {})
    .catch(() => {})
  
  // Navigate to home
  showPage('home')
}

function updateProfileUI() {
  const p = currentProfile
  if (!p) return
  
  document.getElementById('welcome-name').textContent = 
    `สวัสดีครับ, ${p.display_name || p.full_name || 'ผู้ใช้'}`
  
  document.getElementById('welcome-date').textContent = 
    new Date().toLocaleDateString('th-TH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  
  document.getElementById('profile-name').textContent = 
    p.display_name || p.full_name || '-'
  
  document.getElementById('profile-role').textContent = 
    ROLE_LABEL[p.role] || p.role || '-'
  
  document.getElementById('profile-avatar').textContent = 
    (p.display_name || p.full_name || '?').charAt(0).toUpperCase()
  
  document.getElementById('profile-point').textContent = 
    p.g_point || 0
  
  // Avatar
  const avatarImg = document.getElementById('profile-avatar-img')
  const avatarDiv = document.getElementById('profile-avatar')
  
  if (p.avatar_url) {
    avatarImg.src = getImageUrl(p.avatar_url) + '?t=' + Date.now()
    avatarImg.style.display = 'block'
    avatarDiv.style.display = 'none'
  } else {
    avatarImg.style.display = 'none'
    avatarDiv.style.display = 'flex'
  }
  
  // Rank & EXP
  const totalExp = p.total_exp || 0
  const rank = getRank(totalExp)
  const nextRank = RANK_CONFIG.find(r => r.min > totalExp) || RANK_CONFIG[RANK_CONFIG.length - 1]
  const expPercent = Math.min(100, Math.floor(((totalExp - rank.min) / (nextRank.min - rank.min)) * 100))
  
  document.getElementById('profile-rank').textContent = `${rank.icon} ${rank.name}`
  document.getElementById('profile-exp-text').textContent = `${totalExp} / ${nextRank.min} EXP`
  document.getElementById('exp-fill').style.width = expPercent + '%'
}

function showPage(page) {
  const pages = ['home', 'list', 'form', 'form-select', 'profile', 'admin', 'rewards']
  
  pages.forEach(p => {
    const el = document.getElementById('pg-' + p)
    if (el) el.style.display = p === page ? 'block' : 'none'
  })
  
  // Update nav
  const navMap = {
    home: 'nav-home',
    list: 'nav-list',
    profile: 'nav-profile',
    rewards: 'nav-rewards'
  }
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'))
  const activeNav = navMap[page]
  if (activeNav) {
    const navEl = document.getElementById(activeNav)
    if (navEl) navEl.classList.add('active')
  }
  
  currentPage = page
  
  // Load data based on page
  switch (page) {
    case 'home':
      loadDashboard()
      break
    case 'list':
      loadReturns()
      break
    case 'form':
      initForm()
      break
    case 'admin':
      loadUsers()
      loadAdminRewards()
      break
    case 'rewards':
      loadRewards()
      break
    case 'profile':
      refreshProfile().then(() => updateProfileUI())
      break
  }
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
  try {
    const { data } = await db.from('returns').select('*')
    
    if (!data) {
      document.getElementById('stat-grid').innerHTML = '<p style="text-align:center;color:var(--text-sub)">ไม่มีข้อมูล</p>'
      document.getElementById('recent-list').innerHTML = '<p style="text-align:center;color:var(--text-sub);padding:32px 0">ยังไม่มีรายการ</p>'
      return
    }
    
    const today = new Date().toISOString().split('T')[0]
    
    const stats = [
      { label: '📅 วันนี้', color: '', count: data.filter(r => r.recorded_date === today).length },
      { label: '⏳ รอดำเนินการ', color: 'amber', count: data.filter(r => r.status === 'pending').length },
      { label: '✅ ทำคืนแล้ว', color: 'green', count: data.filter(r => r.status === 'returned').length },
      { label: '🔧 รอทำชำรุด', color: 'orange', count: data.filter(r => r.status === 'wait_damage').length },
      { label: '📄 ทำชำรุดแล้ว', color: 'red', count: data.filter(r => r.status === 'damaged_done').length },
      { label: '📬 รอยื่นเคลม', color: 'pink', count: data.filter(r => r.status === 'wait_claim').length },
      { label: '📋 รับเคลมแล้ว', color: 'blue', count: data.filter(r => r.status === 'platform_claim').length },
      { label: '📦 ยังไม่แกะ', color: 'red', count: data.filter(r => r.status === 'unboxed').length }
    ]
    
    document.getElementById('stat-grid').innerHTML = stats.map(s => `
      <div class="stat-card" 
           ${s.label.includes('ยังไม่แกะ') ? 'onclick="currentFilter=\'unboxed\';showPage(\'list\')" style="border:2px solid #E02424;cursor:pointer"' : ''}>
        <div class="stat-num ${s.color}">${s.count}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('')
    
    // Recent items
    const recent = [...data]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
    
    renderCards(recent, 'recent-list')
    
  } catch (e) {
    console.error('Load dashboard error:', e)
  }
}

// ============================================================
// RETURNS LIST
// ============================================================

let searchTimeout = null

function handleSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadReturns(), 300)
}

function setFilter(filterValue, btnElement) {
  currentFilter = filterValue
  
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'))
  if (btnElement) btnElement.classList.add('active')
  
  loadReturns()
}

async function loadReturns() {
  const searchTerm = document.getElementById('search-input')?.value?.trim() || ''
  
  // Check cache
  const now = Date.now()
  if (!searchTerm && !currentFilter && cache.returns.data && (now - cache.returns.time) < CACHE_DURATION) {
    renderCards(cache.returns.data.slice(0, returnPage * 20), 'returns-list')
    return
  }
  
  try {
    let query = db.from('returns')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (currentFilter) {
      query = query.eq('status', currentFilter)
    }
    
    if (searchTerm) {
      query = query.or(
        `tracking_number.ilike.%${searchTerm}%,order_number.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`
      )
    }
    
    const { data } = await query
    
    if (!searchTerm && !currentFilter) {
      cache.returns = { data, time: now }
      returnPage = 1
    }
    
    renderCards(data || [], 'returns-list')
    
  } catch (e) {
    console.error('Load returns error:', e)
    document.getElementById('returns-list').innerHTML = 
      '<p style="text-align:center;color:var(--text-sub);padding:32px 0">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>'
  }
}

function renderCards(data, containerId) {
  const container = document.getElementById(containerId)
  
  if (!data || data.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-sub);padding:32px 0;font-size:14px">ยังไม่มีรายการ</p>'
    return
  }
  
  const displayData = data.slice(0, returnPage * 20)
  
  container.innerHTML = displayData.map(r => {
    const isFinal = FINAL_STATUSES.includes(r.status)
    const emoji = STATUS_EMOJI[r.status] || '📌'
    const isUnboxed = r.status === 'unboxed'
    
    return `
      <div class="return-card" 
           onclick="openDetail('${r.id}')" 
           style="${isUnboxed ? 'border:2px solid #E02424' : ''}">
        <div class="return-card-top">
          <div>
            <div class="return-tracking">${escapeHTML(r.tracking_number || '-')}</div>
            <div class="return-courier">${escapeHTML(r.courier || '')} • ${r.recorded_date || ''}</div>
          </div>
          <span class="badge ${STATUS_COLOR[r.status] || 'b-yellow'}">
            ${emoji} ${STATUS_LABEL[r.status] || r.status}
          </span>
        </div>
        ${r.order_number ? `<div class="return-meta">ออเดอร์: ${escapeHTML(r.order_number)}</div>` : ''}
        <div class="return-meta">
          บันทึกโดย: 
          <span id="creator-${r.id}" style="cursor:pointer;color:var(--accent)" 
                onclick="event.stopPropagation();openUserInfo('${r.created_by || r.last_updated_by}')">
            👤 กำลังโหลด...
          </span>
          • ${new Date(r.created_at).toLocaleString('th-TH')}
        </div>
        <div class="return-actions" onclick="event.stopPropagation()">
          <button class="btn-small btn-edit" onclick="openDetail('${r.id}')">
            <i class="ti ti-eye"></i> ดู/แก้ไข
          </button>
          ${!isFinal ? `
            <button class="btn-small btn-update" onclick="openStatusUpdate('${r.id}')">
              <i class="ti ti-arrow-forward-up"></i> อัปเดต
            </button>
          ` : ''}
          ${r.status === 'wait_claim' ? `
            <button class="btn-small btn-track" onclick="trackClaim()">
              <i class="ti ti-external-link"></i> ติดตามเคลม
            </button>
          ` : ''}
          <button class="btn-small btn-email" onclick="openEmailModal('${r.id}')">
            <i class="ti ti-mail"></i> ส่ง Email
          </button>
          <button class="btn-small btn-delete" onclick="openDeleteModal('${r.id}')">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </div>
    `
  }).join('')
  
  // Load creator names efficiently
  loadCreatorNames(displayData)
}

function escapeHTML(str) {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

async function loadCreatorNames(returnsData) {
  const userIds = [...new Set(
    returnsData
      .map(r => r.created_by || r.last_updated_by)
      .filter(Boolean)
  )]
  
  if (userIds.length === 0) {
    // Set all to default
    returnsData.forEach(r => {
      const span = document.getElementById('creator-' + r.id)
      if (span) span.textContent = '👤 -'
    })
    return
  }
  
  try {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)
    
    const profileMap = {}
    if (profiles) {
      profiles.forEach(p => {
        profileMap[p.id] = p.display_name || 'ผู้ใช้'
      })
    }
    
    returnsData.forEach(r => {
      const span = document.getElementById('creator-' + r.id)
      if (span) {
        const uid = r.created_by || r.last_updated_by
        span.textContent = profileMap[uid] ? '👤 ' + profileMap[uid] : '👤 -'
      }
    })
  } catch (e) {
    returnsData.forEach(r => {
      const span = document.getElementById('creator-' + r.id)
      if (span) span.textContent = '👤 -'
    })
  }
}

// ============================================================
// DETAIL & STATUS MANAGEMENT
// ============================================================

async function openDetail(id) {
  selectedReturnId = id
  
  try {
    const { data } = await db.from('returns').select('*').eq('id', id).single()
    if (!data) return
    
    const isFinal = FINAL_STATUSES.includes(data.status)
    const emoji = STATUS_EMOJI[data.status] || '📌'
    
    // Build images section
    let imagesHTML = ''
    const allImages = []
    
    const imageFields = [
      { label: '📸 รูปสินค้า', url: data.image_product },
      { label: '📸 รูปบาร์โค้ด', url: data.image_barcode },
      { label: '📸 รูปใบปะหน้า', url: data.image_label },
      { label: '📸 รูปส่วนที่ชำรุด', url: data.image_damage },
      { label: '📸 รูปเอกสาร', url: data.image_document }
    ]
    
    imageFields.forEach(img => {
      if (img.url) allImages.push(img)
    })
    
    if (data.images && data.images.length > 0) {
      data.images.forEach((url, i) => {
        allImages.push({ label: `📸 รูปเพิ่มเติม ${i + 1}`, url })
      })
    }
    
    if (allImages.length > 0) {
      imagesHTML = `
        <div class="detail-label">📸 รูปภาพทั้งหมด (${allImages.length} ภาพ)</div>
        <div class="photo-grid">
          ${allImages.map(img => `
            <div class="photo-grid-item" title="${escapeHTML(img.label)}" 
                 onclick="openImageViewer('${getImageUrl(img.url)}', '${escapeHTML(img.label)}')" 
                 style="cursor:pointer">
              <img src="${getImageUrl(img.url)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" alt="${escapeHTML(img.label)}"/>
            </div>
          `).join('')}
        </div>
      `
    }
    
    document.getElementById('modal-title').textContent = `รายละเอียด — ${data.tracking_number || data.id}`
    document.getElementById('modal-body').innerHTML = `
      <div class="detail-label">วันที่</div>
      <div class="detail-value">
        <input type="date" id="edit-date" value="${data.recorded_date || ''}" 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)"/>
      </div>
      
      <div class="detail-label">ขนส่ง</div>
      <div class="detail-value">
        <input type="text" id="edit-courier" value="${escapeHTML(data.courier || '')}" 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)"/>
      </div>
      
      <div class="detail-label">ออเดอร์</div>
      <div class="detail-value">
        <input type="text" id="edit-order" value="${escapeHTML(data.order_number || '')}" 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)"/>
      </div>
      
      <div class="detail-label">พัสดุ</div>
      <div class="detail-value">
        <input type="text" id="edit-tracking" value="${escapeHTML(data.tracking_number || '')}" 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)"/>
      </div>
      
      <div class="detail-label">เอกสาร</div>
      <div class="detail-value">
        <input type="text" id="edit-docnum" value="${escapeHTML(data.document_number || '')}" 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)"/>
      </div>
      
      <div class="detail-label">🔍 บาร์โค้ดสินค้า</div>
      <div class="detail-value">
        <input type="text" id="edit-barcode" value="${escapeHTML(data.barcode || '')}" 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)"/>
      </div>
      
      <div class="detail-label">สภาพ</div>
      <div class="detail-value">
        <strong style="color:${data.condition === 'ok' ? '#3B6D11' : '#A32D2D'}">
          ${data.condition === 'ok' ? '✅ ไม่ชำรุด' : '❌ ชำรุด'}
        </strong>
      </div>
      
      ${data.condition === 'damaged' && data.damage_description ? `
        <div class="detail-label">ส่วนที่ชำรุด</div>
        <div class="detail-value">
          <textarea id="edit-damage-desc" 
                    style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)" 
                    rows="2">${escapeHTML(data.damage_description || '')}</textarea>
        </div>
      ` : ''}
      
      <div class="detail-label">สถานะ</div>
      <div class="detail-value">
        <span class="badge ${STATUS_COLOR[data.status] || 'b-yellow'}">
          ${emoji} ${STATUS_LABEL[data.status] || data.status}
        </span>
      </div>
      
      ${data.status_ref_number ? `
        <div class="detail-label">อ้างอิง</div>
        <div class="detail-value">${escapeHTML(data.status_ref_number)}</div>
      ` : ''}
      
      ${data.status_approver ? `
        <div class="detail-label">ผู้อนุมัติ</div>
        <div class="detail-value">${escapeHTML(data.status_approver)}</div>
      ` : ''}
      
      ${data.last_updated_by ? `
        <div class="detail-label">แก้ไขโดย</div>
        <div class="detail-value" style="cursor:pointer;color:var(--accent)" 
             onclick="openUserInfo('${data.last_updated_by}')">
          👤 ${data.last_updated_at ? new Date(data.last_updated_at).toLocaleString('th-TH') : ''}
        </div>
      ` : ''}
      
      <div class="detail-label">หมายเหตุ</div>
      <div class="detail-value">
        <textarea id="edit-note" 
                  style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)" 
                  rows="2">${escapeHTML(data.note || '')}</textarea>
      </div>
      
      ${imagesHTML}
      
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-primary" style="flex:1" onclick="saveDetail()">
          <i class="ti ti-device-floppy"></i> บันทึก
        </button>
        ${!isFinal ? `
          <button class="btn-primary" style="flex:1;background:var(--accent)" 
                  onclick="closeDetail();openStatusUpdate('${data.id}')">
            <i class="ti ti-arrow-forward-up"></i> อัปเดต
          </button>
        ` : ''}
        ${data.status === 'wait_claim' ? `
          <button class="btn-primary" style="flex:1;background:#E65100" onclick="trackClaim()">
            <i class="ti ti-external-link"></i> ติดตามเคลม
          </button>
        ` : ''}
        <button class="btn-primary" style="flex:1;background:#6366F1" onclick="printQRCode()">
          <i class="ti ti-printer"></i> Print QR
        </button>
        <button class="btn-primary" style="flex:1;background:#0891B2" 
                onclick="closeDetail();openEmailModal('${data.id}')">
          <i class="ti ti-mail"></i> ส่ง Email
        </button>
      </div>
    `
    
    document.getElementById('detail-modal').style.display = 'flex'
    
  } catch (e) {
    console.error('Open detail error:', e)
    alert('เกิดข้อผิดพลาดในการโหลดรายละเอียด')
  }
}

function closeDetail() {
  document.getElementById('detail-modal').style.display = 'none'
  selectedReturnId = null
}

async function saveDetail() {
  if (!selectedReturnId) return
  
  try {
    const updates = {
      recorded_date: document.getElementById('edit-date')?.value || null,
      courier: document.getElementById('edit-courier')?.value || null,
      order_number: document.getElementById('edit-order')?.value || null,
      tracking_number: document.getElementById('edit-tracking')?.value || null,
      document_number: document.getElementById('edit-docnum')?.value || null,
      barcode: document.getElementById('edit-barcode')?.value || null,
      note: document.getElementById('edit-note')?.value || null,
      last_updated_by: currentProfile.id,
      last_updated_at: new Date().toISOString()
    }
    
    const damageDescEl = document.getElementById('edit-damage-desc')
    if (damageDescEl) {
      updates.damage_description = damageDescEl.value
    }
    
    const { error } = await db.from('returns').update(updates).eq('id', selectedReturnId)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    await addNotification(
      `✏️ ${currentProfile.display_name || currentProfile.full_name} ได้แก้ไขรายการ`,
      'info'
    )
    
    alert('อัปเดตสำเร็จ!')
    closeDetail()
    
    // Refresh current view
    if (currentPage === 'home') loadDashboard()
    if (currentPage === 'list') loadReturns()
    
  } catch (e) {
    console.error('Save detail error:', e)
    alert('เกิดข้อผิดพลาดในการบันทึก')
  }
}

// ============================================================
// GPOINT MANAGEMENT
// ============================================================

async function updateGPoint(userId, pointAmount, expAmount = null) {
  try {
    const { data: profile } = await db
      .from('profiles')
      .select('g_point, total_exp')
      .eq('id', userId)
      .single()
    
    if (!profile) return
    
    const newGPoint = Math.max(0, (profile.g_point || 0) + pointAmount)
    const newExp = expAmount !== null 
      ? Math.max(0, (profile.total_exp || 0) + expAmount)
      : Math.max(0, (profile.total_exp || 0) + pointAmount)
    
    await db.from('profiles').update({
      g_point: newGPoint,
      total_exp: newExp
    }).eq('id', userId)
    
  } catch (e) {
    console.error('Update GPoint error:', e)
  }
}

// ============================================================
// STATUS UPDATE
// ============================================================

function openStatusUpdate(id) {
  selectedReturnId = id
  
  db.from('returns').select('*').eq('id', id).single().then(({ data }) => {
    if (!data) return
    
    const status = data.status
    const condition = data.condition
    
    document.getElementById('status-modal-title').textContent = `อัปเดต — ${data.tracking_number || id}`
    
    let html = ''
    
    if (status === 'pending') {
      html = `
        <p style="margin-bottom:12px;color:var(--text-sub)">⏳ รอดำเนินการ</p>
        <div class="form-group">
          <label>เลขที่เอกสารทำคืน</label>
          <div class="input-scan-row">
            <input type="text" id="su-return-docnum" placeholder="เลขที่เอกสารทำคืน"/>
            <button class="btn-scan" onclick="startScan('su-return-docnum')">
              <i class="ti ti-scan"></i>
            </button>
          </div>
        </div>
        ${condition === 'damaged' ? `
          <div class="form-group">
            <label>สถานะถัดไป</label>
            <select id="su-next-status">
              <option value="wait_damage">🔧 รอทำชำรุด</option>
              <option value="wait_claim">📬 รอยื่นเคลม</option>
            </select>
          </div>
        ` : ''}
        <button class="btn-primary" onclick="submitStatusUpdate()">บันทึก</button>
      `
    } else if (status === 'wait_damage') {
      html = `
        <p style="margin-bottom:12px;color:var(--text-sub)">🔧 รอทำชำรุด</p>
        <div class="form-group">
          <label>เลขที่เอกสารทำชำรุด</label>
          <div class="input-scan-row">
            <input type="text" id="su-damage-docnum" placeholder="เลขที่เอกสาร"/>
            <button class="btn-scan" onclick="startScan('su-damage-docnum')">
              <i class="ti ti-scan"></i>
            </button>
          </div>
        </div>
        <button class="btn-primary" onclick="submitStatusUpdate()">บันทึก</button>
      `
    } else if (status === 'wait_claim') {
      html = `
        <p style="margin-bottom:12px;color:var(--text-sub)">📬 รอยื่นเคลม</p>
        <div class="form-group">
          <label>ชื่อผู้ทำรายการเคลม</label>
          <input type="text" id="su-approver" placeholder="ชื่อผู้ทำรายการ"/>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn-primary" style="flex:1;background:#3B6D11" 
                  onclick="submitStatusUpdate('platform_claim')">เคลมผ่าน</button>
          <button class="btn-primary" style="flex:1;background:#A32D2D" 
                  onclick="submitStatusUpdate('claim_failed')">เคลมไม่ผ่าน</button>
        </div>
      `
    }
    
    document.getElementById('status-modal-body').innerHTML = html
    document.getElementById('status-modal').style.display = 'flex'
  }).catch(e => {
    console.error('Open status update error:', e)
  })
}

function closeStatusModal() {
  document.getElementById('status-modal').style.display = 'none'
  selectedReturnId = null
}

async function submitStatusUpdate(nextStatusOverride) {
  if (!selectedReturnId) return
  
  try {
    const { data } = await db.from('returns')
      .select('status, condition')
      .eq('id', selectedReturnId)
      .single()
    
    if (!data) return
    
    const currentStatus = data.status
    const condition = data.condition
    let updates = {
      last_updated_by: currentProfile.id,
      last_updated_at: new Date().toISOString()
    }
    let gPointAmount = 0
    
    if (currentStatus === 'pending') {
      const returnDocNum = document.getElementById('su-return-docnum')?.value
      if (!returnDocNum) {
        alert('กรุณากรอกเลขที่เอกสารทำคืน')
        return
      }
      updates.status_ref_number = returnDocNum
      
      if (condition === 'damaged') {
        updates.status = document.getElementById('su-next-status')?.value || 'wait_damage'
      } else {
        updates.status = 'returned'
        gPointAmount = GPOINT_RULES.pending_to_returned
      }
    } else if (currentStatus === 'wait_damage') {
      const damageDocNum = document.getElementById('su-damage-docnum')?.value
      if (!damageDocNum) {
        alert('กรุณากรอกเลขที่เอกสารทำชำรุด')
        return
      }
      updates.status_ref_number = damageDocNum
      updates.status = 'damaged_done'
      gPointAmount = GPOINT_RULES.wait_damage_to_done
    } else if (currentStatus === 'wait_claim') {
      const approver = document.getElementById('su-approver')?.value
      if (!approver) {
        alert('กรุณากรอกชื่อผู้ทำรายการเคลม')
        return
      }
      updates.status_approver = approver
      
      if (nextStatusOverride === 'platform_claim') {
        updates.status = 'platform_claim'
        gPointAmount = GPOINT_RULES.wait_claim_to_claim
      } else if (nextStatusOverride === 'claim_failed') {
        updates.status = 'claim_failed'
        gPointAmount = 0
      }
    }
    
    const { error } = await db.from('returns').update(updates).eq('id', selectedReturnId)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    // Handle claim failed -> back to wait_damage
    if (updates.status === 'claim_failed') {
      await db.from('returns').update({ status: 'wait_damage' }).eq('id', selectedReturnId)
    }
    
    // Update GPoint
    if (gPointAmount !== 0) {
      await updateGPoint(currentProfile.id, gPointAmount)
      await refreshProfile()
      updateProfileUI()
    }
    
    await addNotification(
      `🔄 ${currentProfile.display_name || currentProfile.full_name} ได้อัปเดตสถานะเอกสาร`,
      'info'
    )
    
    alert(`อัปเดตสำเร็จ!${gPointAmount !== 0 ? ` (${gPointAmount > 0 ? '+' : ''}${gPointAmount} G Point)` : ''}`)
    
    closeStatusModal()
    
    if (currentPage === 'home') loadDashboard()
    if (currentPage === 'list') loadReturns()
    
  } catch (e) {
    console.error('Submit status update error:', e)
    alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ')
  }
}

// ============================================================
// DELETE FUNCTIONALITY
// ============================================================

function openDeleteModal(id) {
  deleteTargetId = id
  document.getElementById('delete-password').value = ''
  document.getElementById('delete-error').style.display = 'none'
  document.getElementById('delete-modal').style.display = 'flex'
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none'
  deleteTargetId = null
}

async function confirmDelete() {
  const password = document.getElementById('delete-password').value
  const errorEl = document.getElementById('delete-error')
  
  errorEl.style.display = 'none'
  
  if (!password) {
    errorEl.textContent = 'กรุณากรอกรหัสผ่าน'
    errorEl.style.display = 'block'
    return
  }
  
  try {
    // Verify password by re-authenticating
    const { data: { session } } = await db.auth.getSession()
    const { error: authError } = await db.auth.signInWithPassword({
      email: session.user.email,
      password: password
    })
    
    if (authError) {
      errorEl.textContent = 'รหัสผ่านไม่ถูกต้อง'
      errorEl.style.display = 'block'
      return
    }
    
    // Get return data before deleting
    const { data: returnData } = await db
      .from('returns')
      .select('created_by, status')
      .eq('id', deleteTargetId)
      .single()
    
    let pointDeduction = GPOINT_RULES.delete
    if (returnData && GPOINT_REFUND[returnData.status]) {
      pointDeduction = GPOINT_REFUND[returnData.status]
    }
    if (returnData && returnData.status === 'unboxed') {
      pointDeduction = 0
    }
    
    const ownerId = returnData?.created_by || currentProfile.id
    
    // Delete the record
    const { error: delError } = await db.from('returns').delete().eq('id', deleteTargetId)
    
    if (delError) {
      alert('เกิดข้อผิดพลาด: ' + delError.message)
      return
    }
    
    // Update points
    if (pointDeduction !== 0) {
      await updateGPoint(ownerId, pointDeduction, pointDeduction)
      await refreshProfile()
      updateProfileUI()
    }
    
    alert(`ลบสำเร็จ!${pointDeduction !== 0 ? ` (${pointDeduction} G Point)` : ''}`)
    
    closeDeleteModal()
    
    if (currentPage === 'home') loadDashboard()
    if (currentPage === 'list') loadReturns()
    
  } catch (e) {
    console.error('Confirm delete error:', e)
    errorEl.textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่'
    errorEl.style.display = 'block'
  }
}

// ============================================================
// EMAIL FUNCTIONALITY
// ============================================================

function openEmailModal(id) {
  emailTargetData = id
  document.getElementById('email-to').value = ''
  document.getElementById('email-error').style.display = 'none'
  document.getElementById('email-modal').style.display = 'flex'
}

function closeEmailModal() {
  document.getElementById('email-modal').style.display = 'none'
  emailTargetData = null
}

async function sendEmail() {
  const to = document.getElementById('email-to').value.trim()
  const errorEl = document.getElementById('email-error')
  
  errorEl.style.display = 'none'
  
  if (!to) {
    errorEl.textContent = 'กรุณากรอกอีเมลปลายทาง'
    errorEl.style.display = 'block'
    return
  }
  
  try {
    const { data } = await db.from('returns').select('*').eq('id', emailTargetData).single()
    if (!data) return
    
    const emoji = STATUS_EMOJI[data.status] || '📌'
    const subject = `GOR - ข้อมูลสินค้าตีกลับ ${data.tracking_number || data.id}`
    
    let body = `รายละเอียดสินค้าตีกลับ
========================
วันที่: ${data.recorded_date || '-'}
ขนส่ง: ${data.courier || '-'}
ออเดอร์: ${data.order_number || '-'}
พัสดุ: ${data.tracking_number || '-'}
เอกสาร: ${data.document_number || '-'}
บาร์โค้ด: ${data.barcode || '-'}
สภาพ: ${data.condition === 'ok' ? '✅ ไม่ชำรุด' : '❌ ชำรุด'}
${data.damage_description ? 'ส่วนที่ชำรุด: ' + data.damage_description + '\n' : ''}
สถานะ: ${emoji} ${STATUS_LABEL[data.status] || data.status}
${data.status_ref_number ? 'อ้างอิง: ' + data.status_ref_number + '\n' : ''}
${data.status_approver ? 'ผู้อนุมัติ: ' + data.status_approver + '\n' : ''}
หมายเหตุ: ${data.note || '-'}
`
    
    // Add image URLs
    const imageUrls = []
    if (data.image_product) imageUrls.push(`รูปสินค้า: ${getImageUrl(data.image_product)}`)
    if (data.image_barcode) imageUrls.push(`รูปบาร์โค้ด: ${getImageUrl(data.image_barcode)}`)
    if (data.image_label) imageUrls.push(`รูปใบปะหน้า: ${getImageUrl(data.image_label)}`)
    if (data.image_damage) imageUrls.push(`รูปชำรุด: ${getImageUrl(data.image_damage)}`)
    if (data.image_document) imageUrls.push(`รูปเอกสาร: ${getImageUrl(data.image_document)}`)
    if (data.images && data.images.length > 0) {
      data.images.forEach((url, i) => {
        imageUrls.push(`รูปเพิ่มเติม ${i + 1}: ${getImageUrl(url)}`)
      })
    }
    
    if (imageUrls.length > 0) {
      body += '\n--- รูปภาพ ---\n' + imageUrls.join('\n')
    }
    
    // Open mailto
    const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoLink, '_blank')
    
    alert('กำลังเปิด Email Client')
    closeEmailModal()
    
  } catch (e) {
    console.error('Send email error:', e)
    errorEl.textContent = 'เกิดข้อผิดพลาด'
    errorEl.style.display = 'block'
  }
}

// ============================================================
// FORM HANDLING
// ============================================================

function initForm() {
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0]
  document.getElementById('f-courier').value = ''
  document.getElementById('f-order').value = ''
  document.getElementById('f-tracking').value = ''
  document.getElementById('f-docnum').value = ''
  document.getElementById('f-barcode').value = ''
  document.getElementById('f-note').value = ''
  
  currentCondition = ''
  selectedFiles = []
  
  document.getElementById('btn-ok').className = 'cond-btn'
  document.getElementById('btn-damaged').className = 'cond-btn'
  document.getElementById('damage-detail').style.display = 'none'
  document.getElementById('damage-photo-group').style.display = 'none'
  
  // Clear previews
  const previews = ['prev-barcode', 'prev-label', 'prev-damage', 'prev-doc']
  previews.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })
  
  document.getElementById('prev-images').innerHTML = ''
  document.getElementById('f-images-label').textContent = 'ยังไม่ได้เลือกภาพ'
  
  // Reset labels
  const labels = ['f-img-barcode-label', 'f-img-label-label', 'f-img-damage-label', 'f-img-doc-label']
  labels.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.textContent = 'ยังไม่ได้เลือกภาพ'
  })
}

function setCondition(value) {
  currentCondition = value
  
  document.getElementById('btn-ok').className = 'cond-btn' + (value === 'ok' ? ' active-ok' : '')
  document.getElementById('btn-damaged').className = 'cond-btn' + (value === 'damaged' ? ' active-damaged' : '')
  
  document.getElementById('damage-detail').style.display = value === 'damaged' ? 'block' : 'none'
  document.getElementById('damage-photo-group').style.display = value === 'damaged' ? 'block' : 'none'
}

function triggerPhoto(inputId) {
  const input = document.getElementById(inputId)
  if (input) input.click()
}

function previewPhoto(inputElement, labelId, previewId) {
  if (inputElement.files && inputElement.files[0]) {
    const reader = new FileReader()
    reader.onload = function (e) {
      const preview = document.getElementById(previewId)
      if (preview) {
        preview.src = e.target.result
        preview.style.display = 'block'
      }
      const label = document.getElementById(labelId)
      if (label) label.textContent = inputElement.files[0].name
    }
    reader.readAsDataURL(inputElement.files[0])
  }
}

function previewMultiplePhotos(inputElement, labelId, containerId) {
  const container = document.getElementById(containerId)
  if (!container) return
  
  container.innerHTML = ''
  selectedFiles = Array.from(inputElement.files).slice(0, 10)
  
  const label = document.getElementById(labelId)
  if (label) label.textContent = `เลือกแล้ว ${selectedFiles.length} ภาพ`
  
  selectedFiles.forEach((file, index) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      const div = document.createElement('div')
      div.className = 'photo-grid-item'
      div.innerHTML = `
        <img src="${e.target.result}" alt="Photo ${index + 1}"/>
        <button class="remove-btn" onclick="removePhoto(${index})">✕</button>
      `
      container.appendChild(div)
    }
    reader.readAsDataURL(file)
  })
}

function removePhoto(index) {
  selectedFiles.splice(index, 1)
  
  const container = document.getElementById('prev-images')
  if (!container) return
  
  container.innerHTML = ''
  
  selectedFiles.forEach((file, i) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      const div = document.createElement('div')
      div.className = 'photo-grid-item'
      div.innerHTML = `
        <img src="${e.target.result}" alt="Photo ${i + 1}"/>
        <button class="remove-btn" onclick="removePhoto(${i})">✕</button>
      `
      container.appendChild(div)
    }
    reader.readAsDataURL(file)
  })
  
  const label = document.getElementById('f-images-label')
  if (label) label.textContent = selectedFiles.length > 0 ? `เลือกแล้ว ${selectedFiles.length} ภาพ` : 'ยังไม่ได้เลือกภาพ'
}

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

async function uploadToCloudinary(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    )
    
    const result = await response.json()
    return result.secure_url || null
  } catch (e) {
    console.error('Cloudinary upload error:', e)
    return null
  }
}

async function uploadPhoto(baseId) {
  const cameraInput = document.getElementById(baseId + '-camera')
  const galleryInput = document.getElementById(baseId + '-gallery')
  const singleInput = document.getElementById(baseId)
  
  let file = null
  
  if (cameraInput?.files?.[0]) file = cameraInput.files[0]
  if (galleryInput?.files?.[0]) file = galleryInput.files[0]
  if (!file && singleInput?.files?.[0]) file = singleInput.files[0]
  
  if (!file) return null
  
  return await uploadToCloudinary(file)
}

async function uploadMultiplePhotos() {
  if (selectedFiles.length === 0) return []
  
  const urls = []
  for (const file of selectedFiles) {
    const url = await uploadToCloudinary(file)
    if (url) urls.push(url)
  }
  return urls
}

// ============================================================
// SUBMIT FORM
// ============================================================

async function handleSubmit() {
  const date = document.getElementById('f-date').value
  const courier = document.getElementById('f-courier').value
  
  if (!date || !courier || !currentCondition) {
    alert('กรุณากรอกวันที่, ขนส่ง และสภาพสินค้า')
    return
  }
  
  const submitBtn = document.querySelector('#pg-form .btn-primary')
  const originalText = submitBtn.innerHTML
  submitBtn.textContent = 'กำลังบันทึก...'
  submitBtn.disabled = true
  
  try {
    // Upload images in parallel
    const [imageUrls, imageProduct, imageBarcode, imageLabel, imageDamage, imageDoc] = 
      await Promise.all([
        uploadMultiplePhotos(),
        uploadPhoto('f-img-product'),
        uploadPhoto('f-img-barcode'),
        uploadPhoto('f-img-label'),
        uploadPhoto('f-img-damage'),
        uploadPhoto('f-img-doc')
      ])
    
    const trackingNumber = document.getElementById('f-tracking').value.trim()
    const barcode = document.getElementById('f-barcode').value.trim()
    
    const insertData = {
      recorded_date: date,
      courier: courier,
      order_number: document.getElementById('f-order').value.trim() || null,
      tracking_number: trackingNumber || null,
      document_number: document.getElementById('f-docnum').value.trim() || null,
      barcode: barcode || null,
      condition: currentCondition,
      damage_description: document.getElementById('f-damage-desc')?.value || null,
      status: 'pending',
      note: document.getElementById('f-note').value || null,
      image_product: imageProduct,
      image_barcode: imageBarcode,
      image_label: imageLabel,
      image_damage: imageDamage,
      image_document: imageDoc,
      images: imageUrls,
      created_by: currentProfile.id,
      last_updated_by: currentProfile.id,
      last_updated_at: new Date().toISOString()
    }
    
    const { error } = await db.from('returns').insert(insertData)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      submitBtn.innerHTML = originalText
      submitBtn.disabled = false
      return
    }
    
    // Remove matching unboxed records
    if (trackingNumber) {
      await db.from('returns').delete().eq('status', 'unboxed').eq('tracking_number', trackingNumber)
    }
    if (barcode) {
      await db.from('returns').delete().eq('status', 'unboxed').eq('barcode', barcode)
    }
    
    // Update GPoint
    await updateGPoint(currentProfile.id, GPOINT_RULES.create)
    await refreshProfile()
    updateProfileUI()
    
    await addNotification(
      `📦 ${currentProfile.display_name || currentProfile.full_name} ได้บันทึกรายการพัสดุตีกลับ`,
      'info'
    )
    
    alert('บันทึกสำเร็จ! (+1 G Point)')
    showPage('home')
    
  } catch (e) {
    console.error('Submit error:', e)
    alert('เกิดข้อผิดพลาดในการบันทึก')
  } finally {
    submitBtn.innerHTML = originalText
    submitBtn.disabled = false
  }
}

// ============================================================
// AVATAR UPLOAD
// ============================================================

async function uploadAvatar(inputElement) {
  if (!inputElement.files?.[0]) return
  
  try {
    const url = await uploadToCloudinary(inputElement.files[0])
    
    if (!url) {
      alert('อัปโหลดไม่สำเร็จ')
      return
    }
    
    await db.from('profiles').update({ avatar_url: url }).eq('id', currentProfile.id)
    await refreshProfile()
    
    const avatarImg = document.getElementById('profile-avatar-img')
    const avatarDiv = document.getElementById('profile-avatar')
    
    avatarImg.src = url + '?t=' + Date.now()
    avatarImg.style.display = 'block'
    avatarDiv.style.display = 'none'
    
    alert('อัปโหลดรูปโปรไฟล์สำเร็จ!')
    
  } catch (e) {
    console.error('Upload avatar error:', e)
    alert('อัปโหลดไม่สำเร็จ')
  }
}

// ============================================================
// REWARDS
// ============================================================

async function loadRewards() {
  try {
    const [rewardsResult, redemptionsResult] = await Promise.all([
      db.from('rewards').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      db.from('redemptions').select('*').eq('user_id', currentProfile.id).order('redeemed_at', { ascending: false }).limit(10)
    ])
    
    const rewards = rewardsResult.data || []
    const redemptions = redemptionsResult.data || []
    
    let html = '<div class="section-title">🎁 ของรางวัลที่แลกได้</div>'
    
    if (rewards.length === 0) {
      html += '<p style="text-align:center;color:var(--text-sub);padding:20px">ยังไม่มีของรางวัล</p>'
    } else {
      rewards.forEach(r => {
        const isOut = r.remaining <= 0
        html += `
          <div class="reward-card" style="${isOut ? 'opacity:0.5' : ''}">
            ${r.images && r.images.length > 0 
              ? `<img src="${getImageUrl(r.images[0])}" alt="${escapeHTML(r.name)}" 
                     onclick="openRewardSlideView('${r.id}')" style="cursor:pointer" loading="lazy"/>` 
              : '<div style="width:60px;height:60px;border-radius:10px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:24px">🎁</div>'}
            <div class="reward-info" onclick="openRewardSlideView('${r.id}')" style="cursor:pointer">
              <div class="reward-name">${escapeHTML(r.name)} ${r.brand ? '— ' + escapeHTML(r.brand) : ''}</div>
              <div class="reward-desc">${escapeHTML(r.description || '')}</div>
              <div class="reward-cost">⭐ ${r.point_cost} G Point | คงเหลือ: ${r.remaining}/${r.quantity}</div>
              ${isOut ? '<div style="color:#A32D2D;font-weight:700;font-size:16px;margin-top:4px">ของรางวัลหมด</div>' : ''}
            </div>
            ${!isOut ? `
              <button class="btn-primary" style="width:auto;padding:10px 16px;font-size:12px" 
                      onclick="event.stopPropagation();redeemReward('${r.id}','${escapeHTML(r.name).replace(/'/g, "\\'")}',${r.point_cost},'${r.images?.[0] || ''}')">
                แลก
              </button>
            ` : ''}
          </div>
        `
      })
    }
    
    // Redemption history
    if (redemptions.length > 0) {
      html += '<div class="section-title" style="margin-top:20px">📜 ประวัติการแลก</div>'
      redemptions.forEach(r => {
        html += `
          <div class="return-card">
            <div style="display:flex;gap:10px;align-items:center">
              ${r.reward_image_url 
                ? `<img src="${getImageUrl(r.reward_image_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover" alt="" loading="lazy"/>` 
                : ''}
              <div>
                <div style="font-weight:600;font-size:13px">${escapeHTML(r.reward_name)}</div>
                <div style="font-size:11px;color:var(--text-sub)">⭐ ${r.point_spent} • ${new Date(r.redeemed_at).toLocaleDateString('th-TH')}</div>
              </div>
            </div>
          </div>
        `
      })
    }
    
    document.getElementById('rewards-list').innerHTML = html
    
  } catch (e) {
    console.error('Load rewards error:', e)
  }
}

async function redeemReward(rewardId, rewardName, pointCost, imageUrl) {
  if ((currentProfile.g_point || 0) < pointCost) {
    alert(`G Point ไม่พอ! คุณมี ${currentProfile.g_point || 0} แต้ม ต้องใช้ ${pointCost}`)
    return
  }
  
  if (!confirm(`ยืนยันการแลก "${rewardName}" ใช้ ${pointCost} G Point?`)) return
  
  try {
    // Insert redemption
    const { error: redemptionError } = await db.from('redemptions').insert({
      user_id: currentProfile.id,
      reward_id: rewardId,
      reward_name: rewardName,
      reward_image_url: imageUrl,
      point_spent: pointCost
    })
    
    if (redemptionError) {
      alert('เกิดข้อผิดพลาด: ' + redemptionError.message)
      return
    }
    
    // Update reward remaining (safer approach)
    const { data: reward } = await db.from('rewards').select('remaining').eq('id', rewardId).single()
    const newRemaining = Math.max(0, (reward?.remaining || 1) - 1)
    await db.from('rewards').update({ remaining: newRemaining }).eq('id', rewardId)
    
    // Deduct points
    await updateGPoint(currentProfile.id, -pointCost, 0)
    await refreshProfile()
    updateProfileUI()
    
    // Show success
    document.getElementById('redeem-success-body').innerHTML = `
      <div class="redeem-success-icon">✅</div>
      <div class="redeem-success-text">แลกรางวัลสำเร็จ!</div>
      ${imageUrl ? `<img src="${getImageUrl(imageUrl)}" class="redeem-success-img" alt=""/>` : ''}
      <div style="font-weight:700;font-size:16px;margin-bottom:4px">${escapeHTML(rewardName)}</div>
      <div style="color:var(--gold);font-weight:700">⭐ ${pointCost} G Point</div>
      <div class="redeem-success-sub" style="margin-top:12px">📸 บันทึกภาพหน้าจอและติดต่อผู้ดูแลระบบ</div>
    `
    document.getElementById('redeem-success-modal').style.display = 'flex'
    
    await addNotification(
      `🎁 ${currentProfile.display_name || currentProfile.full_name} ได้แลกของรางวัล "${rewardName}"`,
      'info'
    )
    
    loadRewards()
    
  } catch (e) {
    console.error('Redeem reward error:', e)
    alert('เกิดข้อผิดพลาดในการแลกของรางวัล')
  }
}

function closeRedeemSuccess() {
  document.getElementById('redeem-success-modal').style.display = 'none'
}

// ============================================================
// NOTIFICATIONS
// ============================================================

async function addNotification(message, type = 'info') {
  const plainMessage = message.replace(/<[^>]*>/g, '')
  
  try {
    await db.from('notifications').insert({
      message: plainMessage,
      type: type
    })
  } catch (e) {
    console.error('Add notification error:', e)
  }
}

function openNotifications() {
  loadNotifications().then(data => {
    const container = document.getElementById('noti-body')
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-sub);padding:20px">ยังไม่มีการแจ้งเตือน</p>'
    } else {
      container.innerHTML = data.map(n => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:10px 0;border-bottom:0.5px solid var(--border)">
          <div style="flex:1">
            <div style="font-size:13px">${escapeHTML(n.message)}</div>
            <div style="font-size:10px;color:var(--text-sub);margin-top:4px">
              ${new Date(n.created_at).toLocaleString('th-TH')}
            </div>
          </div>
          ${currentProfile.role === 'admin' ? `
            <button class="btn-small btn-delete" onclick="deleteNotification('${n.id}')" style="flex-shrink:0">
              <i class="ti ti-trash"></i>
            </button>
          ` : ''}
        </div>
      `).join('')
    }
    
    document.getElementById('noti-modal').style.display = 'flex'
    
    // Mark as read
    db.from('notifications').update({ is_read: true }).eq('is_read', false)
      .then(() => {})
      .catch(() => {})
  }).catch(e => {
    console.error('Open notifications error:', e)
  })
}

async function loadNotifications() {
  try {
    const { data } = await db.from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    
    // Update badge
    if (data) {
      const unreadCount = data.filter(n => !n.is_read).length
      const badge = document.getElementById('noti-badge')
      
      if (unreadCount > 0) {
        badge.style.display = 'flex'
        badge.textContent = unreadCount
      } else {
        badge.style.display = 'none'
      }
    }
    
    return data
  } catch (e) {
    console.error('Load notifications error:', e)
    return null
  }
}

async function deleteNotification(id) {
  try {
    await db.from('notifications').delete().eq('id', id)
    openNotifications()
  } catch (e) {
    console.error('Delete notification error:', e)
  }
}

function closeNotifications() {
  document.getElementById('noti-modal').style.display = 'none'
}

// ============================================================
// SCANNER
// ============================================================

function playBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    const oscillator1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    oscillator1.connect(gain1)
    gain1.connect(audioContext.destination)
    oscillator1.frequency.value = 1200
    oscillator1.type = 'sine'
    gain1.gain.value = 0.15
    oscillator1.start()
    oscillator1.stop(audioContext.currentTime + 0.1)
    
    const oscillator2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    oscillator2.connect(gain2)
    gain2.connect(audioContext.destination)
    oscillator2.frequency.value = 800
    oscillator2.type = 'sine'
    gain2.gain.value = 0.15
    oscillator2.start(audioContext.currentTime + 0.12)
    oscillator2.stop(audioContext.currentTime + 0.25)
  } catch (e) {
    // Beep not supported
  }
}

async function loadScanner() {
  if (window.Html5Qrcode) return
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/html5-qrcode'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function startScan(targetId) {
  scanTarget = targetId
  
  try {
    await loadScanner()
  } catch (e) {
    alert('ไม่สามารถโหลดระบบสแกนได้')
    return
  }
  
  document.getElementById('scanner-modal').style.display = 'flex'
  
  try {
    html5QrCode = new Html5Qrcode("scanner-video")
    
    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText) => {
        const targetInput = document.getElementById(scanTarget)
        if (targetInput) targetInput.value = decodedText
        playBeep()
        stopScan()
      },
      () => {
        // Scanning failed (ignore)
      }
    )
  } catch (e) {
    console.error('Scanner error:', e)
    alert('ไม่สามารถเข้าถึงกล้องได้')
    stopScan()
  }
}

function stopScan() {
  if (html5QrCode) {
    html5QrCode.stop()
      .then(() => { html5QrCode = null })
      .catch(() => { html5QrCode = null })
  }
  document.getElementById('scanner-modal').style.display = 'none'
}

// ============================================================
// UNBOXED FORM
// ============================================================

function openUnboxedForm() {
  unboxedFiles = []
  document.getElementById('ub-barcode').value = ''
  document.getElementById('prev-ub-images').innerHTML = ''
  document.getElementById('ub-images-label').textContent = 'ยังไม่ได้เลือกภาพ'
  document.getElementById('unboxed-modal').style.display = 'flex'
}

function closeUnboxedForm() {
  document.getElementById('unboxed-modal').style.display = 'none'
}

function previewMultipleUnboxedPhotos(inputElement) {
  const container = document.getElementById('prev-ub-images')
  if (!container) return
  
  container.innerHTML = ''
  unboxedFiles = Array.from(inputElement.files).slice(0, 5)
  
  document.getElementById('ub-images-label').textContent = `เลือกแล้ว ${unboxedFiles.length} ภาพ`
  
  unboxedFiles.forEach((file, index) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      const div = document.createElement('div')
      div.className = 'photo-grid-item'
      div.innerHTML = `
        <img src="${e.target.result}" alt="Unboxed ${index + 1}"/>
        <button class="remove-btn" onclick="removeUnboxedPhoto(${index})">✕</button>
      `
      container.appendChild(div)
    }
    reader.readAsDataURL(file)
  })
}

function removeUnboxedPhoto(index) {
  unboxedFiles.splice(index, 1)
  
  const container = document.getElementById('prev-ub-images')
  if (!container) return
  
  container.innerHTML = ''
  
  unboxedFiles.forEach((file, i) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      const div = document.createElement('div')
      div.className = 'photo-grid-item'
      div.innerHTML = `
        <img src="${e.target.result}" alt="Unboxed ${i + 1}"/>
        <button class="remove-btn" onclick="removeUnboxedPhoto(${i})">✕</button>
      `
      container.appendChild(div)
    }
    reader.readAsDataURL(file)
  })
}

async function submitUnboxed() {
  const barcode = document.getElementById('ub-barcode').value.trim()
  
  if (!barcode) {
    alert('กรุณาสแกนหรือกรอกบาร์โค้ด')
    return
  }
  
  // Check if barcode already exists in non-unboxed status
  try {
    const { data: existing } = await db.from('returns')
      .select('id')
      .neq('status', 'unboxed')
      .eq('barcode', barcode)
      .limit(1)
    
    if (existing && existing.length > 0) {
      alert('บาร์โค้ดนี้ถูกบันทึกในสถานะอื่นแล้ว')
      return
    }
    
    // Upload images
    const imageUrls = []
    for (const file of unboxedFiles) {
      const url = await uploadToCloudinary(file)
      if (url) imageUrls.push(url)
    }
    
    const { error } = await db.from('returns').insert({
      recorded_date: new Date().toISOString().split('T')[0],
      courier: 'ยังไม่ระบุ',
      tracking_number: barcode,
      barcode: barcode,
      condition: 'ok',
      status: 'unboxed',
      images: imageUrls,
      created_by: currentProfile.id,
      last_updated_by: currentProfile.id,
      last_updated_at: new Date().toISOString()
    })
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    alert('บันทึกพัสดุยังไม่แกะสำเร็จ!')
    closeUnboxedForm()
    showPage('home')
    
  } catch (e) {
    console.error('Submit unboxed error:', e)
    alert('เกิดข้อผิดพลาดในการบันทึก')
  }
}

// ============================================================
// PRINT QR CODE
// ============================================================

function printQRCode() {
  if (!selectedReturnId) return
  
  db.from('returns').select('*').eq('id', selectedReturnId).single().then(({ data }) => {
    if (!data) return
    
    const printWindow = window.open('', '_blank', 'width=595,height=842')
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GOR — ${escapeHTML(data.tracking_number || data.id)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; padding: 20px; color: #1A1D23; font-size: 12px; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #3B6D11; padding-bottom: 12px; }
          .header h2 { color: #3B6D11; margin: 4px 0; font-size: 18px; }
          .header p { color: #BA7517; font-size: 11px; margin: 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 6px 0; border-bottom: 1px dashed #E5E7EB; }
          .info-label { font-weight: 600; color: #6B7280; font-size: 10px; text-transform: uppercase; }
          .info-value { font-weight: 600; font-size: 13px; }
          .qr-section { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 2px solid #3B6D11; }
          .qr-section img { width: 150px; height: 150px; }
          .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #9CA3AF; }
          @media print { body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>GH Online Return</h2>
          <p>GBH ONLINE RETURN</p>
        </div>
        <div class="info-row">
          <div class="info-label">วันที่</div>
          <div class="info-value">${data.recorded_date || '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">เลขที่ออเดอร์</div>
          <div class="info-value">${escapeHTML(data.order_number || '-')}</div>
        </div>
        <div class="info-row">
          <div class="info-label">เลขที่พัสดุ</div>
          <div class="info-value">${escapeHTML(data.tracking_number || '-')}</div>
        </div>
        <div class="info-row">
          <div class="info-label">เลขที่บิลขาย</div>
          <div class="info-value">${escapeHTML(data.document_number || '-')}</div>
        </div>
        <div class="info-row">
          <div class="info-label">รหัสสินค้า</div>
          <div class="info-value">${escapeHTML(data.barcode || '-')}</div>
        </div>
        <div class="info-row">
          <div class="info-label">ขนส่ง</div>
          <div class="info-value">${escapeHTML(data.courier || '-')}</div>
        </div>
        <div class="qr-section">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.tracking_number || data.id)}" alt="QR Code"/>
          <div style="font-size:11px;color:#6B7280;margin-top:4px">สแกนเพื่อค้นหา: ${escapeHTML(data.tracking_number || data.id)}</div>
        </div>
        <div class="footer">GOR — Designed & Developed by Mix Thompson</div>
      </body>
      </html>
    `)
    
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }).catch(e => {
    console.error('Print QR error:', e)
  })
}

// ============================================================
// IMAGE VIEWER
// ============================================================

function openImageViewer(imageUrl, label) {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.style.display = 'flex'
  modal.style.zIndex = '3000'
  modal.style.background = 'rgba(0,0,0,0.9)'
  modal.style.cursor = 'zoom-out'
  
  modal.onclick = function () { modal.remove() }
  
  modal.innerHTML = `
    <div style="text-align:center;max-width:90%;max-height:90vh">
      <div style="color:white;font-size:14px;margin-bottom:12px">${escapeHTML(label)}</div>
      <img src="${imageUrl}" style="max-width:100%;max-height:80vh;border-radius:12px;object-fit:contain" 
           onclick="event.stopPropagation()" alt="${escapeHTML(label)}"/>
      <div style="color:white;font-size:12px;margin-top:12px;opacity:0.7">กดที่ใดก็ได้เพื่อปิด</div>
    </div>
  `
  
  document.body.appendChild(modal)
}

// ============================================================
// USER INFO
// ============================================================

async function openUserInfo(userId) {
  if (!userId) {
    alert('ไม่พบข้อมูลผู้ใช้')
    return
  }
  
  try {
    const { data: profile } = await db.from('profiles').select('*').eq('id', userId).single()
    
    if (!profile) {
      alert('ไม่พบข้อมูลผู้ใช้นี้')
      return
    }
    
    const rank = getRank(profile.total_exp || 0)
    
    document.getElementById('user-info-body').innerHTML = `
      <div style="text-align:center">
        ${profile.avatar_url 
          ? `<img src="${getImageUrl(profile.avatar_url)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:8px" alt=""/>` 
          : `<div style="width:80px;height:80px;border-radius:50%;background:var(--primary);color:white;font-size:32px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">
              ${(profile.display_name || profile.full_name || '?').charAt(0).toUpperCase()}
            </div>`}
        <div style="font-weight:700;font-size:16px">${escapeHTML(profile.display_name || profile.full_name || 'ไม่ระบุชื่อ')}</div>
        <div style="color:var(--text-sub);font-size:13px">${ROLE_LABEL[profile.role] || 'ไม่ระบุ'}</div>
        <div style="font-size:14px;margin-top:4px">${rank.icon} ${rank.name}</div>
        <div style="font-size:13px;color:var(--gold);margin-top:4px">⭐ ${profile.g_point || 0} G Point</div>
      </div>
    `
    
    document.getElementById('user-info-modal').style.display = 'flex'
    
  } catch (e) {
    console.error('Open user info error:', e)
    alert('ไม่พบข้อมูลผู้ใช้นี้')
  }
}

function closeUserInfo() {
  document.getElementById('user-info-modal').style.display = 'none'
}

// ============================================================
// RANK INFO
// ============================================================

function openRankInfo() {
  let html = `
    <div style="margin-bottom:16px"><strong>📋 วิธีรับ G Point</strong></div>
    <div style="font-size:13px;color:var(--text-sub);line-height:1.8">
      📝 บันทึกใหม่ = <strong>+1</strong><br>
      ⏳→✅ ทำคืนแล้ว = <strong>+1</strong><br>
      🔧→📄 ทำชำรุดแล้ว = <strong>+3</strong><br>
      📬→📋 รับเคลมแล้ว = <strong>+1</strong><br>
      🗑️ ลบ = <strong>คืนตามสถานะ</strong><br>
      📦 พัสดุยังไม่แกะ = <strong>ไม่ได้รับแต้ม</strong>
    </div>
    <div style="margin-top:16px;margin-bottom:8px"><strong>🏆 ระดับแรงค์</strong></div>
  `
  
  RANK_CONFIG.forEach(r => {
    html += `
      <div class="rank-list-item">
        <div class="rank-icon">${r.icon}</div>
        <div class="rank-info">
          <div class="rank-name">${r.name}</div>
          <div class="rank-range">${r.min} - ${r.max} EXP</div>
        </div>
      </div>
    `
  })
  
  html += '<div style="font-size:12px;color:var(--text-sub);margin-top:8px">💡 EXP = G Point สะสมทั้งหมด</div>'
  
  document.getElementById('rank-info-body').innerHTML = html
  document.getElementById('rank-info-modal').style.display = 'flex'
}

function closeRankInfo() {
  document.getElementById('rank-info-modal').style.display = 'none'
}

// ============================================================
// ADMIN FUNCTIONS
// ============================================================

async function loadUsers() {
  try {
    const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false })
    
    const container = document.getElementById('users-list')
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-sub);padding:20px">ไม่มีสมาชิก</p>'
      return
    }
    
    container.innerHTML = data.map(user => `
      <div class="user-card">
        <div class="return-card-top">
          <div>
            <div class="user-name">${escapeHTML(user.display_name || user.full_name || 'ไม่ระบุชื่อ')}</div>
            <div class="user-email">⭐ ${user.g_point || 0} G Point • ${user.created_at?.split('T')[0] || ''}</div>
          </div>
          <span class="badge ${user.role === 'admin' ? 'b-blue' : user.role === 'staff' ? 'b-green' : 'b-yellow'}">
            ${ROLE_LABEL[user.role] || user.role}
          </span>
        </div>
        <div class="role-btn-row">
          ${user.role !== 'staff' ? `<button class="role-btn green" onclick="setUserRole('${user.id}','staff')">อนุมัติเป็นพนักงาน</button>` : ''}
          ${user.role !== 'admin' ? `<button class="role-btn blue" onclick="setUserRole('${user.id}','admin')">ตั้งเป็น Admin</button>` : ''}
          ${user.role !== 'pending' ? `<button class="role-btn red" onclick="setUserRole('${user.id}','pending')">ระงับสิทธิ์</button>` : ''}
        </div>
      </div>
    `).join('')
    
  } catch (e) {
    console.error('Load users error:', e)
  }
}

async function setUserRole(userId, role) {
  try {
    const { error } = await db.from('profiles').update({ role }).eq('id', userId)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    alert('อัปเดตสิทธิ์สำเร็จ!')
    loadUsers()
    
  } catch (e) {
    console.error('Set user role error:', e)
    alert('เกิดข้อผิดพลาด')
  }
}

// ============================================================
// ADMIN REWARDS
// ============================================================

function openAddReward() {
  document.getElementById('reward-secret').value = ''
  document.getElementById('reward-secret-error').style.display = 'none'
  document.getElementById('reward-form').style.display = 'none'
  document.getElementById('btn-verify-secret').style.display = 'flex'
  document.getElementById('add-reward-modal').style.display = 'flex'
  
  rewardSelectedFiles = []
  document.getElementById('prev-reward-images').innerHTML = ''
  document.getElementById('reward-slide').style.display = 'none'
}

function closeAddReward() {
  document.getElementById('add-reward-modal').style.display = 'none'
}

function verifySecret() {
  const secret = document.getElementById('reward-secret').value
  
  if (secret === ADMIN_SECRET) {
    document.getElementById('reward-secret-error').style.display = 'none'
    document.getElementById('reward-form').style.display = 'block'
    document.getElementById('btn-verify-secret').style.display = 'none'
  } else {
    document.getElementById('reward-secret-error').textContent = 'รหัสลับไม่ถูกต้อง'
    document.getElementById('reward-secret-error').style.display = 'block'
  }
}

function previewMultipleRewardPhotos(inputElement) {
  const container = document.getElementById('prev-reward-images')
  if (!container) return
  
  container.innerHTML = ''
  rewardSelectedFiles = Array.from(inputElement.files).slice(0, 5)
  
  document.getElementById('reward-image-label').textContent = `เลือกแล้ว ${rewardSelectedFiles.length} ภาพ (สูงสุด 5)`
  
  rewardSelectedFiles.forEach((file, index) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      const div = document.createElement('div')
      div.className = 'photo-grid-item'
      div.innerHTML = `
        <img src="${e.target.result}" onclick="showRewardSlide(${index})" alt="Reward ${index + 1}"/>
        <button class="remove-btn" onclick="removeRewardPhoto(${index})">✕</button>
      `
      container.appendChild(div)
    }
    reader.readAsDataURL(file)
  })
  
  if (rewardSelectedFiles.length > 0) {
    document.getElementById('reward-slide').style.display = 'block'
    showRewardSlide(0)
  }
}

function removeRewardPhoto(index) {
  rewardSelectedFiles.splice(index, 1)
  
  const container = document.getElementById('prev-reward-images')
  if (!container) return
  
  container.innerHTML = ''
  
  rewardSelectedFiles.forEach((file, i) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      const div = document.createElement('div')
      div.className = 'photo-grid-item'
      div.innerHTML = `
        <img src="${e.target.result}" onclick="showRewardSlide(${i})" alt="Reward ${i + 1}"/>
        <button class="remove-btn" onclick="removeRewardPhoto(${i})">✕</button>
      `
      container.appendChild(div)
    }
    reader.readAsDataURL(file)
  })
  
  if (rewardSelectedFiles.length === 0) {
    document.getElementById('reward-slide').style.display = 'none'
  } else {
    showRewardSlide(0)
  }
}

function showRewardSlide(index) {
  rewardSlideIndex = index
  const file = rewardSelectedFiles[index]
  
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = function (e) {
    document.getElementById('reward-slide-img').src = e.target.result
    document.getElementById('reward-slide-count').textContent = `${index + 1} / ${rewardSelectedFiles.length}`
  }
  reader.readAsDataURL(file)
}

function prevRewardSlide() {
  if (rewardSelectedFiles.length === 0) return
  rewardSlideIndex = (rewardSlideIndex - 1 + rewardSelectedFiles.length) % rewardSelectedFiles.length
  showRewardSlide(rewardSlideIndex)
}

function nextRewardSlide() {
  if (rewardSelectedFiles.length === 0) return
  rewardSlideIndex = (rewardSlideIndex + 1) % rewardSelectedFiles.length
  showRewardSlide(rewardSlideIndex)
}

async function saveReward() {
  const name = document.getElementById('reward-name').value.trim()
  const brand = document.getElementById('reward-brand').value.trim()
  const desc = document.getElementById('reward-desc').value.trim()
  const quantity = parseInt(document.getElementById('reward-quantity').value) || 1
  const cost = parseInt(document.getElementById('reward-cost').value)
  
  if (!name || !cost || cost < 1) {
    alert('กรุณากรอกข้อมูลให้ครบ')
    return
  }
  
  try {
    const rewardImages = []
    for (const file of rewardSelectedFiles) {
      const url = await uploadToCloudinary(file)
      if (url) rewardImages.push(url)
    }
    
    const { error } = await db.from('rewards').insert({
      name,
      brand,
      description: desc,
      quantity,
      remaining: quantity,
      point_cost: cost,
      image_url: rewardImages[0] || null,
      images: rewardImages,
      created_by: currentProfile.id
    })
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    alert('เพิ่มของรางวัลสำเร็จ!')
    closeAddReward()
    loadAdminRewards()
    
    rewardSelectedFiles = []
    document.getElementById('reward-slide').style.display = 'none'
    
  } catch (e) {
    console.error('Save reward error:', e)
    alert('เกิดข้อผิดพลาดในการบันทึก')
  }
}

async function loadAdminRewards() {
  try {
    const { data } = await db.from('rewards').select('*').order('created_at', { ascending: false })
    
    const container = document.getElementById('admin-rewards-list')
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:var(--text-sub);font-size:13px;padding:12px 0">ยังไม่มีของรางวัล</p>'
      return
    }
    
    container.innerHTML = data.map(r => `
      <div class="reward-card">
        ${r.images && r.images.length > 0 
          ? `<img src="${getImageUrl(r.images[0])}" alt="" loading="lazy"/>` 
          : '<div style="width:60px;height:60px;border-radius:10px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:24px">🎁</div>'}
        <div class="reward-info">
          <div class="reward-name">${escapeHTML(r.name)} ${r.brand ? '— ' + escapeHTML(r.brand) : ''} ${!r.is_active ? '(ปิดใช้งาน)' : ''}</div>
          <div class="reward-cost">⭐ ${r.point_cost} G Point | ${r.remaining}/${r.quantity}</div>
        </div>
        <button class="btn-small btn-edit" onclick="editReward('${r.id}')"><i class="ti ti-edit"></i> แก้ไข</button>
        <button class="btn-small btn-delete" onclick="openDeleteReward('${r.id}')"><i class="ti ti-trash"></i> ลบ</button>
      </div>
    `).join('')
    
  } catch (e) {
    console.error('Load admin rewards error:', e)
  }
}

function editReward(id) {
  editRewardId = id
  document.getElementById('edit-reward-secret').value = ''
  document.getElementById('edit-reward-secret-error').style.display = 'none'
  document.getElementById('edit-reward-form').style.display = 'none'
  document.getElementById('btn-verify-edit-secret').style.display = 'flex'
  document.getElementById('edit-reward-modal').style.display = 'flex'
}

function closeEditReward() {
  document.getElementById('edit-reward-modal').style.display = 'none'
  editRewardId = null
}

function verifyEditSecret() {
  const secret = document.getElementById('edit-reward-secret').value
  
  if (secret === ADMIN_SECRET) {
    document.getElementById('edit-reward-secret-error').style.display = 'none'
    document.getElementById('edit-reward-form').style.display = 'block'
    document.getElementById('btn-verify-edit-secret').style.display = 'none'
    
    // Load reward data
    db.from('rewards').select('*').eq('id', editRewardId).single().then(({ data }) => {
      if (data) {
        document.getElementById('edit-reward-name').value = data.name || ''
        document.getElementById('edit-reward-brand').value = data.brand || ''
        document.getElementById('edit-reward-desc').value = data.description || ''
        document.getElementById('edit-reward-cost').value = data.point_cost || ''
        document.getElementById('edit-reward-quantity').value = data.quantity || ''
        document.getElementById('edit-reward-remaining').value = data.remaining || ''
      }
    }).catch(() => {})
  } else {
    document.getElementById('edit-reward-secret-error').textContent = 'รหัสลับไม่ถูกต้อง'
    document.getElementById('edit-reward-secret-error').style.display = 'block'
  }
}

async function saveEditReward() {
  if (!editRewardId) return
  
  const name = document.getElementById('edit-reward-name').value.trim()
  const brand = document.getElementById('edit-reward-brand').value.trim()
  const desc = document.getElementById('edit-reward-desc').value.trim()
  const quantity = parseInt(document.getElementById('edit-reward-quantity').value) || 1
  const remaining = parseInt(document.getElementById('edit-reward-remaining').value) || 0
  const cost = parseInt(document.getElementById('edit-reward-cost').value)
  
  if (!name || !cost || cost < 1) {
    alert('กรุณากรอกข้อมูลให้ครบ')
    return
  }
  
  try {
    let imageUrl = null
    const imageInput = document.getElementById('edit-reward-image')
    
    if (imageInput?.files?.[0]) {
      imageUrl = await uploadToCloudinary(imageInput.files[0])
    }
    
    const updates = {
      name,
      brand,
      description: desc,
      quantity,
      remaining,
      point_cost: cost
    }
    
    if (imageUrl) {
      updates.image_url = imageUrl
      updates.images = [imageUrl]
    }
    
    const { error } = await db.from('rewards').update(updates).eq('id', editRewardId)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    alert('แก้ไขสำเร็จ!')
    closeEditReward()
    loadAdminRewards()
    
  } catch (e) {
    console.error('Save edit reward error:', e)
    alert('เกิดข้อผิดพลาดในการบันทึก')
  }
}

function openDeleteReward(id) {
  deleteRewardId = id
  document.getElementById('delete-reward-secret').value = ''
  document.getElementById('delete-reward-error').style.display = 'none'
  document.getElementById('delete-reward-modal').style.display = 'flex'
}

function closeDeleteReward() {
  document.getElementById('delete-reward-modal').style.display = 'none'
  deleteRewardId = null
}

async function confirmDeleteReward() {
  const secret = document.getElementById('delete-reward-secret').value
  const errorEl = document.getElementById('delete-reward-error')
  
  errorEl.style.display = 'none'
  
  if (secret !== ADMIN_SECRET) {
    errorEl.textContent = 'รหัสลับไม่ถูกต้อง'
    errorEl.style.display = 'block'
    return
  }
  
  try {
    const { error } = await db.from('rewards').delete().eq('id', deleteRewardId)
    
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message)
      return
    }
    
    alert('ลบของรางวัลสำเร็จ!')
    closeDeleteReward()
    loadAdminRewards()
    
  } catch (e) {
    console.error('Delete reward error:', e)
    alert('เกิดข้อผิดพลาด')
  }
}

// ============================================================
// REPORT MODAL
// ============================================================

function openReportModal() {
  document.getElementById('report-title').value = ''
  document.getElementById('report-desc').value = ''
  document.getElementById('report-contact').value = ''
  document.getElementById('prev-report').style.display = 'none'
  document.getElementById('report-modal').style.display = 'flex'
}

function closeReportModal() {
  document.getElementById('report-modal').style.display = 'none'
}

async function submitReport() {
  const title = document.getElementById('report-title').value.trim()
  const desc = document.getElementById('report-desc').value.trim()
  const contact = document.getElementById('report-contact').value.trim()
  
  if (!title || !desc) {
    alert('กรุณากรอกชื่อเรื่องและรายละเอียด')
    return
  }
  
  try {
    const imageUrl = await uploadPhoto('report-image')
    
    const { error } = await db.from('reports').insert({
      title,
      description: desc,
      contact,
      image_url: imageUrl,
      status: 'found',
      created_by: currentProfile.id
    })
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
      return
    }
    
    await addNotification(
      `🐛 ${currentProfile.display_name || currentProfile.full_name} รายงานปัญหา: ${title}`,
      'info'
    )
    
    alert('ส่งรายงานปัญหาเรียบร้อยแล้ว!')
    closeReportModal()
    
  } catch (e) {
    console.error('Submit report error:', e)
    alert('เกิดข้อผิดพลาดในการส่งรายงาน')
  }
}

// ============================================================
// UPDATE LOG
// ============================================================

function openUpdateLog() {
  document.getElementById('update-log-body').innerHTML = `
    <div style="line-height:2">
      <strong>🆕 GOR v3.1 — ปรับปรุงประสิทธิภาพ & ความปลอดภัย</strong><br><br>
      ✅ <strong>ลืมรหัสผ่าน</strong> — รีเซ็ตผ่านอีเมล<br>
      ✅ <strong>อนุมัติอัตโนมัติ</strong> — Staff ทันทีเมื่อสมัคร<br>
      ✅ <strong>พัสดุยังไม่แกะ</strong> — สแกน + แนบรูป<br>
      ✅ <strong>รายงานปัญหา</strong> — ส่งตรงถึงผู้ดูแล<br>
      ✅ <strong>ค้นหาเร็วขึ้น 3 เท่า!</strong><br>
      ✅ <strong>แสดงชื่อผู้บันทึก</strong> — โหลดแบบ Bulk<br>
      ✅ <strong>Print QR Code</strong> — พิมพ์ข้อมูลพัสดุ<br>
      ✅ <strong>PWA ติดตั้งได้</strong> — ใช้เหมือนแอป<br>
      ✅ <strong>ความปลอดภัยเพิ่มขึ้น</strong> — ป้องกัน XSS<br>
      ✅ <strong>ประสิทธิภาพดีขึ้น</strong> — โหลดข้อมูลเร็วขึ้น<br>
    </div>
  `
  document.getElementById('update-log-modal').style.display = 'flex'
}

function closeUpdateLog() {
  document.getElementById('update-log-modal').style.display = 'none'
}

// ============================================================
// REWARD SLIDE VIEW
// ============================================================

async function openRewardSlideView(rewardId) {
  try {
    const { data } = await db.from('rewards').select('*').eq('id', rewardId).single()
    
    if (!data || !data.images || data.images.length === 0) return
    
    const images = data.images
    let currentIdx = 0
    
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.display = 'flex'
    modal.style.zIndex = '2000'
    modal.onclick = function (e) {
      if (e.target === modal) modal.remove()
    }
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width:450px;text-align:center">
        <div class="modal-header">
          <h3>📸 ${escapeHTML(data.name)}</h3>
          <button class="icon-btn" onclick="this.closest('.modal-overlay').remove()">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <div class="modal-body" style="position:relative">
          <img id="reward-slide-view-img" src="${getImageUrl(images[0])}" 
               style="max-width:100%;max-height:350px;border-radius:12px;object-fit:cover" alt=""/>
          ${images.length > 1 ? `
            <button id="reward-slide-prev" 
                    style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:34px;height:34px;font-size:18px;cursor:pointer">‹</button>
            <button id="reward-slide-next" 
                    style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:34px;height:34px;font-size:18px;cursor:pointer">›</button>
          ` : ''}
          <div id="reward-slide-view-count" style="margin-top:8px;font-size:12px;color:var(--text-sub)">
            1 / ${images.length}
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    if (images.length > 1) {
      const prevBtn = modal.querySelector('#reward-slide-prev')
      const nextBtn = modal.querySelector('#reward-slide-next')
      const img = modal.querySelector('#reward-slide-view-img')
      const count = modal.querySelector('#reward-slide-view-count')
      
      prevBtn.onclick = function () {
        currentIdx = (currentIdx - 1 + images.length) % images.length
        img.src = getImageUrl(images[currentIdx])
        count.textContent = `${currentIdx + 1} / ${images.length}`
      }
      
      nextBtn.onclick = function () {
        currentIdx = (currentIdx + 1) % images.length
        img.src = getImageUrl(images[currentIdx])
        count.textContent = `${currentIdx + 1} / ${images.length}`
      }
    }
    
  } catch (e) {
    console.error('Open reward slide error:', e)
  }
}

// ============================================================
// TRACK CLAIM
// ============================================================

function trackClaim() {
  window.open('https://app.djingplatform.com/dashboard/productclaims/', '_blank')
}

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
  // Load saved theme
  loadTheme()
  
  // Check for password reset flow
  checkResetFlow()
  
  // Check existing session
  try {
    const { data: { session } } = await db.auth.getSession()
    
    if (session) {
      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      if (profile && profile.role !== 'pending') {
        currentProfile = profile
        enterApp()
        return
      }
    }
  } catch (e) {
    console.error('Init session check error:', e)
  }
  
  // Show login page
  showAuth('page-login')
  
  // Load notifications for badge
  if (currentProfile?.role === 'admin') {
    loadNotifications().catch(() => {})
  }
}

// ============================================================
// EXPORT TO GLOBAL SCOPE
// ============================================================

window.handleLogin = handleLogin
window.handleRegister = handleRegister
window.handleLogout = handleLogout
window.showAuth = showAuth
window.showPage = showPage
window.toggleTheme = toggleTheme
window.forgotPassword = forgotPassword
window.handleResetPassword = handleResetPassword
window.togglePassword = togglePassword
window.setCondition = setCondition
window.triggerPhoto = triggerPhoto
window.previewPhoto = previewPhoto
window.previewMultiplePhotos = previewMultiplePhotos
window.removePhoto = removePhoto
window.handleSubmit = handleSubmit
window.startScan = startScan
window.stopScan = stopScan
window.setFilter = setFilter
window.handleSearch = handleSearch
window.setUserRole = setUserRole
window.openDetail = openDetail
window.closeDetail = closeDetail
window.saveDetail = saveDetail
window.openImageViewer = openImageViewer
window.openStatusUpdate = openStatusUpdate
window.closeStatusModal = closeStatusModal
window.submitStatusUpdate = submitStatusUpdate
window.openDeleteModal = openDeleteModal
window.closeDeleteModal = closeDeleteModal
window.confirmDelete = confirmDelete
window.openEmailModal = openEmailModal
window.closeEmailModal = closeEmailModal
window.sendEmail = sendEmail
window.trackClaim = trackClaim
window.openUserInfo = openUserInfo
window.closeUserInfo = closeUserInfo
window.openRankInfo = openRankInfo
window.closeRankInfo = closeRankInfo
window.uploadAvatar = uploadAvatar
window.openAddReward = openAddReward
window.closeAddReward = closeAddReward
window.verifySecret = verifySecret
window.previewMultipleRewardPhotos = previewMultipleRewardPhotos
window.removeRewardPhoto = removeRewardPhoto
window.showRewardSlide = showRewardSlide
window.prevRewardSlide = prevRewardSlide
window.nextRewardSlide = nextRewardSlide
window.saveReward = saveReward
window.redeemReward = redeemReward
window.closeRedeemSuccess = closeRedeemSuccess
window.openRewardSlideView = openRewardSlideView
window.openNotifications = openNotifications
window.closeNotifications = closeNotifications
window.deleteNotification = deleteNotification
window.editReward = editReward
window.closeEditReward = closeEditReward
window.verifyEditSecret = verifyEditSecret
window.saveEditReward = saveEditReward
window.openDeleteReward = openDeleteReward
window.closeDeleteReward = closeDeleteReward
window.confirmDeleteReward = confirmDeleteReward
window.openUpdateLog = openUpdateLog
window.closeUpdateLog = closeUpdateLog
window.openReportModal = openReportModal
window.closeReportModal = closeReportModal
window.submitReport = submitReport
window.openUnboxedForm = openUnboxedForm
window.closeUnboxedForm = closeUnboxedForm
window.previewMultipleUnboxedPhotos = previewMultipleUnboxedPhotos
window.removeUnboxedPhoto = removeUnboxedPhoto
window.submitUnboxed = submitUnboxed
window.printQRCode = printQRCode

// ============================================================
// START APP
// ============================================================

init()