import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { EntriesEmpty } from './EntriesEmpty';

test('an empty list with filters says nothing matches and how to get entries back', () => {
  render(<EntriesEmpty filtered />);
  expect(screen.getByText(/No entries match these filters/)).toBeInTheDocument();
  expect(screen.getByText(/Clear the filters/)).toBeInTheDocument();
});

test('an empty list without filters says there are no entries yet', () => {
  render(<EntriesEmpty filtered={false} />);
  expect(screen.getByText(/No entries yet/)).toBeInTheDocument();
  expect(screen.queryByText(/Clear the filters/)).toBeNull();
});
