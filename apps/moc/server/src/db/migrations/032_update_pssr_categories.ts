import type { Knex } from 'knex';

const NEW_CATEGORIES = [
  // Legacy categories (from original migration 006)
  'process_equipment', 'piping_and_valves', 'instrumentation_and_controls', 'electrical_systems',
  'safety_systems', 'emergency_equipment', 'procedures_and_documentation', 'training',
  'environmental_controls', 'chemical_handling',
  // New categories (matching pssr-template.ts)
  'design_and_construction', 'valves_and_piping', 'equipment', 'instrument_and_electrical',
  'computer_software_and_systems', 'operations', 'maintenance', 'relief_devices',
  'fire_protection_and_personnel_safety', 'occupational_health_industrial_hygiene', 'environmental_protection',
];

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE pssr_items DROP CONSTRAINT IF EXISTS pssr_items_category_check');
  await knex.raw(
    `ALTER TABLE pssr_items ADD CONSTRAINT pssr_items_category_check CHECK (category = ANY (ARRAY[${NEW_CATEGORIES.map((c) => `'${c}'`).join(', ')}]))`
  );
}

export async function down(knex: Knex): Promise<void> {
  const OLD_CATEGORIES = [
    'process_equipment', 'piping_and_valves', 'instrumentation_and_controls', 'electrical_systems',
    'safety_systems', 'emergency_equipment', 'procedures_and_documentation', 'training',
    'environmental_controls', 'chemical_handling',
  ];
  await knex.raw('ALTER TABLE pssr_items DROP CONSTRAINT IF EXISTS pssr_items_category_check');
  await knex.raw(
    `ALTER TABLE pssr_items ADD CONSTRAINT pssr_items_category_check CHECK (category = ANY (ARRAY[${OLD_CATEGORIES.map((c) => `'${c}'`).join(', ')}]))`
  );
}
