# Implementasi Approval Timeline untuk Lembur

## Overview

Implementasi ini menambahkan sistem tracking approval yang komprehensif untuk pengajuan lembur. Setiap pengajuan lembur sekarang dapat menampilkan status persetujuan dari berbagai pihak dalam bentuk timeline yang visual dan informatif.

## Field Approval yang Ditambahkan

### Interface Lembur (directus.ts)

```typescript
// Approval workflow fields
approval_stage?: "manager_divisi" | "hrd_admin" | "manager_hrd" | "direktur" | "completed" | null;
overall_status?: "pending" | "approved" | "rejected";

// Manager Divisi approval (Stage 1)
manager_divisi_approved?: boolean;
manager_divisi_approved_by?: string;
manager_divisi_approved_date?: string;
manager_divisi_rejection_reason?: string;

// HRD Admin approval (Stage 2)
hrd_admin_approved?: boolean;
hrd_admin_approved_by?: string;
hrd_admin_approved_date?: string;
hrd_admin_rejection_reason?: string;

// Manager HRD approval (Stage 3)
manager_hrd_approved?: boolean;
manager_hrd_approved_by?: string;
manager_hrd_approved_date?: string;
manager_hrd_rejection_reason?: string;

// Direktur approval (Stage 4)
direktur_approved?: boolean;
direktur_approved_by?: string;
direktur_approved_date?: string;
direktur_rejection_reason?: string;

// Final approval data
final_approved_by?: string;
final_approved_date?: string;
final_rejection_reason?: string;
```

## Utility Functions (lembur.ts)

### 1. `getApprovalStages(lembur: Lembur): ApprovalStageInfo[]`

Mengambil informasi lengkap tentang semua tahapan approval dalam urutan yang benar.

### 2. `getCurrentApprovalStatus(lembur: Lembur)`

Mendapatkan status approval saat ini dan informasi tahapan yang sedang berlangsung.

### 3. `formatApprovalDate(dateString?: string): string`

Format tanggal approval dalam format yang mudah dibaca (Indonesia) tanpa jam.

### 4. `getApprovalStatusIcon()` & `getApprovalStatusColor()`

Mendapatkan ikon dan warna yang sesuai untuk setiap status approval.

## UI Components

### Approval Timeline

- **Header**: Menampilkan judul dan overall status badge
- **Stages**: Timeline vertical dengan indikator untuk setiap tahap
- **Stage Content**: Detail untuk setiap tahap termasuk:
  - Status (Disetujui/Ditolak/Pending)
  - Nama approver
  - Tanggal keputusan
  - Alasan penolakan (jika ada)

### Final Approval Section

- Khusus untuk pengajuan yang sudah mendapat persetujuan final
- Menampilkan informasi final approver dan tanggal
- Desain berbeda untuk menandakan completion

### Visual Indicators

- **Ikon Status**:
  - ⏰ (fa-clock) untuk pending
  - ✅ (fa-check-circle) untuk approved
  - ❌ (fa-times-circle) untuk rejected
- **Warna**:
  - Amber (#f59e0b) untuk pending
  - Green (#10b981) untuk approved
  - Red (#ef4444) untuk rejected

## Fitur

### 1. Timeline Progression

- Connector lines menunjukkan progress antar tahapan
- Active state untuk tahapan yang sudah selesai
- Visual hierarchy yang jelas

### 2. Responsive Design

- Optimized untuk mobile dan desktop
- Adjustable icon sizes dan spacing
- Flexible layout untuk berbagai screen sizes

### 3. Information Hierarchy

- Overall status badge di header
- Detail per tahapan dengan informasi lengkap
- Special treatment untuk final approval/rejection

### 4. Error Handling

- Graceful fallback jika data approval tidak tersedia
- Message informatif untuk case tanpa data approval

## Database Schema Requirements

Untuk menggunakan fitur ini sepenuhnya, koleksi `lembur` di Directus perlu memiliki field-field berikut:

```sql
-- Approval workflow
approval_stage VARCHAR(50),
overall_status VARCHAR(20),

-- HRD Admin
hrd_admin_approved BOOLEAN,
hrd_admin_approved_by VARCHAR(255),
hrd_admin_approved_date TIMESTAMP,
hrd_admin_rejection_reason TEXT,

-- Manager HRD
manager_hrd_approved BOOLEAN,
manager_hrd_approved_by VARCHAR(255),
manager_hrd_approved_date TIMESTAMP,
manager_hrd_rejection_reason TEXT,

-- Direktur
direktur_approved BOOLEAN,
direktur_approved_by VARCHAR(255),
direktur_approved_date TIMESTAMP,
direktur_rejection_reason TEXT,

-- Manager Divisi
manager_divisi_approved BOOLEAN,
manager_divisi_approved_by VARCHAR(255),
manager_divisi_approved_date TIMESTAMP,
manager_divisi_rejection_reason TEXT,

-- Final approval
final_approved_by VARCHAR(255),
final_approved_date TIMESTAMP,
final_rejection_reason TEXT
```

## Contoh Data untuk Testing

```json
{
  "id": "1",
  "nama": "John Doe",
  "tanggal": "2025-01-20",
  "deskripsi": "Lembur maintenance server",
  "approval_stage": "manager_hrd",
  "overall_status": "pending",
  "hrd_admin_approved": true,
  "hrd_admin_approved_by": "Admin HRD",
  "hrd_admin_approved_date": "2025-01-21T10:30:00Z",
  "manager_hrd_approved": null,
  "manager_hrd_approved_by": null,
  "manager_hrd_approved_date": null
}
```

## Backward Compatibility

Implementation ini tetap kompatibel dengan data lama yang tidak memiliki field approval. Jika field approval tidak tersedia, akan ditampilkan pesan "Belum ada data persetujuan tersedia".

## CSS Classes

### Timeline Structure

- `.approval-timeline` - Container utama
- `.approval-stages` - Container untuk semua stages
- `.approval-stage` - Individual stage item
- `.stage-indicator` - Icon dan connector
- `.stage-content` - Detail content

### Status Indicators

- `.approval-status.approved` - Green badge untuk approved
- `.approval-status.rejected` - Red badge untuk rejected
- `.approval-status.processed` - Blue badge untuk processed
- `.stage-pending` - Style untuk pending state

### Final Approval

- `.final-approval` - Green container untuk final approval
- `.final-rejection` - Red container untuk final rejection

## Implementation Notes

1. **Performance**: Timeline hanya render jika ada data approval
2. **Accessibility**: Proper ARIA labels dan semantic HTML
3. **Mobile-first**: Responsive design dengan mobile optimization
4. **Color consistency**: Menggunakan color scheme yang sama dengan aplikasi
5. **Type safety**: Full TypeScript support dengan proper interfaces

## Future Enhancements

1. **Real-time updates**: WebSocket untuk update status real-time
2. **Email notifications**: Integration dengan notification system
3. **Approval comments**: Expanded comment system untuk setiap tahap
4. **Digital signatures**: Integration dengan digital signature system
5. **Audit trail**: Comprehensive logging untuk semua approval actions
