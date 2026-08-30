مختبر فكرة مشروعك - النسخة المركزية V8

المستشار محمد الخالد
وثيقة العمل رقم FL-654884630

مفتاح الإدارة المقترح:
MKF-ADMIN-3d03b37e30442773cc10b1d46d272b5f0a1f9fcc28ef109f

إعداد Vercel:
1) افتح مشروع mokhtabar-fikra.
2) Settings > Environment Variables.
3) أضف متغيرًا باسم ADMIN_SCHEDULE_KEY والقيمة أعلاه.
4) فعّله لـ Production و Preview (وDevelopment اختياري).
5) اضغط Save ثم أعد نشر المشروع Redeploy حتى تصبح القيمة متاحة للنشر الجديد.

التخزين:
الكود يدعم متغيرات Upstash التالية تلقائيًا:
UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
أو KV_REST_API_URL + KV_REST_API_TOKEN

الأمان:
لا تضع ADMIN_SCHEDULE_KEY داخل index.html أو أي صفحة عامة، ولا ترسله للعملاء. أدخله فقط في صفحة الإدارة عند الحاجة.

الحجوزات:
- الجلسة الفردية: الموعد يقفل فور أول حجز ولا يظهر لعميل آخر.
- الجلسة الجماعية: يسمح حتى 5 حجوزات ثم يختفي الموعد تلقائيًا.
- إلغاء الحجز من صفحة الإدارة يعيد السعة المتاحة.
