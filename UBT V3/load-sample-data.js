// Deprecated: No-op loader retained for backward compatibility in docs/checklists only.
module.exports = async function loadSampleData() {
  console.log('load-sample-data.js is deprecated. No actions performed.');
};

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');

console.log('🔄 Loading sample data for presentation...\n');

// Sample protocols untuk UBT (Uterine Balloon Tamponade) Distribution
const sampleProtocols = [
  {
    code: '20251006-JKTSEL-A1B2',
    name: 'UBT Distribution Batch-A',
    description: 'Distribusi UBT untuk RS rujukan perdarahan postpartum Jakarta Selatan',
    province: 'DKI Jakarta',
    recipient_name: 'RSUP Fatmawati',
    recipient_phone: '021-7501524',
    status: 'created',
    created_at: '2025-10-01 08:00:00'
  },
  {
    code: '20251006-JKTBAR-C3D4',
    name: 'UBT Distribution Batch-B',
    description: 'Pengiriman UBT emergency stock untuk kasus perdarahan obstetri',
    province: 'DKI Jakarta',
    recipient_name: 'RS Sumber Waras',
    recipient_phone: '021-5689531',
    status: 'delivered',
    created_at: '2025-10-02 09:30:00'
  },
  {
    code: '20251006-JKTTIM-E5F6',
    name: 'UBT Kit Maternal Emergency',
    description: 'UBT kit lengkap untuk penanganan perdarahan postpartum berat',
    province: 'DKI Jakarta',
    recipient_name: 'RSUD Pasar Rebo',
    recipient_phone: '021-8400437',
    status: 'terpakai',
    created_at: '2025-10-03 10:15:00'
  },
  {
    code: '20251006-JKTPUS-G7H8',
    name: 'UBT Resupply Program',
    description: 'Pengisian kembali stock UBT untuk program maternal health',
    province: 'DKI Jakarta',
    recipient_name: 'RSCM Kencana',
    recipient_phone: '021-31900001',
    status: 'created',
    created_at: '2025-10-04 11:00:00'
  },
  {
    code: '20251006-JKTUT-I9J0',
    name: 'UBT Emergency Kit',
    description: 'Distribusi UBT untuk emergency obstetric care unit',
    province: 'DKI Jakarta',
    recipient_name: 'RSUD Koja',
    recipient_phone: '021-43930223',
    status: 'delivered',
    created_at: '2025-10-05 13:45:00'
  }
];

// Check if sample data already exists
db.get('SELECT COUNT(*) as count FROM protocols WHERE code LIKE "20251006-%"', (err, row) => {
  if (err) {
    console.error('❌ Error checking database:', err);
    db.close();
    return;
  }

  if (row.count > 0) {
    console.log(`⚠️  Sample data sudah ada (${row.count} protocols)`);
    console.log('   Jika ingin reset, hapus data.db dan restart server\n');
    db.close();
    return;
  }

  console.log('📝 Inserting sample protocols...');
  
  const stmt = db.prepare(`
    INSERT INTO protocols (code, name, description, province, recipient_name, recipient_phone, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  sampleProtocols.forEach((protocol, index) => {
    stmt.run(
      protocol.code,
      protocol.name,
      protocol.description,
      protocol.province,
      protocol.recipient_name,
      protocol.recipient_phone,
      protocol.status,
      protocol.created_at,
      (err) => {
        if (err) {
          console.error(`   ❌ Failed to insert ${protocol.code}`);
        } else {
          inserted++;
          console.log(`   ✓ ${protocol.code} - ${protocol.name}`);
        }

        if (index === sampleProtocols.length - 1) {
          stmt.finalize();
          
          // Add activity logs
          console.log('\n📊 Adding activity logs...');
          const logStmt = db.prepare(`
            INSERT INTO activity_log (protocol_code, action, changed_by, timestamp, notes)
            VALUES (?, ?, ?, ?, ?)
          `);

          const activities = [
            ['20251006-JKTBAR-C3D4', 'status_change', 'scanner', '2025-10-02 14:00:00', 'Status changed to delivered'],
            ['20251006-JKTTIM-E5F6', 'status_change', 'scanner', '2025-10-03 15:30:00', 'Status changed to delivered'],
            ['20251006-JKTTIM-E5F6', 'status_change', 'scanner', '2025-10-04 09:00:00', 'Status changed to terpakai'],
            ['20251006-JKTUT-I9J0', 'status_change', 'scanner', '2025-10-05 16:00:00', 'Status changed to delivered']
          ];

          activities.forEach((activity, idx) => {
            logStmt.run(...activity, (err) => {
              if (!err) console.log(`   ✓ Activity log ${idx + 1}`);
              
              if (idx === activities.length - 1) {
                logStmt.finalize();
                
                console.log('\n✅ Sample data loaded successfully!');
                console.log(`   ${inserted} protocols added`);
                console.log(`   ${activities.length} activity logs added`);
                console.log('\n🚀 Ready for presentation!');
                console.log('   Start server: npm start\n');
                
                db.close();
              }
            });
          });
        }
      }
    );
  });
});
