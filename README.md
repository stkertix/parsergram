# ParserGram - Instagram Parser

Aplikasi web untuk parsing dan menampilkan media dari Instagram menggunakan Vue.js dan Express.

## Instalasi

1. Install dependencies:

```bash
npm install
```

## Linting

Project ini menggunakan ESLint untuk menjaga kualitas kode.

### Menjalankan Linter

```bash
# Check untuk error dan warning
npm run lint

# Auto-fix error yang bisa diperbaiki otomatis
npm run lint:fix
```

## Menjalankan Server

### Single Instance (Default)

```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

### Multiple Instances

#### Opsi 1: Jalankan Semua Aplikasi Sekaligus

```bash
npm run start:all
```

Ini akan menjalankan semua aplikasi yang dikonfigurasi di `apps.config.js`

#### Opsi 2: Jalankan di Port Tertentu

```bash
# Port 3000
npm run start:3000

# Port 3001
npm run start:3001

# Port 3002
npm run start:3002
```

#### Opsi 3: Jalankan dengan Port Custom

```bash
# Menggunakan environment variable
PORT=3005 node server.js

# Atau menggunakan script
node start-single.js 3005
```

### Konfigurasi Multiple Apps

Edit file `apps.config.js` untuk menambahkan atau mengubah konfigurasi aplikasi:

```javascript
module.exports = [
  {
    name: "parsergram-1",
    port: 3001,
    description: "ParserGram Instance 1",
  },
  {
    name: "parsergram-2",
    port: 3002,
    description: "ParserGram Instance 2",
  },
  // Tambahkan lebih banyak di sini...
];
```

## Fitur

- Parse JSON data Instagram (info & query)
- Tampilkan gambar dan video dari Instagram
- Preview media dengan zoom dan drag
- Download media dari Instagram

## Endpoints

- `GET /` - Halaman utama (index.html)
- `GET /load?url=...` - Proxy untuk load image/video
- `GET /download?url=...&filename=...` - Download media

## Catatan

Aplikasi ini menggunakan CDN untuk:

- Vue.js 3
- Vuetify 3
- Moment.js
- Flaticon Icons

Jadi tidak perlu build step, langsung bisa dijalankan dengan Express!
