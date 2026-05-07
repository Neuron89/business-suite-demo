'use client';

import { useState } from 'react';
import { DSR_CATEGORIES, DSR_CATEGORY_LABELS } from '@moc/shared';

const DSR_TEMPLATE: { category: string; description: string }[] = [
  // A. Administration
  { category: 'administration', description: 'Based on the current design, is the proposed change consistent with the original Process Hazard Analysis (PHA) assessment?' },
  { category: 'administration', description: 'Does the design comply with ISP Standards?' },
  { category: 'administration', description: 'Has the impact of the change on existing buildings been considered?' },
  { category: 'administration', description: 'Has any impact, beyond unit boundaries, associated with this change been properly dealt with and/or communicated?' },
  { category: 'administration', description: 'Have exposures to existing buildings been considered when siting new vessels, utilities, temporary/permanent buildings or sheds, etc.?' },
  { category: 'administration', description: 'Have noncombustible materials or construction been used?' },

  // B. Material Safety / Regulatory Status
  { category: 'material_safety_regulatory', description: 'Have TSCA change scenarios been considered for applicability?' },
  { category: 'material_safety_regulatory', description: 'Have MSDS or Preliminary Product Safety Data Sheets been obtained for all chemicals to be handled?' },
  { category: 'material_safety_regulatory', description: 'Has the potential for a hazardous chemical reaction in sumps and sewers been considered?' },
  { category: 'material_safety_regulatory', description: 'Have all other potential product regulatory issues been addressed (DOT, FIFRA, BATF, FDA, ISO 9001)?' },

  // C. Pressure / Vacuum Relief
  { category: 'pressure_vacuum_relief', description: 'Have new or modified safety relief devices or vent systems been designed in accordance with requirements?' },
  { category: 'pressure_vacuum_relief', description: 'Has potential for external pressure (vacuum) from sudden cooling, condensing, pump-out, etc. been addressed?' },
  { category: 'pressure_vacuum_relief', description: 'Have only full-port valves been specified for use at inlet and outlet of pressure/vacuum relief devices?' },
  { category: 'pressure_vacuum_relief', description: 'Have any changes to safety relief device inlet or outlet piping been properly reviewed?' },
  { category: 'pressure_vacuum_relief', description: 'Will adequate facilities (alarms, detectors, redundancy) be provided to minimize risk of relief device actuating?' },
  { category: 'pressure_vacuum_relief', description: 'Have the discharges of safety relief devices been located to avoid potential personnel injury?' },
  { category: 'pressure_vacuum_relief', description: 'Has the design included installation of the safety relief valve vertically?' },

  // D. Temperature / Reaction
  { category: 'temperature_reaction', description: 'Has potential for formation of unwanted by-products been adequately addressed?' },
  { category: 'temperature_reaction', description: 'Has potential for loss of flow or reverse flow been adequately addressed?' },
  { category: 'temperature_reaction', description: 'Have adequate provisions been made so that normally dilute but reactive materials cannot be concentrated/accumulated in unexpected areas?' },
  { category: 'temperature_reaction', description: 'Is adequate freeze protection provided?' },

  // E. Valves and Piping
  { category: 'valves_and_piping', description: 'Have the proper Valve and Piping specifications been used?' },
  { category: 'valves_and_piping', description: 'Have cross-tied lines been reviewed to minimize contamination potential and eliminate mixing of reactive chemicals?' },
  { category: 'valves_and_piping', description: 'Have test methods and documentation requirements been specified to ensure integrity of piping systems?' },
  { category: 'valves_and_piping', description: 'Will sample points be properly configured for safe sampling of hazardous chemicals?' },
  { category: 'valves_and_piping', description: 'Have all open ended valves and hand-operated ball valves been designed per environmental requirements?' },
  { category: 'valves_and_piping', description: 'Have hot-taps been reviewed and eliminated where possible?' },
  { category: 'valves_and_piping', description: 'Will necessary excess flow and back-flow prevention measures be provided?' },
  { category: 'valves_and_piping', description: 'Has line expansion and vibration during startup, shutdown, cleaning, etc. been considered?' },
  { category: 'valves_and_piping', description: 'Has the potential risk and consequences of hydraulic hammering been considered?' },
  { category: 'valves_and_piping', description: 'Have appropriate materials of construction been considered for compatibility, corrosion resistance and GMP requirements?' },
  { category: 'valves_and_piping', description: 'Have temporary start-up strainers been identified to ensure removal for normal operation?' },
  { category: 'valves_and_piping', description: 'Has the design included the proper encasing of underground piping at stress points?' },

  // F. Rotating and Mechanical Equipment
  { category: 'rotating_mechanical_equipment', description: 'Have special precautions for safe operation of equipment been considered (reverse flow, minimum flow, etc.)?' },
  { category: 'rotating_mechanical_equipment', description: 'Do new and revised pumps and/or pump seals meet GMP requirements and ISP standards?' },
  { category: 'rotating_mechanical_equipment', description: 'Have lubricants and buffer fluids been properly selected to meet any GMP requirements?' },
  { category: 'rotating_mechanical_equipment', description: 'Will moving parts on machinery be properly guarded?' },
  { category: 'rotating_mechanical_equipment', description: 'Will pumps be located in accordance with ISP Standards?' },
  { category: 'rotating_mechanical_equipment', description: 'Are the emergency shutdown systems adequate (overspeed, ground fault, high temperature, vibration, etc.)?' },
  { category: 'rotating_mechanical_equipment', description: 'Have appropriate materials of construction been considered for compatibility, corrosion resistance and GMP requirements?' },
  { category: 'rotating_mechanical_equipment', description: 'Will adequate pressure relief be provided for new or modified pump systems?' },

  // G. Instrumentation
  { category: 'instrumentation', description: 'Has the potential for instrument failure been adequately addressed?' },
  { category: 'instrumentation', description: 'Have all new shutdown devices been designed to permit testing?' },
  { category: 'instrumentation', description: 'Have potential consequences of instrument or computer failure been considered (redundancy, backup power, etc.)?' },
  { category: 'instrumentation', description: 'Has control valve fail-safe position on loss of electric power or air/nitrogen been properly specified?' },
  { category: 'instrumentation', description: 'Have provisions been made to safeguard against risks of control valves going full open or closed?' },
  { category: 'instrumentation', description: 'If the change affects a shutdown or ESD system, have issues been addressed?' },
  { category: 'instrumentation', description: 'Will alarms associated with critical instruments be clearly displayed in the control room?' },
  { category: 'instrumentation', description: 'Have any special concerns with response time or sequencing been adequately addressed?' },
  { category: 'instrumentation', description: 'Have process changes been considered in the design of new and existing instrumentation?' },
  { category: 'instrumentation', description: 'Has ESD control logic been reviewed?' },
  { category: 'instrumentation', description: 'Will temperature elements be mounted in thermo wells?' },
  { category: 'instrumentation', description: 'Have appropriate materials of construction been considered for compatibility and GMP requirements?' },
  { category: 'instrumentation', description: 'Has adequate local instrumentation been addressed for safety and trouble-shooting purposes?' },
  { category: 'instrumentation', description: 'Is the location of sensing elements proper to ensure correct measurement?' },

  // H. Electrical Systems
  { category: 'electrical_systems', description: 'Have instrumentation and electrical equipment enclosures been specified to meet the electrical classification of the area?' },
  { category: 'electrical_systems', description: 'Have wire gauges, starters and overloads been properly sized per the National Electric Code?' },
  { category: 'electrical_systems', description: 'Has the design considered requirements of Electrical Hot Work and Cranes Near Power Lines?' },
  { category: 'electrical_systems', description: 'Has the design included adequate room for ventilation of transformers, motors, etc.?' },

  // I. Fire Protection
  { category: 'fire_protection', description: 'Has the potential for static electricity buildup been adequately addressed?' },
  { category: 'fire_protection', description: 'Has proper grounding of all electrical and process equipment been specified?' },
  { category: 'fire_protection', description: 'Will fire containment be adequate where hazardous or reactive chemicals are present?' },
  { category: 'fire_protection', description: 'Has spontaneous heating of leakage into insulation been adequately considered?' },
  { category: 'fire_protection', description: 'Are provisions made for safe handling of flammable or potentially explosive materials?' },
  { category: 'fire_protection', description: 'Are all fire water spray system modifications being designed by qualified personnel?' },
  { category: 'fire_protection', description: 'Have modifications to fire protection systems been reviewed by Safety Department and/or property insurance carrier?' },
  { category: 'fire_protection', description: 'Will vents potentially containing flammables be provided with adequate safety equipment?' },
  { category: 'fire_protection', description: 'Will an adequate detection and response system be provided where a vapor cloud is likely?' },
  { category: 'fire_protection', description: 'Have the risks associated with any ignition source or explosive gas mixture been adequately dealt with?' },
  { category: 'fire_protection', description: 'Has adequate fire safety equipment been specified and located where needed?' },
  { category: 'fire_protection', description: 'Has deluge water overflow from containment systems been determined and reviewed properly?' },
  { category: 'fire_protection', description: 'Is diking, curbing, or drainage adequate to contain spills and contaminated rainwater (RCRA)?' },

  // J. Personnel Health & Industrial Hygiene
  { category: 'personnel_health_industrial_hygiene', description: 'Does the design adequately consider medical, industrial hygiene, ergonomic and GMP factors?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Have adequate provisions been specified for safe handling and sampling of hazardous materials?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Have personnel safety devices (showers, eye baths, fall prevention, breathing air) been specified?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Will all asbestos-containing insulation be removed/repaired per plant requirements?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Will secondary surfaces (grating, slip protection) be provided where freezing or slippery materials are handled?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Has confined space entry been adequately addressed in this design?' },
];

