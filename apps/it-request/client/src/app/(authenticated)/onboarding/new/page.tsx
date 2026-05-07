'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createTicket } from '@/lib/api';

const TEST_MANAGER_EMAIL = 'test-mgr@acme.test';
const TEST_MANAGER_NAME = 'Test Manager';

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Sam', 'Drew', 'Pat', 'Reese'];
const LAST_NAMES = ['Walker', 'Reyes', 'Nguyen', 'Patel', 'O’Brien', 'Carter', 'Foster', 'Hughes', 'Bennett', 'Murphy', 'Singh', 'Cole'];
const TITLES = ['Process Engineer', 'Production Operator', 'QC Technician', 'Maintenance Tech', 'Warehouse Lead', 'Lab Analyst'];
const DEPARTMENTS = ['Production', 'Quality Control', 'Maintenance', 'Warehouse', 'Laboratory', 'EHS'];
const OFFICES = ['Plant A – 1st floor', 'Plant A – 2nd floor', 'Acme Industries – main office', 'Bradford – plant floor'];
const NOTES = [
  'Replacing outgoing employee — needs same access.',
  'Cross-training across two lines, expects to float.',
  'Urgent backfill for upcoming audit.',
  'Has prior experience with our ERP, minimal ramp.',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(n: number, len: number) {
  return n.toString().padStart(len, '0');
}

function randomTestData() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const fullName = `${first} ${last}`;
  const start = new Date();
  start.setDate(start.getDate() + 7 + Math.floor(Math.random() * 21));
  const startDate = start.toISOString().slice(0, 10);

  return {
    fullName,
    preferredName: first,
    employeeNumber: `EMP-${pad(Math.floor(1000 + Math.random() * 9000), 4)}`,
    badgeNumber: pad(Math.floor(10000 + Math.random() * 90000), 5),
    jobTitle: pick(TITLES),
    department: pick(DEPARTMENTS),
    managerEmail: TEST_MANAGER_EMAIL,
    managerName: TEST_MANAGER_NAME,
    startDate,
    employmentType: 'full_time',
    workLocation: 'onsite' as const,
    officeLocation: pick(OFFICES),
    personalEmail: `${first.toLowerCase()}.${last.toLowerCase().replace(/\W/g, '')}@example.com`,
    phone: `978-555-${pad(Math.floor(Math.random() * 10000), 4)}`,
    hrNotes: pick(NOTES),
    urgency: 'medium' as const,
  };
}

