import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPostLoginPage,
  isNavigationItemActive,
  normalizePageId,
} from '../src/services/navigation.js';

test('staff login opens the Executive Dashboard and patients open the Patient Portal', () => {
  for (const role of ['Hospital Management', 'Admin', 'Doctor', 'Radiologist', 'Nurse']) {
    assert.equal(getPostLoginPage(role), 'command', `${role} should open the Executive Dashboard`);
  }
  assert.equal(getPostLoginPage('Patient'), 'portal');
});

test('dashboard and card lab aliases resolve to the rendered page IDs', () => {
  assert.equal(normalizePageId('executive-dashboard'), 'command');
  assert.equal(normalizePageId('lab-dashboard'), 'lab');
  assert.equal(normalizePageId('card-lab'), 'lab');
  assert.equal(normalizePageId('lab'), 'lab');
});

test('sidebar highlights Executive Dashboard and Lab for canonical and legacy page IDs', () => {
  assert.equal(isNavigationItemActive('command', 'command'), true);
  assert.equal(isNavigationItemActive('executive-dashboard', 'command'), true);
  assert.equal(isNavigationItemActive('lab', 'lab'), true);
  assert.equal(isNavigationItemActive('lab-dashboard', 'lab'), true);
  assert.equal(isNavigationItemActive('card-lab', 'lab'), true);
  assert.equal(isNavigationItemActive('lab', 'criticalvalues'), false);
});

test('page IDs are normalized case-insensitively without changing unrelated pages', () => {
  assert.equal(normalizePageId('LAB-DASHBOARD'), 'lab');
  assert.equal(normalizePageId('appointments'), 'appointments');
});
