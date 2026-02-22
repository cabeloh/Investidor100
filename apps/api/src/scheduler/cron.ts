/**
 * Cron scheduler — triggers a full fetch cycle on a configurable schedule.
 * Default: every 6 hours ("0 */6 * * *").
 */
import cron from 'node-cron';
import { runFetchCycle } from '../scraper/snapshot.js';

const SCHEDULE = process.env.SCRAPE_SCHEDULE ?? '0 */6 * * *';

export function startScheduler(): void {
  if (!cron.validate(SCHEDULE)) {
    console.error(`[cron] Expressão inválida: "${SCHEDULE}". Scheduler não iniciado.`);
    return;
  }

  cron.schedule(SCHEDULE, async () => {
    console.log(`[cron] Iniciando ciclo de fetch — ${new Date().toISOString()}`);
    try {
      const snapshot = await runFetchCycle();
      const hasErrors = Object.keys(snapshot._errors ?? {}).length > 0;
      console.log(`[cron] Concluído. hasErrors=${hasErrors}`);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? String(e);
      if (msg.startsWith('NO_SESSION') || msg.startsWith('SESSION_EXPIRED')) {
        console.warn(`[cron] ${msg}`);
      } else {
        console.error('[cron] Erro inesperado:', e);
      }
    }
  });

  console.log(`[cron] Scheduler iniciado. Próxima execução: ${SCHEDULE}`);
}
