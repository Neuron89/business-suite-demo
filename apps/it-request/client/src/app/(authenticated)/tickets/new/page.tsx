'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createTicket } from '@/lib/api';

const REQUEST_TYPES = [
  { value: 'hardware', label: 'Hardware', icon: '\uD83D\uDCBB', description: 'Laptops, monitors, peripherals' },
  { value: 'software', label: 'Software', icon: '\uD83D\uDCE6', description: 'Applications, licenses' },
  { value: 'permission', label: 'Permissions', icon: '\uD83D\uDD10', description: 'Folder access, admin rights' },
  { value: 'access', label: 'Access', icon: '\uD83D\uDCE7', description: 'Shared mailboxes, Teams, SharePoint' },
  { value: 'other', label: 'Other', icon: '\uD83D\uDCDD', description: 'General IT requests' },
];

export default function NewRequestPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestType, setRequestType] = useState('');

  // Common fields
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [justification, setJustification] = useState('');

  // Hardware fields
  const [hwCategory, setHwCategory] = useState('laptop');
  const [hwLaptopSize, setHwLaptopSize] = useState('');
  const [hwLaptopFeatures, setHwLaptopFeatures] = useState<string[]>([]);
  const [hwDescription, setHwDescription] = useState('');
  const [hwQuantity, setHwQuantity] = useState(1);
  const [hwCurrentEquipment, setHwCurrentEquipment] = useState('');

  // Software fields
  const [swName, setSwName] = useState('');
  const [swUrl, setSwUrl] = useState('');
  const [swVersion, setSwVersion] = useState('');
  const [swLicenseType, setSwLicenseType] = useState('');
  const [swCost, setSwCost] = useState('');
  const [swNumLicenses, setSwNumLicenses] = useState(1);
  const [swPurpose, setSwPurpose] = useState('');
  const [swNotes, setSwNotes] = useState('');

  // Permission fields
  const [pmType, setPmType] = useState('folder_access');
  const [pmResourceName, setPmResourceName] = useState('');
  const [pmResourcePath, setPmResourcePath] = useState('');
  const [pmAccessLevel, setPmAccessLevel] = useState('read');
  const [pmDuration, setPmDuration] = useState('');
  const [pmCurrentAccess, setPmCurrentAccess] = useState('');
  const [pmNotes, setPmNotes] = useState('');

  // Access fields
  const [acType, setAcType] = useState('shared_mailbox');
  const [acResourceName, setAcResourceName] = useState('');
  const [acResourceEmail, setAcResourceEmail] = useState('');
  const [acAccessLevel, setAcAccessLevel] = useState('read');
  const [acDuration, setAcDuration] = useState('');
  const [acNotes, setAcNotes] = useState('');

  // Other fields
  const [otCategory, setOtCategory] = useState('');
  const [otDescription, setOtDescription] = useState('');
  const [otNotes, setOtNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requestType || !token) return;
    setError('');
    setSubmitting(true);

    const payload: any = {
      request_type: requestType,
      title,
      urgency,
      justification,
    };

    if (requestType === 'hardware') {
      payload.hardware_specs = {
        laptop_size: hwCategory === 'laptop' ? hwLaptopSize : undefined,
        laptop_features: hwCategory === 'laptop' ? hwLaptopFeatures : undefined,
        description: hwDescription,
        quantity: hwQuantity,
        current_equipment: hwCurrentEquipment || undefined,
      };
    } else if (requestType === 'software') {
      payload.software_details = {
        software_name: swName,
        vendor_url: swUrl || undefined,
        version: swVersion || undefined,
        license_type: swLicenseType || undefined,
        estimated_cost: swCost || undefined,
        number_of_licenses: swNumLicenses,
        business_purpose: swPurpose,
        notes: swNotes || undefined,
      };
    } else if (requestType === 'permission') {
      payload.permission_details = {
        permission_type: pmType,
        resource_name: pmResourceName,
        resource_path: pmResourcePath || undefined,
        access_level: pmAccessLevel,
        duration: pmDuration || undefined,
        current_access: pmCurrentAccess || undefined,
        notes: pmNotes || undefined,
      };
    } else if (requestType === 'access') {
      payload.access_details = {
        access_type: acType,
        resource_name: acResourceName,
        resource_email: acResourceEmail || undefined,
        access_level: acAccessLevel,
        duration: acDuration || undefined,
        notes: acNotes || undefined,
      };
    } else if (requestType === 'other') {
      payload.other_details = {
        category: otCategory,
        description: otDescription,
        notes: otNotes || undefined,
      };
    }

    try {
      await createTicket(token, payload);
      router.push('/tickets');
    } catch (err: any) {
      setError(err.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in-up max-w-4xl">
      <h1 className="text-2xl font-extrabold text-theme-primary mb-2">New IT Request</h1>
      <p className="text-sm text-theme-muted mb-6">Fill out the form below to submit a new request. It will be routed to your manager for approval, then to IT.</p>

      {/* Requester info */}
      <div className="card mb-6">
        <h2 className="text-lg font-bold text-theme-primary mb-3">Your Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-theme-muted">Name:</span> <span className="font-semibold text-theme-primary">{user?.name}</span></div>
          <div><span className="text-theme-muted">Department:</span> <span className="font-semibold text-theme-primary">{user?.department || 'N/A'}</span></div>
          <div><span className="text-theme-muted">Email:</span> <span className="font-semibold text-theme-primary">{user?.email}</span></div>
          <div><span className="text-theme-muted">Manager:</span> <span className="font-semibold text-theme-primary">{user?.manager_name || 'N/A'}</span> {user?.manager_email && <span className="text-theme-faint text-xs">({user.manager_email})</span>}</div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Type Selection */}
        <div className="card">
          <h2 className="text-lg font-bold text-theme-primary mb-3">Request Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {REQUEST_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setRequestType(t.value)}
                className={`p-4 rounded-xl text-center border-2 transition-all duration-200 ${requestType === t.value ? 'border-[var(--accent)] shadow-accent-glow' : 'border-theme hover:border-theme-light'}`}
                style={{ background: requestType === t.value ? 'var(--sidebar-active)' : 'var(--bg-card-hover)' }}>
                <div className="text-2xl mb-1">{t.icon}</div>
                <div className="text-sm font-bold text-theme-primary">{t.label}</div>
                <div className="text-xs text-theme-muted mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {requestType && (
          <>
            {/* Common Fields */}
            <div className="card">
              <h2 className="text-lg font-bold text-theme-primary mb-3">Request Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Brief description of your request" required maxLength={200} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Urgency</label>
                  <div className="flex gap-3">
                    {['low', 'medium', 'high', 'critical'].map((u) => (
                      <label key={u} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${urgency === u ? 'border-[var(--accent)]' : 'border-theme'}`} style={{ background: urgency === u ? 'var(--sidebar-active)' : 'transparent' }}>
                        <input type="radio" name="urgency" value={u} checked={urgency === u} onChange={() => setUrgency(u)} className="sr-only" />
                        <span className="text-sm font-semibold capitalize text-theme-primary">{u}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Justification / Reason</label>
                  <textarea value={justification} onChange={(e) => setJustification(e.target.value)} className="input-field" rows={3} placeholder="Explain why you need this..." required />
                </div>
              </div>
            </div>

            {/* Hardware-specific */}
            {requestType === 'hardware' && (
              <div className="card">
                <h2 className="text-lg font-bold text-theme-primary mb-3">Hardware Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Category</label>
                    <select value={hwCategory} onChange={(e) => setHwCategory(e.target.value)} className="input-field">
                      <option value="laptop">Laptop</option>
                      <option value="desktop">Desktop</option>
                      <option value="monitor">Monitor</option>
                      <option value="peripheral">Peripheral (mouse, keyboard, etc)</option>
                      <option value="mobile_device">Mobile Device</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {hwCategory === 'laptop' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Screen Size</label>
                        <div className="flex gap-3">
                          {[{ v: '14_inch', l: '14"' }, { v: '16_inch', l: '16"' }].map((s) => (
                            <label key={s.v} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${hwLaptopSize === s.v ? 'border-[var(--accent)]' : 'border-theme'}`}>
                              <input type="radio" name="laptopSize" value={s.v} checked={hwLaptopSize === s.v} onChange={() => setHwLaptopSize(s.v)} className="sr-only" />
                              <span className="text-sm font-semibold text-theme-primary">{s.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Features</label>
                        <div className="flex flex-wrap gap-3">
                          {[{ v: 'standard', l: 'Standard' }, { v: 'touchscreen', l: 'Touchscreen' }, { v: 'tablet_style', l: 'Tablet Style' }, { v: '2_in_1', l: '2-in-1 Convertible' }].map((f) => (
                            <label key={f.v} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${hwLaptopFeatures.includes(f.v) ? 'border-[var(--accent)]' : 'border-theme'}`}>
                              <input type="checkbox" checked={hwLaptopFeatures.includes(f.v)} onChange={(e) => setHwLaptopFeatures(e.target.checked ? [...hwLaptopFeatures, f.v] : hwLaptopFeatures.filter((x) => x !== f.v))} className="sr-only" />
                              <span className="text-sm font-semibold text-theme-primary">{f.l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Description</label>
                    <textarea value={hwDescription} onChange={(e) => setHwDescription(e.target.value)} className="input-field" rows={2} placeholder="Describe what you need..." required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Quantity</label>
                    <input type="number" min={1} value={hwQuantity} onChange={(e) => setHwQuantity(parseInt(e.target.value) || 1)} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Current Equipment (optional)</label>
                    <input type="text" value={hwCurrentEquipment} onChange={(e) => setHwCurrentEquipment(e.target.value)} className="input-field" placeholder="What are you currently using?" />
                  </div>
                </div>
              </div>
            )}

            {/* Software-specific */}
            {requestType === 'software' && (
              <div className="card">
                <h2 className="text-lg font-bold text-theme-primary mb-3">Software Details</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Software Name</label>
                      <input type="text" value={swName} onChange={(e) => setSwName(e.target.value)} className="input-field" placeholder="e.g., Adobe Acrobat Pro" required />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Vendor Website (optional)</label>
                      <input type="url" value={swUrl} onChange={(e) => setSwUrl(e.target.value)} className="input-field" placeholder="https://www.example.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Version (optional)</label>
                      <input type="text" value={swVersion} onChange={(e) => setSwVersion(e.target.value)} className="input-field" placeholder="e.g., 2024" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">License Type (optional)</label>
                      <select value={swLicenseType} onChange={(e) => setSwLicenseType(e.target.value)} className="input-field">
                        <option value="">Select...</option>
                        <option value="perpetual">Perpetual</option>
                        <option value="subscription">Subscription</option>
                        <option value="free">Free / Open Source</option>
                        <option value="trial">Trial</option>
                        <option value="unknown">Not Sure</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Estimated Cost (optional)</label>
                      <input type="text" value={swCost} onChange={(e) => setSwCost(e.target.value)} className="input-field" placeholder="e.g., $50/month" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Number of Licenses</label>
                    <input type="number" min={1} value={swNumLicenses} onChange={(e) => setSwNumLicenses(parseInt(e.target.value) || 1)} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Business Purpose</label>
                    <textarea value={swPurpose} onChange={(e) => setSwPurpose(e.target.value)} className="input-field" rows={2} placeholder="Why do you need this software?" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Additional Notes (optional)</label>
                    <textarea value={swNotes} onChange={(e) => setSwNotes(e.target.value)} className="input-field" rows={2} placeholder="Any other details..." />
                  </div>
                </div>
              </div>
            )}

            {/* Permission-specific */}
            {requestType === 'permission' && (
              <div className="card">
                <h2 className="text-lg font-bold text-theme-primary mb-3">Permission Details</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Permission Type</label>
                      <select value={pmType} onChange={(e) => setPmType(e.target.value)} className="input-field">
                        <option value="folder_access">Folder / Network Drive Access</option>
                        <option value="shared_mailbox">Shared Mailbox Access</option>
                        <option value="distribution_list">Distribution List</option>
                        <option value="security_group">Security Group</option>
                        <option value="application_access">Application Access</option>
                        <option value="admin_rights">Admin Rights</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Access Level</label>
                      <select value={pmAccessLevel} onChange={(e) => setPmAccessLevel(e.target.value)} className="input-field">
                        <option value="read">Read Only</option>
                        <option value="read_write">Read & Write</option>
                        <option value="full_control">Full Control</option>
                        <option value="owner">Owner</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Resource Name</label>
                    <input type="text" value={pmResourceName} onChange={(e) => setPmResourceName(e.target.value)} className="input-field" placeholder="e.g., Shared Drive - Finance Reports" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Resource Path / Location (optional)</label>
                    <input type="text" value={pmResourcePath} onChange={(e) => setPmResourcePath(e.target.value)} className="input-field" placeholder="e.g., \\server\share\folder or URL" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Duration (optional)</label>
                      <select value={pmDuration} onChange={(e) => setPmDuration(e.target.value)} className="input-field">
                        <option value="">Permanent</option>
                        <option value="1_week">1 Week</option>
                        <option value="1_month">1 Month</option>
                        <option value="3_months">3 Months</option>
                        <option value="6_months">6 Months</option>
                        <option value="1_year">1 Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Current Access (optional)</label>
                      <input type="text" value={pmCurrentAccess} onChange={(e) => setPmCurrentAccess(e.target.value)} className="input-field" placeholder="What access do you currently have?" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Notes (optional)</label>
                    <textarea value={pmNotes} onChange={(e) => setPmNotes(e.target.value)} className="input-field" rows={2} placeholder="Any additional context..." />
                  </div>
                </div>
              </div>
            )}

            {/* Access-specific */}
            {requestType === 'access' && (
              <div className="card">
                <h2 className="text-lg font-bold text-theme-primary mb-3">Access Details</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Access Type</label>
                      <select value={acType} onChange={(e) => setAcType(e.target.value)} className="input-field">
                        <option value="shared_mailbox">Shared Mailbox</option>
                        <option value="distribution_list">Distribution List</option>
                        <option value="teams_channel">Teams Channel</option>
                        <option value="sharepoint_site">SharePoint Site</option>
                        <option value="network_drive">Network Drive</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Access Level</label>
                      <select value={acAccessLevel} onChange={(e) => setAcAccessLevel(e.target.value)} className="input-field">
                        <option value="read">Read Only</option>
                        <option value="read_write">Read & Write (Send As / Contribute)</option>
                        <option value="full_control">Full Control</option>
                        <option value="owner">Owner</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Resource Name</label>
                    <input type="text" value={acResourceName} onChange={(e) => setAcResourceName(e.target.value)} className="input-field" placeholder="e.g., Sales Team Mailbox" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Resource Email / URL (optional)</label>
                    <input type="text" value={acResourceEmail} onChange={(e) => setAcResourceEmail(e.target.value)} className="input-field" placeholder="e.g., sales@company.com or SharePoint URL" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Duration (optional)</label>
                    <select value={acDuration} onChange={(e) => setAcDuration(e.target.value)} className="input-field">
                      <option value="">Permanent</option>
                      <option value="1_week">1 Week</option>
                      <option value="1_month">1 Month</option>
                      <option value="3_months">3 Months</option>
                      <option value="6_months">6 Months</option>
                      <option value="1_year">1 Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Notes (optional)</label>
                    <textarea value={acNotes} onChange={(e) => setAcNotes(e.target.value)} className="input-field" rows={2} placeholder="Any additional context..." />
                  </div>
                </div>
              </div>
            )}

            {/* Other-specific */}
            {requestType === 'other' && (
              <div className="card">
                <h2 className="text-lg font-bold text-theme-primary mb-3">Request Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Category</label>
                    <input type="text" value={otCategory} onChange={(e) => setOtCategory(e.target.value)} className="input-field" placeholder="e.g., System Change, Account Setup" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Description</label>
                    <textarea value={otDescription} onChange={(e) => setOtDescription(e.target.value)} className="input-field" rows={4} placeholder="Describe what you need in detail..." required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Notes (optional)</label>
                    <textarea value={otNotes} onChange={(e) => setOtNotes(e.target.value)} className="input-field" rows={2} />
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={submitting} className="btn-accent">{submitting ? 'Submitting...' : 'Submit Request'}</button>
              <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
