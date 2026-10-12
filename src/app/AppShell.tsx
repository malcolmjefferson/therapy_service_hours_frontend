import { Outlet } from 'react-router';
import styles from './AppShell.module.css';
import { AuthUserMenu } from '../features/auth';

/** Page frame: header with title and kicker, then the routed page (CLAUDE.md §12.1). */
export function AppShell() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Therapy Service Hours</p>
        <h1 className={styles.title}>Clinical Hours Ledger</h1>
        <AuthUserMenu />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
