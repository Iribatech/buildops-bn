#!/usr/bin/env node
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/database/data-source.js';
import { User } from '../src/user/user.entity.js';
import { Plan } from '../src/plan/plan.entity.js';
import { Subscription } from '../src/subscription/subscription.entity.js';
import { Organization } from '../src/organization/organization.entity.js';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

async function seed() {
  const dataSource = new DataSource(databaseOptions());
  await dataSource.initialize();

  console.log('Seeding database...');

  // Create plans if they don't exist
  const planRepo = dataSource.getRepository(Plan);
  let freePlan = await planRepo.findOne({ where: { name: 'Free' } });
  if (!freePlan) {
    freePlan = await planRepo.save(planRepo.create({
      name: 'Free',
      description: 'Perfect for getting started',
      maxUsers: 5,
      maxProjects: 10,
      maxStorageGb: 1,
      maxOrganizations: 1,
      price: '0.00',
    }));
    console.log('Created Free plan');
  }

  let businessPlan = await planRepo.findOne({ where: { name: 'Business' } });
  if (!businessPlan) {
    businessPlan = await planRepo.save(planRepo.create({
      name: 'Business',
      description: 'For growing businesses',
      maxUsers: 50,
      maxProjects: 100,
      maxStorageGb: 50,
      maxOrganizations: 5,
      price: '49.99',
    }));
    console.log('Created Business plan');
  }

  console.log('Seeding complete!');
  console.log('\nYou can now register a user via POST /api/v1/auth/register');
  
  await dataSource.destroy();
}

seed().catch((e) => {
  console.error('Error seeding:', e);
  process.exit(1);
});
