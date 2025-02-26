# PUBG Mobile Player Info API

PUBG Mobile o'yinchilarining ma'lumotlarini ID bo'yicha qidirib topish va saqlash uchun qulay servis.

![PUBG Mobile Player API](https://i.imgur.com/GTCRHEC.png)

## Imkoniyatlar

- O'yinchi ID'si bo'yicha PUBG Mobile o'yinchisi ma'lumotlarini qidirish
- O'yinchi ma'lumotlarini avtomatik ravishda mahalliy bazada saqlash
- Ilgari qidirilgan o'yinchilar ma'lumotlarini ko'rish
- Qulay va sodda foydalanuvchi interfeysi
- API orqali qidiruv natijalari bilan ishlash imkoniyati

## O'rnatish

Loyihani ishga tushirish uchun quyidagi qadamlarni amalga oshiring:

1. Loyihani klonlash:
```bash
git clone https://github.com/pul2es/pubg-mobile-id2name.git
cd pubg-mobile-id2name
```

2. Kerakli kutubxonalarni o'rnatish:
```bash
npm install
```

3. Serverni ishga tushirish:
```bash
node app.js
```

4. Brauzeringizda quyidagi manzilga o'ting:
```
http://localhost:3000
```

## Foydalanish

### Web interfeysi orqali
- O'yinchi ID'sini kiriting va "Search" tugmasini bosing
- O'yinchi ma'lumotlari ko'rsatiladi va avtomatik ravishda mahalliy bazaga saqlanadi
- Saqlab qo'yilgan o'yinchilar ro'yxatidan qayta qidiruv o'tkazish mumkin

### API orqali foydalanish

#### O'yinchi ma'lumotlarini olish
```
GET /api/player/:id
```

Misol:
```
GET /api/player/5678912345
```

#### Barcha saqlangan o'yinchilar ro'yxatini olish
```
GET /api/players
```

#### O'yinchini o'chirish
```
DELETE /api/player/:id
```

## Autentifikatsiya

Loyihada API so'rovlari uchun sodda autentifikatsiya mexanizmi mavjud. API so'rovlarini qilishda autentifikatsiya kalitini qo'shishingiz mumkin:

```
GET /api/player/:id/:authKey
GET /api/players/:authKey
DELETE /api/player/:id/:authKey
```

Standart autentifikatsiya kaliti: `4C445AF6BC4B387F162CF83316EE4`

## Texnologiyalar

Loyihada quyidagi texnologiyalardan foydalanilgan:

- Node.js
- Express.js - API va server uchun
- Puppeteer - Web saytlardan ma'lumot olish uchun
- SQLite - Mahalliy ma'lumotlar bazasi
- HTML/CSS/JavaScript - Foydalanuvchi interfeysi uchun

## Rivojlantirish

Loyihaga quyidagi yo'nalishlarda o'zgartirishlar kiritish mumkin:

- Yangi xususiyatlar qo'shish
- Xatolarni tuzatish
- Kodni optimallantirish
- Performance yaxshilash

## Litsenziya

MIT
