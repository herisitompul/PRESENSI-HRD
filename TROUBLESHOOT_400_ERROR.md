# Troubleshooting: 400 Bad Request pada Field Lengkap

## Problem

Field sudah tersedia di database tapi masih terjadi error 400 saat submit dengan field lengkap. Fallback mode dengan field minimal berhasil.

## Analysis dari Log

### ✅ Yang Berhasil

```
Trying with minimal data: {
  user_id: 4,
  email: 'shakila!@eltama.com',
  nama: 'Shakila Mebarak Ripol',
  tanggal: '2025-07-12',
  durasi_jam: 3,
  durasi_menit: 0,
  deskripsi: '...',
  status: 'pending',
  tanggal_pengajuan: '...'
}
```

### ❌ Yang Gagal (Field Lengkap)

```
Data yang akan dikirim ke Directus: {
  user_id: 4,
  email: 'shakila!@eltama.com',
  nama: 'Shakila Mebarak Ripol',
  tanggal: '2025-07-12',
  durasi_jam: 3,
  durasi_menit: 0,
  deskripsi: 'ddfafafafdsafsafas',
  status: 'pending',
  tanggal_pengajuan: '2025-07-11T04:24:35.752Z',
  jam_masuk: '17:25',
  jam_keluar: '20:25',
  is_pengajuan_sebelum_h: true,
  is_foto_required: false,
  lampiran_foto_opsional: 'lembur_4_1752207968219_Abstract Gaming Wallpaper.jpg',
  catatan_penyesuaian: 'asfsafafafa'
}
```

## Possible Issues

### 1. Field Type Mismatch

- `user_id` dikirim sebagai number (4) tapi database expect string
- Boolean fields mungkin perlu explicit casting

### 2. Field Validation Rules

- Field baru mungkin ada validation rules yang strict
- File name yang terlalu panjang
- Special characters di catatan_penyesuaian

### 3. Field Permission/Access

- User mungkin tidak punya permission untuk write field baru
- Field baru mungkin read-only atau hidden

## Perbaikan yang Sudah Dilakukan

### 1. Type Casting

```typescript
user_id: String(currentUser.id), // Force string
is_pengajuan_sebelum_h: Boolean(isPengajuanSebelum), // Force boolean
is_foto_required: Boolean(!isPengajuanSebelum), // Force boolean
```

### 2. Enhanced Debugging

```typescript
console.log("Field types check:", {
  user_id: typeof lemburData.user_id,
  jam_masuk: typeof lemburData.jam_masuk,
  // ... other types
});
```

### 3. Two-Step Strategy

1. Create with minimal fields (berhasil)
2. Update dengan field tambahan
3. Fallback ke basic record jika update gagal

### 4. Better Error Logging

```typescript
if (
  directusError &&
  typeof directusError === "object" &&
  "errors" in directusError
) {
  console.error("Directus error details:", (directusError as any).errors);
}
```

## Next Testing Steps

### 1. Check Field Types

Setelah submit, lihat console log "Field types check" untuk memastikan tipe data benar.

### 2. Check Detailed Error

Lihat console untuk "Directus error details" yang akan menunjukkan field mana yang bermasalah.

### 3. Test Update Strategy

Aplikasi sekarang akan:

1. Submit dengan field minimal (berhasil)
2. Update dengan field tambahan
3. Log hasil update

### 4. Verify Field Permissions

Cek di Directus Admin → Settings → Roles & Permissions → Lembur collection apakah user punya write access ke field baru.

## Expected Output (New Version)

```
Field types check: {
  user_id: "string",
  jam_masuk: "string",
  jam_keluar: "string",
  is_pengajuan_sebelum_h: "boolean",
  is_foto_required: "boolean",
  lampiran_foto_opsional: "string",
  catatan_penyesuaian: "string"
}

// Jika masih gagal:
Directus error details: [
  {
    "message": "Field 'lampiran_foto_opsional' validation failed",
    "extensions": {
      "field": "lampiran_foto_opsional",
      "code": "INVALID_PAYLOAD"
    }
  }
]

// Kemudian:
Attempting to update with additional fields...
Update data: {
  jam_masuk: "17:25",
  jam_keluar: "20:25",
  is_pengajuan_sebelum_h: true,
  is_foto_required: false,
  lampiran_foto_opsional: "lembur_4_1752207968219_Abstract Gaming Wallpaper.jpg",
  catatan_penyesuaian: "asfsafafafa"
}

Successfully updated with additional fields: { ... }
```

## Possible Solutions by Issue Type

### If Permission Issue

1. Check Directus Admin → Settings → Roles & Permissions
2. Ensure user role has CREATE and UPDATE access to new fields

### If Validation Issue

1. Check field rules in Directus (length, pattern, etc.)
2. Shorten filename or sanitize special characters
3. Check required field constraints

### If Type Issue

1. Check field type in Directus schema
2. Ensure data type consistency

### If Still Failing

The two-step strategy (create minimal + update) should work as a robust fallback while maintaining data integrity.

## Latest Update: Field-by-Field Testing

### New Strategy Implemented

#### 1. Enhanced Error Logging

```typescript
// Detailed error breakdown
errorDetails.forEach((err, index) => {
  console.error(`CREATE Error ${index + 1}:`, {
    message: err.message,
    field: err.extensions?.field,
    code: err.extensions?.code,
    reason: err.extensions?.reason,
  });
});
```

#### 2. Field-by-Field Testing Function

