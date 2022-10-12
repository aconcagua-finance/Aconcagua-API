/* eslint-disable no-undef */
describe('index', () => {
  test('requires without error', () => {
    expect(() => require('./index')).not.toThrow();
  });
});
