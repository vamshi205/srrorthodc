const { cleanOrphanedBankTransactionLinks } = require('./src/services/bankAccountFirebaseService');

async function main() {
  console.log('Running cleanOrphanedBankTransactionLinks...');
  try {
    const count = await cleanOrphanedBankTransactionLinks();
    console.log(`Cleaned and unlinked ${count} orphaned bank transactions!`);
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

main();
