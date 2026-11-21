import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConteggioJolly } from '../../components/game';

// The count shows the seconds left, never more than the time to choose of the game
describe('ConteggioJolly', () => {
  const NOW = new Date('2026-01-01T10:00:00Z').getTime();

  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  const seconds = (props) => render(<ConteggioJolly scadenza={NOW + 100_000} {...props} />).container.textContent;

  test('shows the seconds left, up to the time to choose of the game', () => {
    expect(seconds({ durata: 45 })).toBe('45 s');
  });

  test('a time to choose longer than what is left shows what is left', () => {
    expect(seconds({ durata: 120 })).toBe('100 s');
  });

  test('without the time to choose of the game there is no cap, and no number is invented', () => {
    expect(seconds({})).toBe('100 s');
  });

  test('a moment already past shows 0', () => {
    expect(render(<ConteggioJolly scadenza={NOW - 5_000} durata={30} />).container.textContent).toBe('0 s');
  });
});