```typescript
async function testFieldsIndividually(recordId, testData) {
  const fieldsToTest = [
    { name: "jam_masuk", value: testData.jam_masuk },
    { name: "jam_keluar", value: testData.jam_keluar },
    { name: "is_pengajuan_sebelum_h", value: testData.is_pengajuan_sebelum_h },
    // ... other fields
  ];

  for (const field of fieldsToTest) {
    try {
      console.log(`Testing field: ${field.name} = ${field.value}`);
      await directus.request(
        updateItem("lembur", recordId, { [field.name]: field.value })
      );
      console.log(`✅ ${field.name}: SUCCESS`);
    } catch (fieldError) {
      console.error(`❌ ${field.name}: FAILED`, fieldError);
    }
  }
}
```

#### 3. Three-Stage Process

1. **CREATE with full data** (still likely to fail - but now with detailed error info)
2. **CREATE with minimal data** (proven to work)
3. **UPDATE field-by-field** (test each field individually)

### Expected New Console Output

```
=== CREATE Phase ===
Field types check: { user_id: "string", jam_masuk: "string", ... }
CREATE Error 1: {
  message: "Value for field 'lampiran_foto_opsional' is invalid",
  field: "lampiran_foto_opsional",
  code: "INVALID_PAYLOAD",
  reason: "Field validation failed"
}

=== FALLBACK Phase ===
Trying with minimal data: {...}
Lembur submitted with minimal fields: {id: 8, ...}

=== FIELD TESTING Phase ===
=== TESTING FIELDS INDIVIDUALLY ===
Testing field: jam_masuk = 17:31 (string)
✅ jam_masuk: SUCCESS

Testing field: jam_keluar = 22:31 (string)
✅ jam_keluar: SUCCESS

Testing field: is_pengajuan_sebelum_h = true (boolean)
✅ is_pengajuan_sebelum_h: SUCCESS

Testing field: lampiran_foto_opsional = lembur_4_1752208278453_Abstract Gaming Wallpaper.jpg (string)
❌ lampiran_foto_opsional: FAILED
   - Error: Value for field 'lampiran_foto_opsional' is invalid
   - Code: INVALID_PAYLOAD
   - Field: lampiran_foto_opsional
   - Reason: Filename too long or contains invalid characters

Testing field: catatan_penyesuaian = adasdadada (string)
✅ catatan_penyesuaian: SUCCESS
=== END FIELD TESTING ===
```

### What This Will Tell Us

1. **Exact field causing the problem**
2. **Specific error message for that field**
3. **Whether it's a validation, permission, or type issue**
4. **Which fields work and which don't**

### Possible Field-Specific Issues

#### lampiran_foto_opsional

- Filename too long (current: `lembur_4_1752208278453_Abstract Gaming Wallpaper.jpg`)
- Contains spaces or special characters
- File extension validation
- Field length limit in database

#### Boolean Fields

- Schema expects different boolean format
- True/false vs 1/0 vs "true"/"false"

#### String Fields

- Length limits
- Character restrictions
- Required field constraints

### Next Steps After Testing

Once we see the individual field test results, we can:

1. **Fix problematic fields** (e.g., shorten filename, sanitize text)
2. **Update field validation** in Directus if needed
3. **Adjust data formatting** in the application
4. **Create field-specific workarounds** for problematic fields

## ✅ PROBLEM SOLVED: Foreign Key Issue

### 🎉 Root Cause Identified:

Field `lampiran_foto_opsional` dikonfigurasi sebagai **FOREIGN KEY** di Directus (menuju `directus_files` collection), bukan sebagai simple string field.

### 🔧 Solution Implemented:

**Temporary Fix:** Skip file upload untuk menghindari foreign key error.

```typescript
// Field lampiran_foto_opsional di-skip karena foreign key constraint
console.warn(
  "File upload skipped - field 'lampiran_foto_opsional' is configured as foreign key in Directus"
);
fotoFileName = null; // Avoid foreign key error
```

### 📊 Final Test Results:

```
=== TESTING FIELDS INDIVIDUALLY ===
Testing field: jam_masuk = 18:36 (string)
✅ jam_masuk: SUCCESS

Testing field: jam_keluar = 20:36 (string)
✅ jam_keluar: SUCCESS

Testing field: is_pengajuan_sebelum_h = false (boolean)
✅ is_pengajuan_sebelum_h: SUCCESS

Testing field: is_foto_required = true (boolean)
✅ is_foto_required: SUCCESS

Testing field: catatan_penyesuaian = fdsfsfsfs (string)
✅ catatan_penyesuaian: SUCCESS
=== END FIELD TESTING ===

Final result after field-by-field update: {
  id: 10,
  jam_masuk: "18:36",
  jam_keluar: "20:36",
  is_pengajuan_sebelum_h: false,
  is_foto_required: true,
  catatan_penyesuaian: "fdsfsfsfs",
  // lampiran_foto_opsional: null (skipped)
}
```

### 🎯 Current Status:

- ✅ **Form submission berhasil**
- ✅ **Semua field text dan boolean tersimpan**
- ✅ **Durasi dihitung otomatis**
- ✅ **Data integrity terjaga**
- ⏸️ **File upload di-skip temporary**

### 🔄 For Future File Upload Implementation:

See `FOREIGN_KEY_ISSUE_SOLVED.md` for detailed options:

1. Upload to Directus Files API first, then use file ID
2. Change field type from File to String in Directus
3. Keep current approach (skip file upload)

---
