import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_locations', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('area').notNullable();
    t.unique(['user_id', 'area']);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Seed: Eric Harris (id=3) → zimmer, r_and_d
  // Seed: Haley Kirkwood (id=6) → batch, lab
  const eric = await knex('users').where('id', 3).first();
  const haley = await knex('users').where('id', 6).first();

  const seeds: { user_id: number; area: string }[] = [];
  if (eric) {
    seeds.push({ user_id: 3, area: 'zimmer' }, { user_id: 3, area: 'r_and_d' });
  }
  if (haley) {
    seeds.push({ user_id: 6, area: 'batch' }, { user_id: 6, area: 'lab' });
  }
  if (seeds.length > 0) {
    await knex('user_locations').insert(seeds);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_locations');
}
