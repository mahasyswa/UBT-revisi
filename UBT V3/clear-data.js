const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const db = new sqlite3.Database(path.join(__dirname, 'data.db'));

console.log('Clearing existing data to pristine state (preserving users/admin)...');

db.serialize(() => {
  // Clear protocols
  db.run('DELETE FROM protocols', function(err) {
    if (err) {
      console.error('Error clearing protocols:', err.message);
    } else {
      console.log(`✅ Cleared ${this.changes} protocols`);
    }
  });
  
  // Reset AUTOINCREMENT sequence for protocols so new IDs start from 1
  db.run("DELETE FROM sqlite_sequence WHERE name = 'protocols'", function(err) {
    if (err) {
      // sqlite_sequence may not exist until a table with AUTOINCREMENT has inserted rows
      console.warn('Warning resetting protocols sequence (may be expected if no sequence yet):', err.message);
    } else {
      console.log('🔁 Reset AUTOINCREMENT sequence for protocols');
    }
  });
  
  // Clear partners (business data)
  db.run('DELETE FROM partners', function(err) {
    if (err) {
      console.error('Error clearing partners:', err.message);
    } else {
      console.log(`✅ Cleared ${this.changes} partners`);
    }
  });
  
  // Clear stock tracking (depends on partners)
  db.run('DELETE FROM stock_tracking', function(err) {
    if (err) {
      console.error('Error clearing stock tracking:', err.message);
    } else {
      console.log(`✅ Cleared ${this.changes} stock tracking records`);
    }
  });
  
  // Reset sequences for partners and stock_tracking
  db.run("DELETE FROM sqlite_sequence WHERE name = 'partners'", function(err) {
    if (err) {
      console.warn('Warning resetting partners sequence:', err.message);
    } else {
      console.log('🔁 Reset AUTOINCREMENT sequence for partners');
    }
  });
  db.run("DELETE FROM sqlite_sequence WHERE name = 'stock_tracking'", function(err) {
    if (err) {
      console.warn('Warning resetting stock_tracking sequence:', err.message);
    } else {
      console.log('🔁 Reset AUTOINCREMENT sequence for stock_tracking');
    }
  });
  
  // Clear activity logs
  db.run('DELETE FROM activity_logs', function(err) {
    if (err) {
      console.error('Error clearing activity logs:', err.message);
    } else {
      console.log(`✅ Cleared ${this.changes} activity logs`);
    }
  });
  
  // Clear analytics data
  db.run('DELETE FROM analytics_daily', function(err) {
    if (err) {
      console.error('Error clearing analytics data:', err.message);
    } else {
      console.log(`✅ Cleared ${this.changes} analytics records`);
    }
  });
  
  console.log('\nPreserving users table (admin account remains).');
  
  console.log('\n✅ Data clearing completed!');
  console.log('All protocols, partners, stock tracking, activity logs, and analytics data have been cleared.');
  console.log('All AUTOINCREMENT sequences have been reset for business tables. Users are preserved.\n');
  
  db.close();
});