'use client';

import { useState } from 'react';
import { PSSR_CATEGORIES, PSSR_CATEGORY_LABELS } from '@moc/shared';

// PSSR template items (same as server)
const PSSR_TEMPLATE: { category: string; description: string }[] = [
  { category: 'design_and_construction', description: 'Have the concerns from the Design Safety Review been resolved satisfactorily?' },
  { category: 'design_and_construction', description: 'Has the equipment QA turnover procedure been completed?' },
  { category: 'design_and_construction', description: 'Are all applicable Chemical Process Safety Standards Administrative Controls complied with?' },
  { category: 'design_and_construction', description: 'Is construction and equipment in accordance with ISP and other applicable design specifications?' },
  { category: 'design_and_construction', description: 'Has a field inspection been performed?' },
  { category: 'design_and_construction', description: 'Has the job site been properly cleaned up?' },
  { category: 'design_and_construction', description: 'Has adequate surface drainage been provided?' },
  { category: 'design_and_construction', description: 'Are walking/working surfaces level, secured and non-slippery?' },
  { category: 'design_and_construction', description: 'Have emergency access and egress been properly provided for and labeled or marked?' },
  { category: 'design_and_construction', description: 'Are personnel protected from contact with hot (>140°F) surfaces?' },
  { category: 'design_and_construction', description: 'Do walkways and ladders provide safe access to all levels?' },
  { category: 'design_and_construction', description: 'Can elevated work be performed safely?' },
  { category: 'design_and_construction', description: 'Do signs identify work area hazards and provide instruction?' },
  { category: 'design_and_construction', description: 'Is idled equipment properly isolated and identified?' },
  { category: 'design_and_construction', description: 'Is the work area adequately ventilated?' },
  { category: 'design_and_construction', description: 'Is insulation or other equipment free of sharp edges?' },
  { category: 'valves_and_piping', description: 'Are open ended valves of the correct type and plugged or blinded where required?' },
  { category: 'valves_and_piping', description: 'Are hoses and fittings of the approved types?' },
  { category: 'valves_and_piping', description: 'Are check valves installed in the correct orientation and direction?' },
  { category: 'valves_and_piping', description: 'Have tripping hazards been eliminated and adequate clearance provided?' },
  { category: 'valves_and_piping', description: 'Is the piping adequately supported?' },
  { category: 'valves_and_piping', description: 'Has a line-by-line inspection been done?' },
  { category: 'valves_and_piping', description: 'Have nipple lengths been minimized and cantilevered branch connections avoided?' },
  { category: 'valves_and_piping', description: 'Is cathodic protection provided, if specified?' },
  { category: 'valves_and_piping', description: 'Are line expansion provisions installed?' },
  { category: 'valves_and_piping', description: 'Is any piping close to the edge of a pipe rack that could fall off in high wind or during line expansion?' },
  { category: 'valves_and_piping', description: 'Are dead end pipe, pocketed lines, and unused piping branches eliminated?' },
  { category: 'valves_and_piping', description: 'Have valves and flanges subject to fugitive emission monitoring been tagged as required?' },
  { category: 'valves_and_piping', description: 'Is the placement of flanges, unions, drains, etc., adequate for maintenance?' },
  { category: 'equipment', description: 'Has protection been provided against over pressure and vacuum?' },
  { category: 'equipment', description: 'Have guards such as coupling and seal guards been installed on moving equipment?' },
  { category: 'equipment', description: 'Does equipment location provide safe access for operation and maintenance?' },
  { category: 'equipment', description: 'Is equipment adequately supported?' },
  { category: 'equipment', description: 'Are Test and Inspections (T&I) current for reused equipment?' },
  { category: 'equipment', description: 'Was rotation checked?' },
  { category: 'equipment', description: "Is the manufacturer's label visible?" },
  { category: 'equipment', description: 'Is the equipment free from pipe strain?' },
  { category: 'instrument_and_electrical', description: 'Was the fail-safe position of valves verified by functional testing?' },
  { category: 'instrument_and_electrical', description: 'Were instruments/analyzers functionally tested?' },
  { category: 'instrument_and_electrical', description: 'Will alarms associated with critical instruments be clearly displayed in the control room?' },
  { category: 'instrument_and_electrical', description: 'Are guards provided to prevent accidental tripping of switches?' },
  { category: 'instrument_and_electrical', description: 'Are indicating lights operational?' },
  { category: 'instrument_and_electrical', description: 'Are conduit fittings sealed?' },
  { category: 'instrument_and_electrical', description: 'Have all junction boxes and electrical switch boxes been properly covered or closed?' },
  { category: 'instrument_and_electrical', description: 'Is electrical heat tracing labeled?' },
  { category: 'instrument_and_electrical', description: 'Are start/stop switches and electrical switchgear labeled?' },
  { category: 'instrument_and_electrical', description: 'Have the correct electrical area classification rules been followed?' },
  { category: 'instrument_and_electrical', description: 'Have the electrical protective devices and safety features been properly calibrated, set, and tested?' },
  { category: 'instrument_and_electrical', description: 'Does the electrical equipment have lockout devices?' },
  { category: 'instrument_and_electrical', description: 'Have the commissioning test results been performed by local plant maintenance?' },
  { category: 'instrument_and_electrical', description: 'Is equipment properly grounded and functionally checked?' },
  { category: 'instrument_and_electrical', description: 'Are ground wires available for tank trucks, tank cars, drums, etc.?' },
  { category: 'instrument_and_electrical', description: 'Is ventilation for batteries/electrical components adequate?' },
  { category: 'instrument_and_electrical', description: 'Is there adequate lighting?' },
  { category: 'instrument_and_electrical', description: 'Are critical instruments, ESD devices, quality instruments, etc., field distinguishable?' },
  { category: 'instrument_and_electrical', description: 'Has adequate local instrumentation been supplied per design specifications for safety and trouble-shooting?' },
  { category: 'computer_software_and_systems', description: 'Have all software outputs been tested off-line?' },
  { category: 'computer_software_and_systems', description: 'If the software requires information from other computers, are adequate safeguards provided?' },
  { category: 'computer_software_and_systems', description: 'Have instructions been provided for restarting the computer safely after a shutdown?' },
  { category: 'computer_software_and_systems', description: 'Is sufficient checking of data inputs to software provided to safely operate the facility?' },
  { category: 'computer_software_and_systems', description: 'Has the need for computer training been addressed?' },
  { category: 'computer_software_and_systems', description: 'Is documentation provided for software, including user and technical documentation?' },
  { category: 'computer_software_and_systems', description: 'Are important software functions (critical alarms, ESD devices, process control logic) adequately protected?' },
  { category: 'operations', description: 'Are NFPA chemical hazard identification symbols in place?' },
  { category: 'operations', description: 'Can the system be safely started up, shut down or operated on 100% recycle, if applicable?' },
  { category: 'operations', description: 'Are routinely operated valves accessible and easy to operate?' },
  { category: 'operations', description: 'Are vents and drains visible and safely located?' },
  { category: 'operations', description: 'Have piping and equipment been installed properly to avoid unnecessary cross-ties?' },
  { category: 'operations', description: 'Are sample points properly configured for safe sampling?' },
  { category: 'operations', description: 'Have provisions been made for safe handling of drums and gas cylinders?' },
  { category: 'operations', description: 'Are new lines and equipment adequately labeled, including flow arrows?' },
  { category: 'operations', description: 'Are special procedures for commissioning/decommissioning or first time startup provided?' },
  { category: 'operations', description: 'Have operator and supervisory personnel training sessions been completed and documented?' },
  { category: 'operations', description: 'Are provisions made for technical or supervisory support during initial operation?' },
  { category: 'operations', description: 'Was the change communicated to adjacent units or other affected groups?' },
  { category: 'maintenance', description: 'Can equipment be cleaned, isolated, locked out, and easily removed?' },
  { category: 'maintenance', description: 'Is equipment and instrumentation reasonably accessible for inspection and maintenance?' },
  { category: 'maintenance', description: 'Is equipment entered on the PM program?' },
  { category: 'maintenance', description: 'Are capacities of lifting equipment, floors, and hoists clearly displayed and visible?' },
  { category: 'maintenance', description: 'Have maintenance personnel whose job task will be affected been trained and training documented?' },
  { category: 'maintenance', description: 'Are necessary spare parts available?' },
  { category: 'relief_devices', description: 'Have all relief devices been installed per design?' },
  { category: 'relief_devices', description: 'Relief devices added to checklist?' },
  { category: 'relief_devices', description: 'Are block valves on inlet and outlet of relief devices car sealed open?' },
  { category: 'relief_devices', description: 'Are safety valve discharges directed to a safe location?' },
  { category: 'relief_devices', description: 'Is the inlet or outlet piping at least the same size as the connection on the relief device?' },
  { category: 'relief_devices', description: 'Is the relief device stack adequately braced against any reaction forces?' },
  { category: 'relief_devices', description: 'Are heat exchangers protected on the shell and tube side?' },
  { category: 'relief_devices', description: 'Are weep holes, drains, and/or weather barriers provided in discharge piping?' },
  { category: 'relief_devices', description: 'Are relief valves tagged?' },
  { category: 'relief_devices', description: 'Are relief valves installed vertically?' },
  { category: 'relief_devices', description: 'Is there a pressure indicator between rupture disks and relief valves?' },
  { category: 'relief_devices', description: 'Have safety valves been tested and tagged?' },
  { category: 'relief_devices', description: 'Are safety valves under pipe strain?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have inert gas blankets and purges been provided where required?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Are tank legs fire-proofed, where required by OSHA/NFPA standards?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have sprinkler/deluge systems been installed and functionally tested if specified?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have new fire protection systems and control valves been added to the inspection list?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have new fire protection systems control valves been car-sealed open?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have fixed fire protection systems been installed, tested, and labeled?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Has fire protection group approved all changes to fixed fire protection facilities?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Has steam or nitrogen been provided for snuffing fires in safety valve vent headers?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have Operations and Emergency Response Team personnel been adequately instructed?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have approved fire extinguishers, safety showers, eye baths, fresh air equipment, etc. been installed?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have flame arrestors been installed as required?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have Emergency Response procedures been reviewed as necessary?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Has freeze and/or scalding protection been adequately addressed?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Are provisions for monitoring potential high noise areas made?' },
  { category: 'occupational_health_industrial_hygiene', description: 'If regulated chemicals are involved, have the special requirements been observed?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Has a PPE assessment survey been conducted?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Has appropriate PPE been provided, personnel trained and training documented?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Does the system assure minimum personnel exposure to chemicals?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Are provisions made for Industrial Hygiene monitoring during initial or routine operations?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Has exposed asbestos insulation been properly sealed or disposed of?' },
  { category: 'environmental_protection', description: 'Were changes in air emissions, waste, wastewater and storm water flows properly communicated?' },
  { category: 'environmental_protection', description: 'Can hazardous materials from spills or maintenance preparation be safely handled?' },
  { category: 'environmental_protection', description: 'Are environmental permits and inspections/certifications required for operation on file and understood by unit personnel?' },
];

