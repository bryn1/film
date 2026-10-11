/**
 * ErrorState — honest failure block (COMP-NOTES canon: "Något gick fel" +
 * "Vi kunde inte hämta filmerna just nu." + retry "Försök igen"; the
 * missing-key 503 passes its own canon strings "Kan inte visa filmer" /
 * "Ingen TMDB-nyckel är konfigurerad…"). Copy arrives via props; the page
 * picks the strings, this component lays them out.
 *
 * Retry is a real <button> (not a link — no navigation exists) and is
 * rendered only when the caller supplies onRetry: no button that cannot
 * work.
 */

import styles from "./ErrorState.module.css";

export interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.state}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Försök igen
        </button>
      )}
    </div>
  );
}

export default ErrorState;
