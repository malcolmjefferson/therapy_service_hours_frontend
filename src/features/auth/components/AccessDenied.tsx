import { Link } from 'react-router';
import styles from './AuthView.module.css';

export function AccessDenied() {
  return (
    <section className={styles.panel} aria-labelledby="access-denied-title">
      <h2 id="access-denied-title">Access has not been granted</h2>
      <p>Your account needs an active invitation. Please contact your administrator.</p>
      <Link className={styles.link} to="/">
        Back to sign-in
      </Link>
    </section>
  );
}