type ItemStatus = 'pending' | 'pass' | 'fail' | 'na';

export default function DsrTestPage() {
  const [items, setItems] = useState(() =>
    DSR_TEMPLATE.map((t, i) => ({ id: i, ...t, status: 'pending' as ItemStatus, notes: '' }))
  );

  function updateItem(id: number, status: ItemStatus) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
  }
  function updateNotes(id: number, notes: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, notes } : item));
  }

  const grouped = DSR_CATEGORIES.reduce((acc: Record<string, typeof items>, cat) => {
    acc[cat] = items.filter((item) => item.category === cat);
    return acc;
  }, {} as Record<string, typeof items>);

  const totalItems = items.length;
  const completedItems = items.filter((i) => i.status !== 'pending').length;
  const actionItems = items.filter((i) => i.status === 'fail');

  function handleExport() {
    const catLabel = (cat: string) => (DSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const statusLabel = (s: string) => s === 'pass' ? 'Yes' : s === 'fail' ? 'No' : s === 'na' ? 'N/A' : 'Pending';
    const statusColor = (s: string) => s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : s === 'na' ? '#9ca3af' : '#ca8a04';

    let itemsHtml = '';
    for (const cat of DSR_CATEGORIES) {
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
      actionItemsHtml = `<h2 style="color: #dc2626; margin-top: 32px;">Deficiencies / Action Items</h2><p style="font-size: 12px; color: #dc2626; margin-bottom: 8px;">Items marked "No" must be reported in writing to the Department Manager or designee and the change originator.</p><table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><thead><tr style="background: #fef2f2;"><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">#</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Category</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Item</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Notes</th><th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #fca5a5; width: 80px;">Resolved</th></tr></thead><tbody>${actionItems.map((item, idx) => `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${catLabel(item.category)}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.notes || 'No notes provided'}</td><td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">&#9744;</td></tr>`).join('')}</tbody></table>`;
    }

    let rosterHtml = `<h2 style="margin-top: 32px;">Sign-Off Roster</h2><p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">All parties must review the DSR and deficiencies, then sign below.</p><table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Department / Role</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Name</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Date</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Signature</th></tr></thead><tbody>`;
    for (let i = 0; i < 8; i++) {
      rosterHtml += `<tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">_______________</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; min-width: 200px;">________________________</td></tr>`;
    }
    rosterHtml += '</tbody></table>';

    const html = `<!DOCTYPE html><html><head><title>DSR Report — Test Mode</title><style>@media print { body { margin: 0; } .no-print { display: none; } } body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px; color: #374151; } table { page-break-inside: auto; } tr { page-break-inside: avoid; }</style></head><body><div style="text-align: center; margin-bottom: 24px;"><h1 style="color: #1E3A5F; margin-bottom: 4px;">Design Safety Review (DSR)</h1><h2 style="color: #6b7280; font-weight: normal; margin-top: 0;">Test Mode Report</h2><p style="font-size: 12px; color: #9ca3af;">Generated: ${new Date().toLocaleDateString()} | Progress: ${completedItems}/${totalItems} items reviewed</p></div><h2 style="color: #1E3A5F;">DSR Checklist Items</h2><table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><thead><tr style="background: #f3f4f6;"><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Item</th><th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #d1d5db; width: 80px;">Status</th><th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Notes</th></tr></thead><tbody>${itemsHtml}</tbody></table>${actionItemsHtml}${rosterHtml}<div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">Management of Change System — DSR Test Report generated on ${new Date().toLocaleDateString()}</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">DSR Checklist — Test Mode</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Test the Design Safety Review checklist without creating a MOC. Progress: {completedItems}/{totalItems} items reviewed.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export DSR
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 italic">
        &quot;NO&quot; answers are considered deficiencies and must be reported in writing to the Department Manager or designee and the change originator.
      </p>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }} />
      </div>

      {DSR_CATEGORIES.map((cat) => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        const catLabel = (DSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat;
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
                        placeholder={item.status === 'fail' ? 'Required: describe the deficiency...' : 'Add notes...'}
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
          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3">Deficiencies ({actionItems.length})</h4>
          <p className="text-xs text-red-600 mb-3">Items marked &quot;No&quot; must be reported in writing to the Department Manager or designee.</p>
          <div className="space-y-2">
            {actionItems.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-red-600 bg-red-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-red-500">{(DSR_CATEGORY_LABELS as Record<string, string>)[item.category] || item.category}</span>
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