type ItemStatus = 'pending' | 'pass' | 'fail' | 'na';

export default function PssrTestPage() {
  const [items, setItems] = useState(() =>
    PSSR_TEMPLATE.map((t, i) => ({ id: i, ...t, status: 'pending' as ItemStatus, notes: '' }))
  );

  function updateItem(id: number, status: ItemStatus) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
  }
  function updateNotes(id: number, notes: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, notes } : item));
  }

  const grouped = PSSR_CATEGORIES.reduce((acc: Record<string, typeof items>, cat) => {
    acc[cat] = items.filter((item) => item.category === cat);
    return acc;
  }, {} as Record<string, typeof items>);

  const totalItems = items.length;
  const completedItems = items.filter((i) => i.status !== 'pending').length;
  const actionItems = items.filter((i) => i.status === 'fail');

  function handleExport() {
    const catLabel = (cat: string) => (PSSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const statusLabel = (s: string) => s === 'pass' ? 'Yes' : s === 'fail' ? 'No' : s === 'na' ? 'N/A' : 'Pending';
    const statusColor = (s: string) => s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : s === 'na' ? '#9ca3af' : '#ca8a04';

    let itemsHtml = '';
    for (const cat of PSSR_CATEGORIES) {
      const catItems = grouped[cat] || [];
      if (catItems.length === 0) continue;
      itemsHtml += `<tr><td colspan="3" style="background: #1E3A5F; color: white; padding: 8px 12px; font-weight: bold;">${catLabel(cat)}</td></tr>`;
      for (const item of catItems) {
        const bgColor = item.status === 'na' ? '#f3f4f6' : 'white';
        const textColor = item.status === 'na' ? '#9ca3af' : '#374151';
        itemsHtml += `<tr style="background: ${bgColor}; color: ${textColor};"><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${statusColor(item.status)};">${statusLabel(item.status)}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${item.notes || ''}</td></tr>`;
      }
    }

    let actionItemsHtml = '';
    if (actionItems.length > 0) {
      actionItemsHtml = `<h2 style="color: #dc2626; margin-top: 32px;">Action Items</h2><table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><thead><tr style="background: #fef2f2;"><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">#</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Category</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Item</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Notes</th><th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #fca5a5; width: 80px;">Resolved</th></tr></thead><tbody>${actionItems.map((item, idx) => `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${catLabel(item.category)}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.notes || 'No notes provided'}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">&#9744;</td></tr>`).join('')}</tbody></table>`;
    }

    let rosterHtml = `<h2 style="margin-top: 32px;">Sign-Off Roster</h2><p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">All parties must review the PSSR and action items, then sign below.</p><table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Department / Role</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Name</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Date</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Signature</th></tr></thead><tbody>`;
    for (let i = 0; i < 8; i++) {
      rosterHtml += `<tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">_______________</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; min-width: 200px;">________________________</td></tr>`;
    }
    rosterHtml += '</tbody></table>';

    const html = `<!DOCTYPE html><html><head><title>PSSR Report — Test Mode</title><style>@media print { body { margin: 0; } .no-print { display: none; } } body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px; color: #374151; } table { page-break-inside: auto; } tr { page-break-inside: avoid; }</style></head><body><div style="text-align: center; margin-bottom: 24px;"><h1 style="color: #1E3A5F; margin-bottom: 4px;">Pre-Startup Safety Review (PSSR)</h1><h2 style="color: #6b7280; font-weight: normal; margin-top: 0;">Test Mode Report</h2><p style="font-size: 12px; color: #9ca3af;">Generated: ${new Date().toLocaleDateString()} | Progress: ${completedItems}/${totalItems} items reviewed</p></div><h2 style="color: #1E3A5F;">PSSR Checklist Items</h2><table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Item</th><th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #d1d5db; width: 80px;">Status</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Notes</th></tr></thead><tbody>${itemsHtml}</tbody></table>${actionItemsHtml}${rosterHtml}<div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">Management of Change System — PSSR Test Report generated on ${new Date().toLocaleDateString()}</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">PSSR Checklist — Test Mode</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Test the Pre-Startup Safety Review checklist without creating a MOC. Progress: {completedItems}/{totalItems} items reviewed.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export PSSR
        </button>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }} />
      </div>

      {PSSR_CATEGORIES.map((cat) => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        const catLabel = (PSSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat;
        const allNa = catItems.every((item) => item.status === 'na');
        return (
          <div key={cat} className={`card mb-4 ${allNa ? 'opacity-50' : ''}`}>
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{catLabel}</h4>
            <div className="space-y-2">
              {catItems.map((item) => {
                const isNa = item.status === 'na';
                return (
                  <div key={item.id} className={`p-3 rounded-lg border transition-all ${
                    isNa ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
                      : item.status === 'fail' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-100 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <select
                        value={item.status}
                        onChange={(e) => updateItem(item.id, e.target.value as ItemStatus)}
                        className={`text-xs rounded border px-2 py-1 font-medium flex-shrink-0 ${
                          item.status === 'pass' ? 'bg-green-50 border-green-300 text-green-700'
                          : item.status === 'fail' ? 'bg-red-50 border-red-300 text-red-700'
                          : item.status === 'na' ? 'bg-gray-100 border-gray-300 text-gray-400'
                          : 'bg-yellow-50 border-yellow-300 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="pass">Yes</option>
                        <option value="fail">No</option>
                        <option value="na">N/A</option>
                      </select>
                      <span className={`text-sm flex-1 ${isNa ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.description}</span>
                    </div>
                    {!isNa && (
                      <textarea
                        value={item.notes}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                        placeholder={item.status === 'fail' ? 'Required: describe corrective action needed...' : 'Add notes...'}
                        rows={1}
                        className={`mt-2 input-field text-xs w-full resize-none ${item.status === 'fail' ? 'border-red-300' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {actionItems.length > 0 && (
        <div className="card mb-4 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10">
          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3">Action Items ({actionItems.length})</h4>
          <div className="space-y-2">
            {actionItems.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-red-600 bg-red-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-red-500">{(PSSR_CATEGORY_LABELS as Record<string, string>)[item.category] || item.category}</span>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{item.description}</p>
                    {item.notes && <p className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-2"><strong>Notes:</strong> {item.notes}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
