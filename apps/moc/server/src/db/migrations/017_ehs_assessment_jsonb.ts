import type { Knex } from 'knex';

/**
 * Convert ehs_assessment from text[] (array of "Yes" question keys)
 * to jsonb (object mapping every question key to 'yes' | 'no' | 'na').
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Add a temporary jsonb column
  await knex.schema.alterTable('moc_requests', (t) => {
    t.jsonb('ehs_assessment_new').nullable();
  });

  // 2. Migrate existing data: text[] → jsonb object
  //    Keys present in the old array become "yes", all others default to "na".
  const EHS_KEYS = [
    'outside_building', 'alter_egress', 'new_chemicals', 'waste_emissions',
    'water_cooling', 'alter_pollution_control', 'machine_safeguarding',
    'radiation_laser', 'pressure_vessel', 'high_voltage', 'fire_suppression',
    'lockout_tagout', 'ladders_platforms', 'non_standard_ppe',
  ];

  const rows = await knex('moc_requests').select('id', 'ehs_assessment');
  for (const row of rows) {
    const oldArr: string[] = row.ehs_assessment || [];
    const obj: Record<string, string> = {};
    for (const key of EHS_KEYS) {
      obj[key] = oldArr.includes(key) ? 'yes' : 'na';
    }
    await knex('moc_requests')
      .where('id', row.id)
      .update({ ehs_assessment_new: JSON.stringify(obj) });
  }

  // 3. Drop old column and rename new one
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('ehs_assessment');
  });
  await knex.schema.alterTable('moc_requests', (t) => {
    t.renameColumn('ehs_assessment_new', 'ehs_assessment');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Reverse: jsonb → text[]
  await knex.schema.alterTable('moc_requests', (t) => {
    t.specificType('ehs_assessment_old', 'text[]').defaultTo('{}');
  });

  const rows = await knex('moc_requests').select('id', 'ehs_assessment');
  for (const row of rows) {
    const obj: Record<string, string> = typeof row.ehs_assessment === 'string'
      ? JSON.parse(row.ehs_assessment)
      : (row.ehs_assessment || {});
    const arr = Object.entries(obj)
      .filter(([, v]) => v === 'yes')
      .map(([k]) => k);
    await knex('moc_requests')
      .where('id', row.id)
      .update({ ehs_assessment_old: `{${arr.join(',')}}` });
  }

  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('ehs_assessment');
  });
  await knex.schema.alterTable('moc_requests', (t) => {
    t.renameColumn('ehs_assessment_old', 'ehs_assessment');
  });
}
