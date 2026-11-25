// The automatic approval rule: only an exact validator match can publish without the owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {publishable, autoApproved, ownerDecided, AUTO_VALIDATOR, AUTO_METHOD} from '../../netlify/lib/brain-approvals.mjs';

const auto = {decision:'approved_for_staging', reviewedBy:AUTO_VALIDATOR, reviewMethod:AUTO_METHOD, autoPublish:true};
test('an exact validator match publishes automatically', () => {
  assert.equal(autoApproved(auto), true);
  assert.equal(publishable(auto), true);
  assert.equal(ownerDecided(auto), false, 'an automatic approval never blocks an owner decision');
});
test('anything less than an exact automatic match still waits for the owner', () => {
  assert.equal(publishable({...auto, autoPublish:false}), false);
  assert.equal(publishable({...auto, reviewMethod:'fuzzy_name'}), false);
  assert.equal(publishable({...auto, decision:'pending_owner_review'}), false);
  assert.equal(publishable({decision:'approved_for_staging', reviewedBy:'auto-validator-held', autoPublish:true, reviewMethod:AUTO_METHOD}), false, 'a held match needs the owner');
});
test('owner approvals still publish and stay final', () => {
  assert.equal(publishable({decision:'approved_for_staging', reviewedBy:'owner'}), true);
  assert.equal(ownerDecided({reviewedBy:'owner'}), true);
});
