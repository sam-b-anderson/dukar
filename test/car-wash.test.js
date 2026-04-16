const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreCarWash } = require('../src/tests/car-wash');

test('scoreCarWash: drive appears first → pass', () => {
  assert.equal(
    scoreCarWash('You should drive the car. You cannot walk because the car has to be washed.'),
    'pass'
  );
});

test('scoreCarWash: walk appears first → fail', () => {
  assert.equal(
    scoreCarWash('50 meters is short, just walk there. You could drive but it is unnecessary.'),
    'fail'
  );
});

test('scoreCarWash: case insensitive', () => {
  assert.equal(scoreCarWash('DRIVE the car. You cannot walk it.'), 'pass');
  assert.equal(scoreCarWash('Just WALK over. No need to drive.'), 'fail');
});

test('scoreCarWash: neither word → fail (short response)', () => {
  assert.equal(scoreCarWash('Interesting question.'), 'fail');
});

test('scoreCarWash: long response that never says drive or walk → fail', () => {
  const text = 'I would not bother making this trip at all. The vehicle is fine where it sits. '.repeat(5);
  assert.equal(scoreCarWash(text), 'fail');
});

test('scoreCarWash: allowHedged picks up the hedged pattern in first 300 chars', () => {
  const hedged =
    'You could walk the 50m, but you need to drive the car there because the car has to be physically at the car wash. So drive is correct.';
  assert.equal(scoreCarWash(hedged, true), 'pass-hedged');
});

test('scoreCarWash: allowHedged without hedged phrase falls through to standard scoring', () => {
  const text = 'Just drive over. Walking would be silly for 50 meters.';
  assert.equal(scoreCarWash(text, true), 'pass');
});

test('scoreCarWash: allowHedged with walk first and no hedged phrase → fail', () => {
  const text = 'Walk there. Driving is overkill for 50m.';
  assert.equal(scoreCarWash(text, true), 'fail');
});

test('scoreCarWash: allowHedged requires BOTH drive and walk in first 300 chars', () => {
  const onlyDrive = 'Drive, obviously. The car needs to be at the wash.';
  assert.equal(scoreCarWash(onlyDrive, true), 'pass');
});

test('scoreCarWash: word-boundary guards against partial matches (drives/walker)', () => {
  const result = scoreCarWash('The driver walks over. This response has neither exact word.');
  assert.equal(result, 'fail');
});
