# Patient Data & Usage Report Feature

## Overview

The dashboard has been updated with a comprehensive patient data management system that includes an expandable usage report with detailed patient information. This feature allows healthcare facilities to track protocols with complete patient information and usage history.

## Features Implemented

### 1. Enhanced Dashboard UI

The dashboard now includes a dedicated **"📋 Usage Report - Protocols with Patient Data"** section that replaces the simple partner performance table.

#### Features:

- **Search Functionality**: Search protocols by patient name, healthcare facility, or protocol code
- **Status Filtering**: Filter protocols by status (Belum Dipakai, Terpakai, Delivered)
- **Expandable Details**: Click on any protocol row to view detailed patient information
- **CSV Export**: Download the usage report as a CSV file for further analysis

### 2. Patient Data Fields

Each protocol now supports the following patient data fields:

| Field                   | Type      | Description                                     |
| ----------------------- | --------- | ----------------------------------------------- |
| **Patient Name**        | Text      | Full name of the patient                        |
| **Healthcare Facility** | Text      | Name of the hospital/clinic/facility            |
| **Occupation**          | Text      | Patient's occupation/profession                 |
| **Marital Status**      | Text      | Marital status (Single, Married, Widowed, etc.) |
| **GPA**                 | Text      | Gravida/Para/Abortus - obstetric history        |
| **Address**             | Text      | Patient's residential address                   |
| **Phone**               | Text      | Contact phone number                            |
| **Age**                 | Number    | Patient's age                                   |
| **Notes**               | Text      | Additional clinical or administrative notes     |
| **Used Date**           | Timestamp | Date when the protocol was used                 |

### 3. Expandable Row Details

Each protocol entry in the table displays basic information with the ability to expand for more details:

**Main Row Shows:**

- Protocol Code
- Patient Name
- Healthcare Facility
- Status (with color-coded badge)
- Used Date
- View Details button

**Expandable Details Show:**

- Occupation
- Marital Status
- GPA (Gravida/Para/Abortus)
- Address
- Phone Number
- Age
- Additional Notes

### 4. API Endpoints

Three new API endpoints have been added to support patient data management:

#### Update Patient Data

```
POST /api/update-patient-data/:code
Content-Type: application/json

{
  "patient_name": "Siti Nurhaliza",
  "healthcare_facility": "Rumah Sakit Umum Pusat",
  "occupation": "Nurse",
  "marital_status": "Married",
  "gpa": "2-1-0",
  "address": "Jl. Merdeka No. 123, Jakarta",
  "phone": "+62-8123456789",
  "age": 35,
  "notes": "Follow-up required in 2 weeks"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Patient data updated successfully"
}
```

#### Retrieve Patient Data

```
GET /api/patient-data/:code
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "PROTO-2024-001",
    "patient_name": "Siti Nurhaliza",
    "healthcare_facility": "Rumah Sakit Umum Pusat",
    "occupation": "Nurse",
    "marital_status": "Married",
    "gpa": "2-1-0",
    "address": "Jl. Merdeka No. 123, Jakarta",
    "phone": "+62-8123456789",
    "age": 35,
    "notes": "Follow-up required in 2 weeks",
    "status": "terpakai",
    "created_at": "2024-11-27T10:30:00Z"
  }
}
```

### 5. Database Migrations

The database has been automatically updated with new columns in the `protocols` table. If columns are missing, they will be added on server startup:

```sql
ALTER TABLE protocols ADD COLUMN patient_name TEXT;
ALTER TABLE protocols ADD COLUMN healthcare_facility TEXT;
ALTER TABLE protocols ADD COLUMN occupation TEXT;
ALTER TABLE protocols ADD COLUMN marital_status TEXT;
ALTER TABLE protocols ADD COLUMN gpa TEXT;
ALTER TABLE protocols ADD COLUMN address TEXT;
ALTER TABLE protocols ADD COLUMN phone TEXT;
ALTER TABLE protocols ADD COLUMN age TEXT;
ALTER TABLE protocols ADD COLUMN notes TEXT;
ALTER TABLE protocols ADD COLUMN used_date TEXT DEFAULT CURRENT_TIMESTAMP;
```

