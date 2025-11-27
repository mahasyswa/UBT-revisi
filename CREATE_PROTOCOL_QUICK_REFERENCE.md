# Create Protocol - Quick Reference Guide

## 🎯 Feature Overview

A dedicated protocol creation page with role-based access control, enabling administrators and operators to generate medical scanning protocols with unique codes and stock tracking.

## 🔐 Access Control

```
✅ ALLOWED ROLES:
   • Admin - Full access
   • Operator - Full access

❌ BLOCKED ROLES:
   • Distribution Users - Redirected
   • Unauthorized Users - Redirected to Login
```

## 📁 Files Involved

### New Files

- `views/create-protocol.ejs` - Protocol creation UI (570 lines)
- `CREATE_PROTOCOL_FEATURE.md` - Full documentation

### Modified Files

- `server.js` - Added route `/create-protocol` (30 lines)
- `views/dashboard.ejs` - Added navigation link

## 🚀 Quick Start

### For Users

1. Navigate to Dashboard
2. Click "➕ Create Protocol" in header
3. Follow the 3-step wizard:
   - Select Province
   - Choose or Create Partner
   - Set Quantity (1-100)
4. Click "Create Protocol"
5. Done! Protocols are generated with unique codes

### For Developers

```javascript
// Route Access (Admin/Operator Only)
GET /create-protocol
  - Requires: Authentication + Operator/Admin Role
  - Returns: create-protocol.ejs view
  - Logs: view_create_protocol activity

// Protocol Creation (Post Submission)
POST /protocols
  - Input: province, partner_id, quantity
  - Output: Unique protocol codes
  - Logs: create_protocol activity
  - Updates: Stock tracking table
```

## 📋 Protocol Code Format

```
YYYYMMDD + PROVINCE + PARTNER_CODE + TIMESTAMP

Example:
20241127DKIKLNoa1a2b

Breaking Down:
├─ 20241127 = November 27, 2024
├─ DKI = Jakarta Province
├─ KLN = Clinic Partner Code
└─ oa1a2b = Last 6 digits of timestamp
```

**Multiple Protocols:**

```
20241127DKIKLNoa1a2b_001
20241127DKIKLNoa1a2b_002
20241127DKIKLNoa1a2b_003
```

## 🔧 Key Features

| Feature                  | Description                                    |
| ------------------------ | ---------------------------------------------- |
| **Province Selection**   | Dropdown with all Indonesian provinces         |
| **Partner Management**   | View existing or create new partners inline    |
| **Quantity Control**     | 1-100 protocols per batch creation             |
| **Real-Time Validation** | Submit button only enabled with valid input    |
| **Stock Tracking**       | Automatic updates to available/allocated stock |
| **Unique Codes**         | Each protocol gets unique identifiable code    |
| **Activity Logging**     | All creation actions logged for audit trail    |
| **Success Messages**     | Clear feedback on protocol creation            |
| **Responsive Design**    | Mobile, tablet, and desktop support            |

## 🔌 API Endpoints

### Get Partners by Province

```
GET /api/partner/{provinceCode}
Authorization: Required (any authenticated user)

Response: [
  { id: 1, name: "Klinik X", type: "klinik", code: "KLN001" },
  { id: 2, name: "Puskesmas Y", type: "puskesmas", code: "PKM001" }
]
```

### Create New Partner

```
POST /api/partner
Authorization: Required (Admin/Operator)
Content-Type: application/json

Body: {
  name: "Fasilitas Kesehatan",
  type: "klinik|puskesmas|rumah_sakit",
  code: "KLN001",
  province_code: "DKI",
  phone?: "+62812345678",
  address?: "Jalan Kesehatan"
}

Response: {
  success: true,
  partner: { id: 123, name: "...", ... }
}
```

### Create Protocols

```
POST /protocols
Authorization: Required (Admin/Operator)
Content-Type: application/x-www-form-urlencoded

Body: {
  province: "DKI",
  partner_id: 123,
  quantity: 5
}

Response: Redirect to dashboard with success message
```

## 💾 Database Updates

### Protocols Table

- ✅ New records inserted with unique codes
- ✅ Province code stored
- ✅ Partner ID linked
- ✅ Creation timestamp recorded
- ✅ Created by user logged
- ✅ Status set to "created"

### Stock Tracking Table

- ✅ Total allocated increased by quantity
- ✅ Total available increased by quantity
- ✅ Last updated timestamp refreshed

## 📊 Activity Logging

```
Action: view_create_protocol
├─ Triggered: User accesses /create-protocol
├─ Logged: Yes
├─ Visible in: Users Activity Logs

Action: create_protocol
├─ Triggered: User creates new protocols
├─ Logged: Yes
├─ Visible in: Users Activity Logs
└─ Details: Includes partner name and quantity
```

