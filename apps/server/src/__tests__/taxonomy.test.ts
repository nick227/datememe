import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, QuickPickContextType } from '@project/db';
import { QuickPickService } from '../services/QuickPickService';

describe('Taxonomy Integrity & Quick Picks', () => {

  let user: any;
  let carType: any;
  let honda: any;
  let civic: any;
  let accord: any;
  let toyota: any;
  let camry: any;

  beforeAll(async () => {
    carType = await db.entityType.create({ data: { slug: 'car-type-' + Date.now(), label: 'Car Type', pluralLabel: 'Car Types' }});
    
    honda = await db.entity.create({
      data: {
        entityTypeId: carType.id,
        canonicalName: 'Honda',
        slug: 'honda-' + Date.now(),
        status: 'APPROVED'
      }
    });

    civic = await db.entity.create({
      data: { entityTypeId: carType.id, parentId: honda.id, canonicalName: 'Civic', slug: 'civic-' + Date.now(), status: 'APPROVED' }
    });

    accord = await db.entity.create({
      data: { entityTypeId: carType.id, parentId: honda.id, canonicalName: 'Accord', slug: 'accord-' + Date.now(), status: 'APPROVED' }
    });

    toyota = await db.entity.create({
      data: {
        entityTypeId: carType.id,
        canonicalName: 'Toyota',
        slug: 'toyota-' + Date.now(),
        status: 'APPROVED'
      }
    });

    camry = await db.entity.create({
      data: { entityTypeId: carType.id, parentId: toyota.id, canonicalName: 'Camry', slug: 'camry-' + Date.now(), status: 'APPROVED' }
    });

    user = await db.user.create({
      data: {
        email: 'test-' + Date.now() + '@example.com',
        profile: {
          create: {
            username: 'testuser-' + Date.now(),
            displayName: 'Test User',
            birthdate: new Date('1990-01-01')
          }
        }
      },
      include: { profile: true }
    });
  });

  afterAll(async () => {
    await db.quickPickSignal.deleteMany({ where: { profileId: user.profile!.id }});
    await db.profile.delete({ where: { id: user.profile!.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.entity.deleteMany({ where: { entityTypeId: carType.id }});
    await db.entityType.delete({ where: { id: carType.id }});
  });

  it('A-vs-B symmetry & equivalent-context dedupe', async () => {
    const request = {
      profileId: user.profile!.id,
      context: { type: QuickPickContextType.PARENT_ENTITY, id: honda.id },
      limit: 5
    };

    const { pairs } = await QuickPickService.generatePairs(request);
    // Since honda has 2 children (Civic, Accord), there is 1 valid pair.
    
    // We expect 1 pair under narrow traversal, plus maybe some from sideways. 
    // Wait, since we asked for 5, and narrow only has 1, it will traverse sideways (toyota) and broad.
    // Toyota has 1 child (Camry). No pairs can be made from 1 child.
    // Broad has all 3 (Civic, Accord, Camry). So 3 choose 2 = 3 pairs.
    // We expect it to find pairs.
    
    expect(pairs.length).toBeGreaterThan(0);
    
    // Test symmetry dedupe: record a mock signal for Civic vs Accord
    await QuickPickService.recordSignal(user.profile!.id, QuickPickContextType.PARENT_ENTITY, honda.id, civic.id, accord.id);

    // If we request PARENT_ENTITY honda again, Civic vs Accord should NOT be returned for PARENT_ENTITY honda
    const secondPass = await QuickPickService.generatePairs(request);
    
    const hondaPairs = secondPass.pairs.filter(p => p.contextParams.id === honda.id);
    expect(hondaPairs.length).toBe(0); // Should be completely deduplicated from narrow context
  });

  it('Exhausted contexts trigger sideways and broad traversal', async () => {
    const request = {
      profileId: user.profile!.id,
      context: { type: QuickPickContextType.PARENT_ENTITY, id: toyota.id },
      limit: 5
    };

    // Toyota only has 1 child (Camry). Narrow traversal produces 0 pairs.
    // It should traverse sideways to Honda, find Civic/Accord.
    // And broad to Car Type, find Camry/Civic, Camry/Accord.
    const { pairs } = await QuickPickService.generatePairs(request);
    
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.some(p => p.contextParams.type === QuickPickContextType.ENTITY_TYPE)).toBe(true);
  });

  it('Malformed context returns 0 pairs', async () => {
    const request = {
      profileId: user.profile!.id,
      context: { type: QuickPickContextType.PARENT_ENTITY, id: 'does-not-exist' },
      limit: 5
    };

    const { pairs } = await QuickPickService.generatePairs(request);
    expect(pairs.length).toBe(0);
  });
  
  it('Deleted/inactive entities are excluded', async () => {
    // Set accord to rejected
    await db.entity.update({ where: { id: accord.id }, data: { status: 'REJECTED' } });

    const request = {
      profileId: user.profile!.id,
      context: { type: QuickPickContextType.ENTITY_TYPE, id: carType.id },
      limit: 5
    };

    const { pairs } = await QuickPickService.generatePairs(request);
    // Should not contain accord
    const containsAccord = pairs.some(p => p.entityA.id === accord.id || p.entityB.id === accord.id);
    expect(containsAccord).toBe(false);

    // Reset for subsequent tests if any
    await db.entity.update({ where: { id: accord.id }, data: { status: 'APPROVED' } });
  });

});
