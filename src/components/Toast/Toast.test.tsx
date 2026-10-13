import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { vi } from 'vitest';
import { Button } from '../Button';
import { ToastProvider } from './ToastProvider';
import { useToast, type ToastOptions } from './useToast';

function Trigger({ message, options }: { message: string; options?: ToastOptions | undefined }) {
  const toast = useToast();
  return (
    <Button
      onClick={() => {
        toast.show(message, options);
      }}
    >
      Show {message}
    </Button>
  );
}

function renderToast(message: string, options?: ToastOptions) {
  return render(
    <ToastProvider>
      <Trigger message={message} options={options} />
    </ToastProvider>,
  );
}

describe('Toast', () => {
  test('announces a message politely in the status region', async () => {
    renderToast('Entry saved');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show Entry saved' }));
    expect(within(screen.getByRole('status')).getByText('Entry saved')).toBeInTheDocument();
  });

  test('announces an error assertively in the alert region', async () => {
    renderToast('End must be after start', { tone: 'error' });
    await userEvent.setup().click(screen.getByRole('button', { name: /Show/ }));
    expect(within(screen.getByRole('alert')).getByText('End must be after start')).toBeInTheDocument();
    expect(within(screen.getByRole('status')).queryByText('End must be after start')).not.toBeInTheDocument();
  });

  test('keeps the polite region mounted while empty and has no alert until there is an error', () => {
    renderToast('x');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('can be dismissed with the button', async () => {
    renderToast('Entry saved');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show Entry saved' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Entry saved')).not.toBeInTheDocument();
  });

  test('renders the message as text, never markup', async () => {
    renderToast('<img src=x onerror=alert(1)>');
    await userEvent.setup().click(screen.getByRole('button', { name: /Show/ }));
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  test('useToast outside the provider fails loudly', () => {
    expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
  });

  test('has no axe violations with a message showing', async () => {
    const { container } = renderToast('Entry saved');
    await userEvent.setup().click(screen.getByRole('button', { name: /Show/ }));
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});

describe('Toast timing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('closes itself after six seconds, ten for an error', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    render(
      <ToastProvider>
        <Trigger message="Saved" />
        <Trigger message="Failed" options={{ tone: 'error' }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Saved' }));
    await user.click(screen.getByRole('button', { name: 'Show Failed' }));
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });
});
