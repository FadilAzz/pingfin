// Background poller — keeps things flowing without manual API calls.
const cron = require('node-cron');
const ob = require('./obProcessor');
const bb = require('./bbProcessor');
const Logger = require('./logger');

function startPoller() {
  if (process.env.POLL_ENABLED !== 'true') {
    console.log('[poller] disabled (POLL_ENABLED != true)');
    return;
  }
  const interval = parseInt(process.env.POLL_INTERVAL_SECONDS || '30', 10);
  const cronExpr = `*/${interval} * * * * *`;
  console.log(`[poller] starting, every ${interval}s`);

  cron.schedule(cronExpr, async () => {
    try {
      // OB side: process pending PO_NEW, send PO_OUT, pull ACKs
      await ob.processPoNew();
      await ob.sendPoOutToCB();
      await ob.pullAcksFromCB();

      // BB side: pull from CB, process, send ACK_OUT
      await bb.pullPoFromCB();
      await bb.processPoIn();
      await bb.sendAckOutToCB();
    } catch (err) {
      Logger.error(`Poller cycle failed: ${err.message}`);
    }
  });
}

module.exports = { startPoller };
