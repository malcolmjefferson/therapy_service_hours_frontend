import type { components } from '../../../lib/api';
import { SKIP_REASON_LABEL, reportSummary } from '../model/importReport';
import styles from './Import.module.css';

type ImportReport = components['schemas']['ImportReport'];

/** What an import did: counts, merged clients and a table of skipped rows with the reason for each. */
export function ImportReportView({ report }: { report: ImportReport }) {
  const created = report.merged_clients.filter((merged) => merged.created).length;
  return (
    <div className={styles.report}>
      <p role="status" className={styles.summary}>
        {reportSummary(report)}
      </p>
      <ul className={styles.counts}>
        <li>{report.imported_count} imported</li>
        <li>{report.needs_time_count} need a time</li>
        <li>{report.skipped_count} skipped</li>
        <li>{created} new clients</li>
      </ul>
      {report.needs_time_count > 0 ? (
        <p>Entries that need a time are marked in the table. Edit one to add its start and end.</p>
      ) : null}
      {report.skipped_rows.length > 0 ? (
        <table className={styles.skipped}>
          <caption>Skipped rows</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Reason</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {report.skipped_rows.map((skipped) => (
              <tr key={skipped.row}>
                <td>{skipped.row}</td>
                <td>{SKIP_REASON_LABEL[skipped.reason]}</td>
                <td>{skipped.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
