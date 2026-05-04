process.env.OPENCLAW_TEST_MODE = '1';
process.env.DELIVERY_DRY_RUN = '1';
import('./dist/cli.js').then(async (m) => {
  await m.runCli(['notify', '--date', '2026-05-01']);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