## Usage Guide

### Viewing the Usage Report

1. Navigate to the Dashboard
2. Scroll to the **"📋 Usage Report - Protocols with Patient Data"** section
3. The table displays all protocols with basic patient information

### Expanding Protocol Details

1. Click the **"▶"** arrow icon on the left of any protocol row, OR
2. Click the **"View Details"** button
3. The row will expand to show all patient details
4. Click again to collapse

### Searching Protocols

1. Use the **search box** to find protocols by:
   - Patient name
   - Healthcare facility name
   - Protocol code
2. Search is real-time as you type

### Filtering by Status

1. Use the **status filter dropdown** to show only:
   - All Status (default)
   - Belum Dipakai (Not Used)
   - Terpakai (Used)
   - Delivered
2. Filters can be combined with search

### Downloading Report

1. Click the **"📥 Download Report"** button
2. A CSV file will be generated with:
   - Protocol Code
   - Patient Name
   - Healthcare Facility
   - Occupation
   - Marital Status
   - GPA
   - Address
   - Status
   - Date Used
3. File is named: `usage-report-YYYY-MM-DD.csv`

## Frontend Components

### CSS Classes for Styling

All styles are contained within the dashboard and support responsive design:

- `.usage-report-section` - Main container
- `.protocol-row` - Individual protocol entries
- `.details-row` - Expandable details row
- `.patient-details-card` - Details card styling
- `.status-badge` - Status indicator styling
- `.expand-toggle` - Expandable icon
- `.details-grid` - Details layout grid

### JavaScript Functions

Key functions available in the dashboard:

```javascript
// Toggle expandable details
toggleDetails(element);

// Expand row with animation
expandRow(event, protocolId);

// Setup search and filter
setupReportFilters();

// Download CSV report
downloadReport();
```

## Activity Logging

All updates to patient data are logged in the `activity_logs` table with:

- User ID who made the update
- Action type: `update_patient_data`
- Target type: `protocol`
- Protocol code
- Description with patient name and facility
- Timestamp

## Responsive Design

The feature is fully responsive and works on:

- Desktop computers (full features)
- Tablets (optimized layout)
- Mobile devices (condensed view with scrollable tables)

### Mobile Adjustments:

- Search and filter stack vertically
- Table becomes scrollable horizontally
- Details grid uses single column layout
- Touch-friendly button sizes

## Security

- All endpoints require authentication via `requireAuth` middleware
- Patient data can only be updated by authenticated users
- All database queries use parameterized statements to prevent SQL injection
- Activity logging tracks all modifications

## Future Enhancements

Potential features to add:

1. **Bulk Import**: Import patient data from CSV/Excel
2. **Data Validation**: Add validation for phone numbers, emails, addresses
3. **Patient History**: Track historical data changes
4. **Advanced Reports**: Generate PDF reports with charts
5. **Data Export Formats**: Add Excel, PDF export options
6. **Patient Demographics Analysis**: Analyze by age, occupation, facility type
7. **Integration with EMR/EHR**: Connect to hospital information systems
8. **Mobile App**: Native mobile app for data entry and management

## Troubleshooting

### Patient Data Not Showing

- Ensure database migration ran successfully (check server logs)
- Verify protocol codes exist in the database
- Check that user is properly authenticated

### Search Not Working

- Ensure JavaScript is enabled in browser
- Clear browser cache
- Check browser console for errors

### Export Not Working

- Ensure pop-ups are not blocked in browser
- Check that data is not empty (no rows visible)
- Verify browser has sufficient permissions

## Support

For questions or issues related to this feature, please:

1. Check the server logs for error messages
2. Verify database integrity
3. Ensure all fields are properly validated before submission
4. Contact the development team with specific error messages