export default function NewOnboardingPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerName, setManagerName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [workLocation, setWorkLocation] = useState<'onsite' | 'remote' | 'hybrid'>('onsite');
  const [officeLocation, setOfficeLocation] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hrNotes, setHrNotes] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  const isTest = !!user?.is_test;
  const autofilledRef = useRef(false);

  function applyTestData() {
    const d = randomTestData();
    setFullName(d.fullName);
    setPreferredName(d.preferredName);
    setEmployeeNumber(d.employeeNumber);
    setBadgeNumber(d.badgeNumber);
    setJobTitle(d.jobTitle);
    setDepartment(d.department);
    setManagerEmail(d.managerEmail);
    setManagerName(d.managerName);
    setStartDate(d.startDate);
    setEmploymentType(d.employmentType);
    setWorkLocation(d.workLocation);
    setOfficeLocation(d.officeLocation);
    setPersonalEmail(d.personalEmail);
    setPhone(d.phone);
    setHrNotes(d.hrNotes);
    setUrgency(d.urgency);
  }

  useEffect(() => {
    if (isTest && !autofilledRef.current) {
      autofilledRef.current = true;
      applyTestData();
    }
  }, [isTest]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setSubmitting(true);

    const payload = {
      request_type: 'onboarding',
      urgency,
      title: `New Hire: ${fullName} (${jobTitle})`,
      justification: `New hire ${fullName} starting ${startDate} in ${department}, reports to ${managerName || managerEmail}. ${managerName || 'The manager'} will specify IT requirements next.`,
      due_date: startDate || undefined,
      onboarding_details: {
        full_name: fullName,
        preferred_name: preferredName || undefined,
        employee_number: employeeNumber,
        badge_number: badgeNumber,
        job_title: jobTitle,
        department,
        manager_email: managerEmail.toLowerCase().trim(),
        manager_name: managerName || undefined,
        start_date: startDate,
        employment_type: employmentType,
        work_location: workLocation,
        office_location: officeLocation || undefined,
        personal_email: personalEmail || undefined,
        phone: phone || undefined,
        hr_notes: hrNotes || undefined,
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
      <h1 className="text-2xl font-extrabold text-theme-primary mb-2">New Hire Intake</h1>
      <div className="card mb-6" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="text-sm text-theme-primary">
          <strong>Just the basics.</strong> Submit who&apos;s starting and who they report to.
          The system will then route the ticket to <em>the new hire&apos;s manager</em> to specify
          equipment, software, and access — they&apos;re the ones who know what the role needs.
          Once the manager fills it in, IT will see it on the dashboard and provision everything.
        </p>
      </div>

      {isTest && (
        <div className="card mb-6 flex items-center justify-between gap-3" style={{ borderLeft: '4px solid #f59e0b' }}>
          <p className="text-sm text-theme-primary">
            <strong>Test mode.</strong> Fields are pre-filled with random data and the manager
            defaults to <code>{TEST_MANAGER_EMAIL}</code> so you can flow straight into the
            manager-review step.
          </p>
          <button type="button" onClick={applyTestData} className="btn-secondary whitespace-nowrap">
            Re-fill random
          </button>
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Who is starting?">
          <Row>
            <Field label="Full legal name *" required>
              <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="Preferred / display name">
              <input className="input-field" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Employee number *" required>
              <input className="input-field" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} required placeholder="e.g., EMP-1234" />
            </Field>
            <Field label="Badge number *" required>
              <input className="input-field" value={badgeNumber} onChange={(e) => setBadgeNumber(e.target.value)} required placeholder="e.g., 10293" />
            </Field>
          </Row>
          <Row>
            <Field label="Job title *" required>
              <input className="input-field" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
            </Field>
            <Field label="Department *" required>
              <input className="input-field" value={department} onChange={(e) => setDepartment(e.target.value)} required placeholder="e.g., Production, Quality" />
            </Field>
          </Row>
        </Section>

        <Section title="Who do they report to?">
          <Row>
            <Field label="Manager email *" required>
              <input type="email" className="input-field" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} required placeholder="manager@facility.local" />
            </Field>
            <Field label="Manager name (helpful but optional)">
              <input className="input-field" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
            </Field>
          </Row>
          <p className="text-xs text-theme-muted -mt-2">
            The ticket will be routed to this manager so they can specify what the new hire needs from IT.
          </p>
        </Section>

        <Section title="When and where?">
          <Row>
            <Field label="Start date *" required>
              <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <Field label="Employment type">
              <select className="input-field" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
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
              <input className="input-field" value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} placeholder="e.g., HQ – 2nd floor" />
            </Field>
          </Row>
        </Section>

        <Section title="Contact info (optional)">
          <Row>
            <Field label="Personal email">
              <input type="email" className="input-field" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="for welcome packet" />
            </Field>
            <Field label="Personal phone">
              <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </Row>
        </Section>

        <Section title="Anything else IT should know?">
          <Field label="Notes from HR">
            <textarea className="input-field" rows={3} value={hrNotes} onChange={(e) => setHrNotes(e.target.value)}
              placeholder="e.g., replacing John Doe, urgent backfill, security clearance pending" />
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
          <button type="submit" disabled={submitting} className="btn-accent">{submitting ? 'Submitting...' : 'Submit & Route to Manager'}</button>
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
