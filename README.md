# RecruitHub — Job Recruitment Platform

> **Status:** 🚧 UNFINISHED — Masih dalam pengembangan. Beberapa fitur belum lengkap (lihat daftar di bawah).

Aplikasi rekrutmen berbasis web dengan dua peran pengguna: **Recruiter** (membuat dan mengelola lowongan) dan **Applicant** (melihat dan melamar pekerjaan).

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Auth** | Better Auth v1.6 (email/password + session cookie) |
| **API Layer** | Hono (via `hono/vercel`) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Validation** | Zod + `@hono/zod-validator` |
| **Styling** | Tailwind CSS v4 |
| **Linter** | Biome |

---

## Cara Menjalankan

```bash
# 1. Clone & install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env
# Edit BETTER_AUTH_SECRET: openssl rand -hex 32
# Edit DATABASE_URL sesuai PostgreSQL lokal

# 3. Migrate database
pnpm db:generate
pnpm db:migrate

# 4. Jalankan dev server
pnpm dev
```

---

## Arsitektur

### Role-Based Access Control

| Fitur | Recruiter | Applicant |
|---|---|---|
| Lihat daftar job | ✅ | ✅ |
| Buat job baru | ✅ | ❌ |
| Edit job | ✅ (milik sendiri) | ❌ |
| Hapus job | ✅ (milik sendiri) | ❌ |
| Lamar pekerjaan | ✅ (manual add) | ✅ |
| Lihat kandidat | ✅ (milik sendiri) | ❌ |
| Ubah status kandidat | ✅ (milik sendiri) | ❌ |

### Alur Data

```
Client (Next.js)  ──fetch──▶  Hono API (/api/*)
                                    │
                          ┌─────────┴──────────┐
                          ▼                    ▼
                   Better Auth          Drizzle ORM
                   (session/cookie)     (PostgreSQL)
```

---

## ✅ Best Practices & Security Implementations

### 1. IDOR Prevention — Ownership Validation

**Apa yang dilakukan:** Setiap operasi PATCH/DELETE pada job dan candidate memverifikasi bahwa resource tersebut milik user yang melakukan request.

**Lokasi:**
- `app/api/[[...route]]/job.ts:76` — `and(eq(job.id, id), eq(job.recruiter, user.id))`
- `app/api/[[...route]]/candidate.ts:91` — `and(eq(applicant.id, id), eq(applicant.recruiterId, user.id))`
- `app/api/[[...route]]/candidate.ts:35` — `eq(applicant.recruiterId, user.id)` pada GET

**Masalah jika tidak diimplementasikan:** Seorang recruiter bisa mengedit/menghapus job milik recruiter lain, serta melihat dan mengubah data kandidat milik kompetitor. Ini adalah **Insecure Direct Object Reference (IDOR)** — kerentanan kritis yang memungkinkan akses data tidak sah hanya dengan menebak UUID.

### 2. CSRF Protection — Origin Validation

**Apa yang dilakukan:** Middleware memeriksa header `Origin` pada setiap request POST/PATCH/DELETE/PUT. Request dengan origin yang tidak dikenal akan ditolak (403).

**Lokasi:** `app/api/[[...route]]/route.ts:22-29`

**Masalah jika tidak diimplementasikan:** Karena session dikelola via cookie (otomatis dikirim browser), attacker bisa membuat halaman web jahat yang mengirim request ke API ini tanpa sepengetahuan korban. Contoh: Seorang recruiter yang sedang login dan mengunjungi website attacker secara tidak sengaja akan mengeksekusi `DELETE /api/jobs/{id}` melalui form submission.

### 3. Role-Based Access Control di Server

**Apa yang dilakukan:** Setiap endpoint API memeriksa role user (`user.role !== "recruiter"`) sebelum mengizinkan operasi yang membutuhkan hak akses khusus. Pengecekan dilakukan di server-side, bukan hanya di client-side.

**Lokasi:** Tersebar di `job.ts` dan `candidate.ts`.

**Masalah jika tidak diimplementasikan:** Seorang applicant bisa dengan mudah mengirim request HTTP langsung (via curl/Postman/Insomnia) ke endpoint `POST /api/jobs` atau `DELETE /api/jobs/{id}`. Tanpa pengecekan role di server, batasan UI di client-side tidak ada artinya.

### 4. Input Validation dengan Zod

**Apa yang dilakukan:** Semua input (body, query, param) divalidasi menggunakan Zod schema sebelum diproses.

**Lokasi:** Validator di setiap route handler menggunakan `zValidator` + Zod schema.