## ✅ Validation Rules

### Province

- ✅ Required
- ✅ Must be valid province code
- ✅ Available on dropdown

### Partner

- ✅ Required
- ✅ Must be active (is_active = 1)
- ✅ Must exist for selected province

### Quantity

- ✅ Required
- ✅ Must be integer
- ✅ Must be >= 1
- ✅ Must be <= 100

### New Partner (if creating)

- ✅ Name: Required, 1-255 chars
- ✅ Type: Required, one of: klinik, puskesmas, rumah_sakit
- ✅ Code: Required, 3-10 alphanumeric chars, unique
- ✅ Phone: Optional, valid phone format
- ✅ Address: Optional, up to 500 chars

## 🎨 User Interface

### Step 1: Select Province

- Dropdown with 34 Indonesian provinces
- Clear labels and visual hierarchy
- Enables Step 2 when selected

### Step 2: Partner Management

- **Available Partners**: Lists all active partners for province
- **Add New Partner**: Inline form if no partners exist
- **Create New**: Button to open inline creation form

### Step 3: Set Quantity

- Number input (1-100 range)
- Real-time preview showing how many will be created
- Warning box with quantity information

### Submit Section

- "Create Protocol" button (enabled when all fields valid)
- "Clear Form" button (resets all fields)
- Loading animation during submission

## 🌐 Responsive Breakpoints

```
Desktop (1024px+):
└─ 2-column grid for form sections
   └─ Full width partner section
   └─ Side-by-side buttons

Tablet (768px-1023px):
└─ 1-2 column grid responsive
   └─ Stacked button group
   └─ Full width inputs

Mobile (<768px):
└─ 1 column layout
   └─ Full width buttons
   └─ Optimized touch targets (44px minimum)
```

## 🛡️ Security Measures

```
✅ Authentication Check
   └─ requireAuth middleware enforces login

✅ Authorization Check
   └─ requireRole("admin", "operator")

✅ Input Validation
   └─ Server-side validation of all inputs
   └─ SQL injection prevention (parameterized queries)

✅ Rate Limiting
   └─ API endpoints rate limited to 200 req/15min

✅ Session Security
   └─ Session-based authentication
   └─ HTTP-Only cookies
   └─ CSRF protection

✅ Audit Trail
   └─ All actions logged with user info
   └─ IP address and User-Agent captured
   └─ Timestamp in WIB timezone
```

## 🐛 Troubleshooting

### "Access Denied" Error

**Cause**: User role is not admin or operator
**Fix**: Contact admin to update user role in database

### "Province list is empty"

**Cause**: Provinces array not loaded
**Fix**: Verify server started correctly, check browser console

### "Partner dropdown disabled"

**Cause**: Province not selected
**Fix**: Select a province from the dropdown first

### "Submit button is disabled"

**Cause**: Required fields not filled
**Fix**: Complete all fields with valid input

### "Protocol creation fails"

**Cause**: Various (partner not active, database error, etc.)
**Fix**: Check browser console, verify inputs, contact admin

## 📈 Monitoring

### Key Metrics to Track

- Total protocols created per day
- Average quantity per batch
- Most used provinces
- Partner creation frequency
- Error rate during creation

### View Logs

```bash
# Activity logs in database
SELECT * FROM activity_logs
WHERE action = 'create_protocol'
ORDER BY created_at DESC;

# View in UI
Dashboard → Users → Activity Logs
```

## 🔄 Integration Points

### Connects With

- ✅ Stock Tracking System (automatic updates)
- ✅ Partner Management (select/create partners)
- ✅ Scanner (scan protocols after creation)
- ✅ Dashboard (view all protocols)
- ✅ Activity Logging (audit trail)
- ✅ Socket.IO (real-time updates)

### Data Flow

```
User Form → Validation → Database Insert → Stock Update →
Notification Emit → Redirect → Dashboard Display
```

## 📚 Related Documentation

- `CREATE_PROTOCOL_FEATURE.md` - Comprehensive feature documentation
- `PATIENT_DATA_FEATURE.md` - Patient data fields
- `IMPLEMENTATION_SUMMARY.md` - System overview
- `server.js` - Route definitions and logic
- `views/create-protocol.ejs` - UI implementation

## 🚀 Performance Tips

1. **Batch Operations**: Create up to 100 protocols at once (more efficient than individual creation)
2. **Partner Reuse**: Create partners once, use many times
3. **Local Caching**: Browser caches province list (load once)
4. **Async Loading**: Partners load asynchronously (no page block)

## 📞 Support

For issues, questions, or feature requests:

1. Check this quick reference guide
2. Review CREATE_PROTOCOL_FEATURE.md
3. Check activity logs for errors
4. Contact system administrator

---

**Last Updated**: November 27, 2024
**Version**: 1.0
**Status**: Production Ready ✅
