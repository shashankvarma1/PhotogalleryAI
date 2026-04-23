'use client';
// app/profile/page.js

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

const AVATAR_COLORS = ['#111','#e11d48','#7c3aed','#2563eb','#059669','#d97706','#db2777'];

function Field({ label, value, onChange, type = 'text', placeholder, hint, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display:'block', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color: focused ? '#111' : 'rgba(17,17,17,0.4)', marginBottom:7, transition:'color 0.2s' }}>
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} rows={3} disabled={disabled}
          style={{ width:'100%', padding:'12px 16px', background: focused ? '#fff' : 'rgba(17,17,17,0.03)', border:`1.5px solid ${focused ? 'rgba(17,17,17,0.5)' : 'rgba(17,17,17,0.12)'}`, borderRadius:12, outline:'none', fontFamily:"'Syne',sans-serif", fontSize:13, color:'#111', resize:'vertical', transition:'border-color 0.2s, background 0.2s', opacity: disabled ? 0.5 : 1 }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} disabled={disabled}
          style={{ width:'100%', padding:'12px 16px', background: focused ? '#fff' : 'rgba(17,17,17,0.03)', border:`1.5px solid ${focused ? 'rgba(17,17,17,0.5)' : 'rgba(17,17,17,0.12)'}`, borderRadius:12, outline:'none', fontFamily:"'Syne',sans-serif", fontSize:13, color:'#111', transition:'border-color 0.2s, background 0.2s', opacity: disabled ? 0.5 : 1 }} />
      )}
      {hint && <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.35)', marginTop:5, lineHeight:1.5 }}>{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ background:'#faf8f4', border:'1px solid rgba(17,17,17,0.08)', borderRadius:20, padding:'28px', marginBottom:20 }}>
      <div style={{ marginBottom:20, paddingBottom:16, borderBottom:'1px solid rgba(17,17,17,0.07)' }}>
        <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:20, fontStyle:'italic', color:'#111', margin:'0 0 4px' }}>{title}</h2>
        {subtitle && <p style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'rgba(17,17,17,0.45)', margin:0 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  const [profile, setProfile]   = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [bio, setBio]           = useState('');
  const [email, setEmail]       = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarColor, setAvatarColor] = useState('#111');

  // Password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwds, setShowPwds]     = useState(false);

  // UI state
  const [saving, setSaving]         = useState(false);
  const [savingPwd, setSavingPwd]   = useState(false);
  const [msg, setMsg]               = useState('');
  const [pwdMsg, setPwdMsg]         = useState('');
  const [activeTab, setActiveTab]   = useState('profile');

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.user) {
        setProfile(data.user);
        setStats(data.stats);
        setFullName(data.user.full_name || '');
        setBio(data.user.bio || '');
        setEmail(data.user.email || '');
        setAvatarUrl(data.user.avatar_url || '');
      }
    } catch {}
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, bio, email, avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('✓ Profile updated!');
        setProfile(prev => ({ ...prev, full_name: fullName, bio, email, avatar_url: avatarUrl }));
      } else {
        setMsg('✗ ' + (data.error || 'Something went wrong'));
      }
    } catch {
      setMsg('✗ Network error');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const savePassword = async () => {
    setPwdMsg('');
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdMsg('✗ All password fields required'); return; }
    if (newPwd.length < 8) { setPwdMsg('✗ New password must be at least 8 characters'); return; }
    if (newPwd !== confirmPwd) { setPwdMsg('✗ Passwords do not match'); return; }

    setSavingPwd(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdMsg('✓ Password changed!');
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      } else {
        setPwdMsg('✗ ' + (data.error || 'Something went wrong'));
      }
    } catch { setPwdMsg('✗ Network error'); }
    setSavingPwd(false);
    setTimeout(() => setPwdMsg(''), 4000);
  };

  // Avatar upload (converts to base64 for now, or you can upload to Supabase)
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg('✗ Avatar must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const initials = (fullName || profile?.username || '?').slice(0, 2).toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month:'long', year:'numeric' })
    : null;

  if (loading) return (
    <>
      <style>{`body{background:#f2efe9;font-family:'Syne',sans-serif;} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Header /><Sidebar />
      <main style={{ marginLeft:'240px', marginTop:'62px', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>
        <div style={{ width:32, height:32, border:'3px solid rgba(17,17,17,0.1)', borderTopColor:'#111', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      </main>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .tab-btn { padding:10px 20px;border-radius:100px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;transition:all 0.18s; }
        .tab-active   { background:#111;color:#f2efe9; }
        .tab-inactive { background:rgba(17,17,17,0.05);color:rgba(17,17,17,0.5); }
        .tab-inactive:hover { background:rgba(17,17,17,0.09);color:#111; }
        .save-btn { padding:12px 28px;border-radius:100px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.05em;background:#111;color:#f2efe9;transition:transform 0.15s,box-shadow 0.15s; }
        .save-btn:hover { transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,0.15); }
        .save-btn:disabled { opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none; }
        .danger-btn { padding:10px 20px;border-radius:100px;border:1.5px solid rgba(220,38,38,0.25);cursor:pointer;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;background:rgba(220,38,38,0.06);color:#dc2626;transition:all 0.15s; }
        .danger-btn:hover { background:rgba(220,38,38,0.12);border-color:rgba(220,38,38,0.4); }
        .stat-card { background:#faf8f4;border:1px solid rgba(17,17,17,0.07);borderRadius:14px;padding:18px 22px;text-align:center; }
        .pwd-strength-bar { height:3px;border-radius:2px;transition:width 0.3s,background 0.3s; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>

        {/* ── Hero banner ── */}
        <div style={{ background:'linear-gradient(135deg, #faf8f4 0%, #f2efe9 100%)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:24, padding:'32px', marginBottom:28, display:'flex', alignItems:'center', gap:24, flexWrap:'wrap', animation:'fadeUp 0.4s ease both' }}>

          {/* Avatar */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:88, height:88, borderRadius:'50%', overflow:'hidden', background: avatarUrl ? 'transparent' : avatarColor, display:'flex', alignItems:'center', justifyContent:'center', border:'3px solid rgba(17,17,17,0.08)', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:'#f2efe9' }}>{initials}</span>
              }
            </div>
            <button onClick={() => fileInputRef.current?.click()}
              style={{ position:'absolute', bottom:0, right:0, width:28, height:28, borderRadius:'50%', background:'#111', border:'2px solid #f2efe9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>
              📷
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarFile} />
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:200 }}>
            <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, fontStyle:'italic', color:'#111', margin:'0 0 4px', lineHeight:1.1 }}>
              {fullName || profile?.username}
            </h1>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.45)', margin:'0 0 8px' }}>
              @{profile?.username}
              {profile?.role && profile.role !== 'user' && (
                <span style={{ marginLeft:8, background:'#111', color:'#f2efe9', borderRadius:4, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{profile.role.toUpperCase()}</span>
              )}
            </p>
            {bio && <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.55)', margin:0, lineHeight:1.6 }}>{bio}</p>}
            {memberSince && <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.3)', margin:'8px 0 0' }}>Member since {memberSince}</p>}
          </div>

          {/* Stats */}
          {stats && (
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {[
                { label:'Photos', value:stats.total_photos, emoji:'📷' },
                { label:'Albums', value:stats.total_albums, emoji:'📁' },
                { label:'People', value:stats.tagged_people, emoji:'👤' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center', minWidth:72 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:'#111', lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'rgba(17,17,17,0.38)', letterSpacing:'0.06em', textTransform:'uppercase', marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {[['profile','👤 Profile'],['security','🔒 Security'],['account','⚙️ Account']].map(([tab, label]) => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab(tab)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ maxWidth:640 }}>

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <div style={{ animation:'fadeUp 0.25s ease both' }}>
              <Section title="Personal Info" subtitle="Update your name, bio and how others see you">
                <Field label="Display Name" value={fullName} onChange={setFullName} placeholder="Your full name" hint="This is shown on your profile and memories" />
                <Field label="Bio" value={bio} onChange={setBio} type="textarea" placeholder="Tell a little about yourself…" hint="Short description shown on your profile" />

                {/* Avatar color picker */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(17,17,17,0.4)', marginBottom:10 }}>
                    Avatar Color (if no photo)
                  </label>
                  <div style={{ display:'flex', gap:8 }}>
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => { setAvatarColor(c); setAvatarUrl(''); }}
                        style={{ width:32, height:32, borderRadius:'50%', background:c, border: avatarColor === c && !avatarUrl ? '3px solid #f2efe9' : '3px solid transparent', outline: avatarColor === c && !avatarUrl ? '2px solid #111' : 'none', cursor:'pointer', transition:'transform 0.15s', boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}
                        onMouseEnter={e => e.currentTarget.style.transform='scale(1.15)'}
                        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                      />
                    ))}
                    {avatarUrl && (
                      <button onClick={() => setAvatarUrl('')}
                        style={{ padding:'4px 12px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'rgba(17,17,17,0.5)' }}>
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <button className="save-btn" onClick={saveProfile} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                  {msg && <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
                </div>
              </Section>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === 'security' && (
            <div style={{ animation:'fadeUp 0.25s ease both' }}>
              <Section title="Email Address" subtitle="Update the email linked to your account">
                <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="your@email.com" hint="Used for login and password reset emails" />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <button className="save-btn" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Update Email'}</button>
                  {msg && <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
                </div>
              </Section>

              <Section title="Change Password" subtitle="Choose a strong password you haven't used before">
                <Field label="Current Password" value={currentPwd} onChange={setCurrentPwd} type={showPwds ? 'text' : 'password'} placeholder="Your current password" />
                <Field label="New Password" value={newPwd} onChange={setNewPwd} type={showPwds ? 'text' : 'password'} placeholder="Min. 8 characters" />

                {/* Strength bar */}
                {newPwd && (
                  <div style={{ marginBottom:12, marginTop:-8 }}>
                    <div style={{ height:3, background:'rgba(17,17,17,0.08)', borderRadius:2, overflow:'hidden', marginBottom:4 }}>
                      <div className="pwd-strength-bar" style={{
                        width: newPwd.length < 6 ? '20%' : newPwd.length < 8 ? '40%' : newPwd.length < 12 ? '70%' : '100%',
                        background: newPwd.length < 6 ? '#dc2626' : newPwd.length < 8 ? '#f59e0b' : newPwd.length < 12 ? '#22c55e' : '#16a34a',
                      }} />
                    </div>
                    <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color: newPwd.length < 8 ? '#dc2626' : '#16a34a' }}>
                      {newPwd.length < 6 ? 'Too short' : newPwd.length < 8 ? 'Weak' : newPwd.length < 12 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}

                <Field label="Confirm New Password" value={confirmPwd} onChange={setConfirmPwd} type={showPwds ? 'text' : 'password'} placeholder="Repeat new password" />

                {confirmPwd && confirmPwd !== newPwd && (
                  <p style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'#dc2626', marginTop:-12, marginBottom:12, fontWeight:600 }}>Passwords don't match</p>
                )}

                <label onClick={() => setShowPwds(v => !v)}
                  style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, cursor:'pointer', userSelect:'none' }}>
                  <input type="checkbox" checked={showPwds} onChange={() => {}} style={{ accentColor:'#111' }} />
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'rgba(17,17,17,0.55)', fontWeight:600 }}>Show passwords</span>
                </label>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <button className="save-btn" onClick={savePassword} disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd}>
                    {savingPwd ? 'Changing…' : 'Change Password'}
                  </button>
                  {pwdMsg && <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color: pwdMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{pwdMsg}</span>}
                </div>
              </Section>
            </div>
          )}

          {/* ── ACCOUNT TAB ── */}
          {activeTab === 'account' && (
            <div style={{ animation:'fadeUp 0.25s ease both' }}>
              <Section title="Account Info" subtitle="Read-only account details">
                <div style={{ display:'grid', gap:12 }}>
                  {[
                    { label:'Username', value:`@${profile?.username}` },
                    { label:'Email', value: profile?.email || '—' },
                    { label:'Role', value: profile?.role || 'user' },
                    { label:'Member since', value: memberSince || '—' },
                  ].map(row => (
                    <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'rgba(17,17,17,0.03)', borderRadius:10 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, color:'rgba(17,17,17,0.4)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{row.label}</span>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600, color:'#111' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Quick Links" subtitle="Navigate to key pages">
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {[
                    { label:'Gallery', href:'/gallery', emoji:'🖼️' },
                    { label:'Albums', href:'/albums', emoji:'📁' },
                    { label:'People', href:'/people', emoji:'👤' },
                    { label:'Assistant', href:'/assistant', emoji:'✨' },
                    { label:'Fix Library', href:'/assistant/backfill', emoji:'⚙️' },
                  ].map(link => (
                    <a key={link.href} href={link.href}
                      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 18px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', textDecoration:'none', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#111', transition:'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(17,17,17,0.07)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
                      {link.emoji} {link.label}
                    </a>
                  ))}
                </div>
              </Section>

              <Section title="Danger Zone" subtitle="These actions are irreversible">
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <button className="danger-btn" onClick={() => signOut({ callbackUrl:'/login' })}>
                    ↩ Sign Out
                  </button>
                  <button className="danger-btn" onClick={() => {
                    if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                      alert('Contact support to delete your account.');
                    }
                  }}>
                    🗑 Delete Account
                  </button>
                </div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.35)', marginTop:12, lineHeight:1.6 }}>
                  Signing out will end your current session. Account deletion removes all your photos and data permanently.
                </p>
              </Section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}