**Masalah jika tidak diimplementasikan:** Mass assignment — attacker bisa mengirim field tambahan seperti `role: "recruiter"` di body register. Juga SQL injection jika input tidak divalidasi.

### 5. Runtime Secret Validation

**Apa yang dilakukan:** Aplikasi memvalidasi panjang `BETTER_AUTH_SECRET` saat startup. Jika kurang dari 32 karakter, aplikasi throw error dan tidak jalan.

**Lokasi:** `lib/auth.ts:4-7`

**Masalah jika tidak diimplementasikan:** Secret pendek dan lemah memudahkan attacker melakukan bruteforce signing key JWT/session token. Dengan secret yang diketahui, attacker bisa memalsukan session token dan login sebagai user manapun.

### 6. HTTP Security Headers

**Apa yang dilakukan:** Menambahkan security headers:
- `X-Content-Type-Options: nosniff` — cegah MIME-type sniffing
- `X-Frame-Options: DENY` — cegah clickjacking
- `X-XSS-Protection: 1; mode=block` — perlindungan XSS (legacy)
- `Referrer-Policy: strict-origin-when-cross-origin` — kontrol informasi referer
- `poweredByHeader: false` — sembunyikan informasi server

**Lokasi:** `next.config.ts`

**Masalah jika tidak diimplementasikan:** Tanpa `X-Frame-Options`, aplikasi bisa di-render di dalam `<iframe>` di website attacker (clickjacking). Tanpa `X-Content-Type-Options`, browser bisa salah menginterpretasikan tipe file dan mengeksekusi script yang tidak seharusnya.

### 7. ORM dengan Parameterized Queries

**Apa yang dilakukan:** Menggunakan Drizzle ORM untuk semua operasi database. Query parameterized secara otomatis.

**Lokasi:** Semua file di `app/api/[[...route]]/`

**Masalah jika tidak diimplementasikan:** Raw SQL query rentan terhadap SQL injection. Attacker bisa mengeksekusi query berbahaya melalui input yang tidak difilter, berpotensi membaca/menghapus seluruh database.

### 8. Database-Level Enum Constraint

**Apa yang dilakukan:** Role user dibatasi menggunakan PostgreSQL enum (`pgEnum("role", ["recruiter", "applicant"])`), bukan string biasa.

**Lokasi:** `database/schema.ts:14`

**Masalah jika tidak diimplementasikan:** Jika validasi Zod diabaikan (misal karena bug), attacker bisa menyimpan nilai role sembarang seperti `"admin"` atau `"superuser"`. Dengan database enum, PostgreSQL akan menolak nilai yang tidak sesuai.

### 9. Error Disclosure Protection

**Apa yang dilakukan:** Semua error response menggunakan pesan generik: `"Unauthorized"` (401), `"Forbidden"` (403), `"Not found"` (404).

**Lokasi:** Semua endpoint API.

**Masalah jika tidak diimplementasikan:** Pesan error yang detail (misal: "User with email x@y.com not found" vs "Wrong password") memungkinkan attacker melakukan enumerasi email/user yang terdaftar.

### 10. Client-Side Access Restriction

**Apa yang dilakukan:** Sidebar menyembunyikan menu "Candidates" untuk applicant. Candidates page redirect applicant ke halaman utama.

**Lokasi:**
- `app/(dashboard)/layout.tsx:94-95` — filter nav items by role
- `app/(dashboard)/candidates/page.tsx:46-48` — redirect if not recruiter

**Masalah jika tidak diimplementasikan:** Tanpa redirect, applicant yang langsung mengakses `/candidates` akan melihat halaman dengan data kosong/error yang membingungkan. Data tetap aman karena server-side blocking, tapi UX menjadi buruk.

---

## 🚧 Yang Belum Selesai (UNFINISHED)

Fitur-fitur berikut belum diimplementasikan dan perlu diselesaikan:

- [ ] **Edit profile applicant** — Applicant belum bisa meng-update profil mereka
- [ ] **Job application tracking** — Applicant tidak bisa melihat status lamaran mereka
- [ ] **Email notification** — Tidak ada notifikasi email saat status lamaran berubah
- [ ] **Pagination** — Daftar jobs dan candidates belum memiliki pagination
- [ ] **File upload (CV/Resume)** — Applicant belum bisa mengunggah CV
- [ ] **Advanced filtering & search** — Filter job berdasarkan lokasi, tipe pekerjaan, dll
- [ ] **Unit & integration tests** — Belum ada test coverage
- [ ] **Rate limiting** — Tidak ada pembatasan percobaan login/signup
- [ ] **Content Security Policy (CSP)** — Belum ada CSP header yang ketat
- [ ] **Access log / audit trail** — Tidak ada logging untuk operasi sensitif
