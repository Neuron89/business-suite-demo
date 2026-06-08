'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  createTicket,
  getManagers,
  getLookupDepartments,
  getLookupJobTitles,
  getDistributionGroups,
  type LookupDepartment,
  type LookupJobTitle,
  type DistributionGroup,
} from '@/lib/api';

const TITLES = ['Lab Technician A', 'Production Specialist', 'Compounding Operator A', 'Maintenance Foreman', 'Material Handler', 'Inside Sales'];
const DEPARTMENTS = ['Production', 'Quality Control', 'Maintenance', 'Warehouse', 'Laboratory', 'EHS'];
const OFFICES = ['NYCOA Office', 'NYCOA Factory – 1st floor', 'NYCOA Factory – 2nd floor', 'NYCOA Factory – 3rd floor', 'NYCOA Factory – 4th floor', 'NYCOA Factory – 5th floor'];
const NOTES = [
  'Replacing outgoing employee — needs same access as previous.',
  'Cross-training across two lines, expects to float.',
  'Urgent backfill for upcoming audit.',
  'Has prior experience with our ERP, minimal ramp.',
];
const SOFTWARE_SUGGEST = ['SolidWorks', 'AutoCAD', 'MATLAB', 'Adobe Acrobat Pro', 'Tableau'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTestData() {
  const start = new Date();
  start.setDate(start.getDate() + 7 + Math.floor(Math.random() * 21));
  return {
    jobTitle: pick(TITLES),
    department: pick(DEPARTMENTS),
    targetStartDate: start.toISOString().slice(0, 10),
    officeLocation: pick(OFFICES),
    managerNotes: pick(NOTES),
  };
}

/**
 * v2 manager-first intake. A manager submits the new-hire requisition with
 * the role + IT requirements they already know. HR fills in the actual hire
 * identity afterwards (name, employee#, badge#, etc.).
 */
interface TitleGroup {
  department: string;
  titles: { label: string; key: string }[];
}

export default function NewOnboardingPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Canonical title/department catalog, fetched from the Employee Tech Doc
  // proxy. The shape (`TitleGroup[]`) matches what the bundled `@onb/shared`
  // list used to look like, so the rest of the form keeps the same structure.
  const [titleGroups, setTitleGroups] = useState<TitleGroup[]>([]);
  const [titleToDept, setTitleToDept] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [depts, titles] = await Promise.all([
          getLookupDepartments(token),
          getLookupJobTitles(token),
        ]);
        if (cancelled) return;
        const byDept = new Map<number, LookupDepartment>();
        for (const d of depts) byDept.set(d.id, d);
        const groups: TitleGroup[] = depts
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((d) => ({
            department: d.name,
            titles: titles
              .filter((t) => t.department_id === d.id)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((t) => ({ label: t.label, key: t.key })),
          }))
          .filter((g) => g.titles.length > 0);
        setTitleGroups(groups);
        setTitleToDept(Object.fromEntries(titles.map((t) => [t.label, t.department_name])));
      } catch (err) {
        // Catalog unreachable — leave dropdown empty; manager can still type
        // the dept manually below.
        console.warn('Failed to load lookup catalog:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const departmentForTitle = useMemo(
    () => (label: string): string | null => titleToDept[label] ?? null,
    [titleToDept]
  );

  // Org info
  const [jobTitle, setJobTitle] = useState('');
  const [addingNewRole, setAddingNewRole] = useState(false);
  const [jobTitleIsNew, setJobTitleIsNew] = useState(false);
  const [department, setDepartment] = useState('');
  const [managerEmail, setManagerEmail] = useState(user?.email || '');
  const [managerName, setManagerName] = useState(user?.name || '');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [employmentType, setEmploymentType] = useState<'full_time' | 'part_time' | 'contractor' | 'intern' | 'temporary'>('full_time');
  const [workLocation, setWorkLocation] = useState<'onsite' | 'remote' | 'hybrid'>('onsite');
  const [officeLocation, setOfficeLocation] = useState('');
  const [desiredCandidateProfile, setDesiredCandidateProfile] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  // IT requirements — hardware
  const [needsLaptop, setNeedsLaptop] = useState(true);
  const [laptopPreference, setLaptopPreference] = useState<'14_inch' | '16_inch' | 'desktop' | 'no_preference'>('no_preference');
  const [needsMonitor, setNeedsMonitor] = useState(false);
  const [monitorCount, setMonitorCount] = useState(1);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [needsHeadset, setNeedsHeadset] = useState(false);
  const [otherEquipment, setOtherEquipment] = useState('');

  // IT requirements — accounts / access
  const [needsM365, setNeedsM365] = useState(true);
  const [needsVpn, setNeedsVpn] = useState(false);
  const [softwareNeeded, setSoftwareNeeded] = useState('');
  const [sharedMailboxes, setSharedMailboxes] = useState('');
  const [distributionLists, setDistributionLists] = useState<string[]>([]);
  const [dlOptions, setDlOptions] = useState<DistributionGroup[]>([]);
  const [similarToEmployeeEmail, setSimilarToEmployeeEmail] = useState('');

  // Manager notes
  const [managerNotes, setManagerNotes] = useState('');

  const isTest = !!user?.is_test;
  const autofilledRef = useRef(false);

  // Manager autocomplete for the "delegating on behalf of another manager"
  // edge case. Default is the submitter — they're the hiring manager — but
  // they can override if requisitioning for a different reporting line.
  const [knownManagers, setKnownManagers] = useState<{ id: number; name: string; email: string }[]>([]);
  useEffect(() => {
    if (!token) return;
    getManagers(token)
      .then(setKnownManagers)
      .catch((e) => console.warn('[onboarding] manager list fetch failed:', e?.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getDistributionGroups(token)
      .then(setDlOptions)
      .catch((e) => console.warn('[onboarding] distribution-group fetch failed:', e?.message));
  }, [token]);
  function handleManagerEmailChange(value: string) {
    setManagerEmail(value);
    const match = knownManagers.find((m) => m.email.toLowerCase() === value.toLowerCase().trim());
    if (match && !managerName.trim()) setManagerName(match.name);
  }

  function applyTestData() {
    const d = randomTestData();
    setJobTitle(d.jobTitle);
    setDepartment(d.department);
    setTargetStartDate(d.targetStartDate);
    setOfficeLocation(d.officeLocation);
    setManagerNotes(d.managerNotes);
    setNeedsLaptop(true);
    setNeedsMonitor(true);
    setMonitorCount(2);
    setSoftwareNeeded('Microsoft 365, SolidWorks');
  }

  useEffect(() => {
    if (isTest && !autofilledRef.current) {
      autofilledRef.current = true;
      applyTestData();
    }
  }, [isTest]);

  function splitList(s: string): string[] {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setSubmitting(true);

    const payload = {
      request_type: 'onboarding',
      urgency,
      title: `New hire requisition: ${jobTitle} — ${department}`,
      justification: `${managerName || managerEmail} is requesting a new hire for ${jobTitle} (${department}), target start ${targetStartDate}. HR to fill in identity.`,
      due_date: targetStartDate || undefined,
      onboarding_details: {
        // managerIntakeSchema fields
        job_title: jobTitle,
        department,
        manager_email: managerEmail.toLowerCase().trim(),
        manager_name: managerName || undefined,
        target_start_date: targetStartDate,
        employment_type: employmentType,
        work_location: workLocation,
        office_location: officeLocation || undefined,
        manager_notes: managerNotes || undefined,
        desired_candidate_profile: desiredCandidateProfile || undefined,
        // managerOnboardingDetailsSchema fields (IT requirements)
        needs_laptop: needsLaptop,
        laptop_preference: needsLaptop ? laptopPreference : undefined,
        needs_monitor: needsMonitor,
        monitor_count: needsMonitor ? monitorCount : 0,
        needs_phone: needsPhone,
        needs_headset: needsHeadset,
        other_equipment: otherEquipment || undefined,
        needs_m365: needsM365,
        needs_vpn: needsVpn,
        software_needed: splitList(softwareNeeded),
        shared_mailboxes: splitList(sharedMailboxes),
        distribution_lists: Array.from(new Set(['all@nycoa.com', ...distributionLists])),
        job_title_is_new: jobTitleIsNew || undefined,
        similar_to_employee_email: similarToEmployeeEmail || undefined,
      },
    };

    try {
      await createTicket(token, payload);
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in-up max-w-3xl">
      <h1 className="text-2xl font-extrabold text-theme-primary mb-2">New Hire Requisition</h1>
      <div className="card mb-6" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="text-sm text-theme-primary">
          You&apos;re the hiring manager. Tell us about the <em>role</em> and the IT setup the
          new person will need — we route this to HR so they can add the actual hire&apos;s
          name, employee number, and badge once they&apos;ve been selected. IT closes it out
          and provisions everything.
        </p>
      </div>

      {isTest && (
        <div className="card mb-6 flex items-center justify-between gap-3" style={{ borderLeft: '4px solid #f59e0b' }}>
          <p className="text-sm text-theme-primary">
            <strong>Test mode.</strong> Fields are pre-filled with random data.
          </p>
          <button type="button" onClick={applyTestData} className="btn-secondary whitespace-nowrap">
            Re-fill random
          </button>
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="The role">
          <Row>
            <Field label="Job title *" required>
              <select
                className="input-field"
                value={addingNewRole ? '__new__' : jobTitle}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__new__') {
                    setAddingNewRole(true);
                    setJobTitleIsNew(true);
                    setJobTitle('');
                    return;
                  }
                  setAddingNewRole(false);
                  setJobTitleIsNew(false);
                  setJobTitle(v);
                  // Selecting a job always re-syncs the department to match.
                  const inferred = departmentForTitle(v);
                  if (inferred) setDepartment(inferred);
                }}
                required={!addingNewRole}
              >
                <option value="">— Select a title —</option>
                {titleGroups.map((g) => (
                  <optgroup key={g.department} label={g.department}>
                    {g.titles.map((t) => (
                      <option key={t.key} value={t.label}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__new__">+ Role not listed…</option>
              </select>
              {addingNewRole && (
                <input
                  className="input-field mt-2"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                  placeholder="New role title — added to the catalog once HR accepts"
                />
              )}
            </Field>
            <Field label="Department *" required>
              <input className="input-field" value={department} onChange={(e) => setDepartment(e.target.value)} required placeholder="Auto-fills from title" />
            </Field>
          </Row>
          <Row>
            <Field label="Target start date *" required>
              <input type="date" className="input-field" value={targetStartDate} onChange={(e) => setTargetStartDate(e.target.value)} required />
            </Field>
            <Field label="Employment type">
              <select className="input-field" value={employmentType} onChange={(e) => setEmploymentType(e.target.value as any)}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contractor">Contractor</option>
                <option value="intern">Intern</option>
                <option value="temporary">Temporary</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Work location">
              <select className="input-field" value={workLocation} onChange={(e) => setWorkLocation(e.target.value as any)}>
                <option value="onsite">On-site</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </Field>
            <Field label="Office / building">
              <input className="input-field" value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} placeholder="e.g., NYCOA Office, or NYCOA Factory – 3rd floor" />
            </Field>
          </Row>
          <Field label="Desired candidate profile (skills / experience HR should look for)">
            <textarea
              className="input-field"
              rows={3}
              value={desiredCandidateProfile}
              onChange={(e) => setDesiredCandidateProfile(e.target.value)}
              placeholder="e.g., 3+ yrs CNC machining, forklift cert, comfortable with ERP data entry, strong English + Spanish"
            />
          </Field>
        </Section>

        <Section title="Who do they report to?">
          <Row>
            <Field label="Manager email *" required>
              <input
                type="email"
                className="input-field"
                list="known-managers"
                value={managerEmail}
                onChange={(e) => handleManagerEmailChange(e.target.value)}
                required
                placeholder="manager@nycoa.com"
                autoComplete="off"
              />
              <datalist id="known-managers">
                {knownManagers.map((m) => (
                  <option key={m.id} value={m.email}>{m.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Manager name">
              <input className="input-field" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
            </Field>
          </Row>
          <p className="text-xs text-theme-muted -mt-2">
            Defaults to you. Change if you&apos;re requisitioning on behalf of another manager.
          </p>
        </Section>

        <Section title="Hardware">
          <CheckboxRow label="Laptop" checked={needsLaptop} onChange={setNeedsLaptop}>
            {needsLaptop && (
              <select className="input-field mt-2" value={laptopPreference} onChange={(e) => setLaptopPreference(e.target.value as any)}>
                <option value="no_preference">No preference</option>
                <option value="14_inch">14&quot; laptop</option>
                <option value="16_inch">16&quot; laptop</option>
                <option value="desktop">Desktop instead</option>
              </select>
            )}
          </CheckboxRow>
          <CheckboxRow label="Monitor(s)" checked={needsMonitor} onChange={setNeedsMonitor}>
            {needsMonitor && (
              <input type="number" min={1} max={4} className="input-field mt-2 w-24" value={monitorCount} onChange={(e) => setMonitorCount(parseInt(e.target.value) || 1)} />
            )}
          </CheckboxRow>
          <CheckboxRow label="Desk phone" checked={needsPhone} onChange={setNeedsPhone} />
          <CheckboxRow label="Headset" checked={needsHeadset} onChange={setNeedsHeadset} />
          <Field label="Other equipment">
            <input className="input-field" value={otherEquipment} onChange={(e) => setOtherEquipment(e.target.value)} placeholder="docking station, second keyboard, etc." />
          </Field>
        </Section>

        <Section title="Accounts & access">
          <CheckboxRow label="Microsoft 365 mailbox" checked={needsM365} onChange={setNeedsM365} />
          <CheckboxRow label="VPN access" checked={needsVpn} onChange={setNeedsVpn} />
          <Field label="Software needed (comma-separated)">
            <input className="input-field" value={softwareNeeded} onChange={(e) => setSoftwareNeeded(e.target.value)} placeholder={SOFTWARE_SUGGEST.join(', ')} />
          </Field>
          <Field label="Shared mailboxes">
            <input className="input-field" value={sharedMailboxes} onChange={(e) => setSharedMailboxes(e.target.value)} placeholder="comma-separated mailbox addresses" />
          </Field>
          <Field label="Distribution lists">
            <p className="text-xs text-theme-muted mb-2">
              Everyone is added to <strong>all@nycoa.com</strong> automatically. Select any additional lists below.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-theme p-2 space-y-1">
              {dlOptions.length === 0 && (
                <p className="text-xs text-theme-muted">No distribution lists available.</p>
              )}
              {dlOptions.map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm text-theme-primary">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={distributionLists.includes(g.mail!)}
                    onChange={(e) =>
                      setDistributionLists((prev) =>
                        e.target.checked ? [...prev, g.mail!] : prev.filter((m) => m !== g.mail)
                      )
                    }
                  />
                  <span>{g.display_name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Copy access from existing employee">
            <input type="email" className="input-field" value={similarToEmployeeEmail} onChange={(e) => setSimilarToEmployeeEmail(e.target.value)} placeholder="someone@nycoa.com (we'll mirror their groups & access)" />
          </Field>
        </Section>

        <Section title="Notes & urgency">
          <Field label="Anything else for HR or IT">
            <textarea className="input-field" rows={3} value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)}
              placeholder="e.g., replacing outgoing employee, security clearance pending, urgent backfill" />
          </Field>
          <Field label="Urgency">
            <div className="flex gap-3">
              {(['low', 'medium', 'high', 'critical'] as const).map((u) => (
                <label key={u} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${urgency === u ? 'border-[var(--accent)]' : 'border-theme'}`}>
                  <input type="radio" name="urgency" value={u} checked={urgency === u} onChange={() => setUrgency(u)} className="sr-only" />
                  <span className="text-sm font-semibold capitalize text-theme-primary">{u}</span>
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={submitting} className="btn-accent">{submitting ? 'Submitting...' : 'Submit requisition'}</button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-theme-primary mb-3">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-theme-secondary mb-1.5">{label}{required && ' '}</label>
      {children}
    </div>
  );
}

function CheckboxRow({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (b: boolean) => void; children?: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
        <span className="text-sm font-semibold text-theme-primary">{label}</span>
      </label>
      {children}
    </div>
  );
}
