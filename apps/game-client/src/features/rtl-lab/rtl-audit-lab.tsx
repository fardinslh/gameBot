import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import styles from './rtl-audit-lab.module.css';

export function RtlAuditLab() {
  return (
    <main className={styles.lab} data-rtl-audit="ready">
      <header>
        <small>Development-only semantic bidi fixture</small>
        <h1>Persian RTL / English LTR</h1>
      </header>

      <section className={styles.panel} dir="rtl" lang="fa" data-audit-locale="fa">
        <h2>نمونهٔ فارسی</h2>
        <p data-audit-case="plain">این یک جملهٔ فارسی کامل است.</p>
        <p data-audit-case="name">فرمانروا <BidiValue>Old_King-77</BidiValue> به پادشاهی حمله کرد.</p>
        <p data-audit-case="amount">موجودی خزانه <BidiValue direction="ltr">12,500</BidiValue> طلا است.</p>
        <p data-audit-case="signed"><BidiValue direction="ltr">+18</BidiValue> جام به‌دست آمد و <BidiValue direction="ltr">-12</BidiValue> جام از دست رفت.</p>
        <p data-audit-case="timer">زمان باقی‌مانده: <BidiValue direction="ltr">12:05</BidiValue>.</p>
        <p data-audit-case="parentheses">فرمانروا (<BidiValue>Player_X</BidiValue>) سطح <BidiValue direction="ltr">20</BidiValue> است.</p>
        <p data-audit-case="template"><BidiTemplate template="بخش {section} تا {count} دقیقهٔ دیگر باز می‌شود." values={{ section: 'Raid 2', count: { direction: 'ltr', value: 15 } }} /></p>
        <p className={styles.long} data-audit-case="long">پادشاهی شما با تولید منابع، ارتقای ساختمان‌ها و آماده‌سازی قهرمانان رشد می‌کند. نام‌های بازیکنان، مقدارهای امضادار، زمان‌سنج‌ها و واژه‌های انگلیسی باید بدون جابه‌جایی نشانه‌ها خوانا بمانند.</p>
      </section>

      <section className={styles.panel} dir="ltr" lang="en" data-audit-locale="en">
        <h2>English sample</h2>
        <p>Warden <BidiValue>شاهین_۷</BidiValue> attacked the kingdom.</p>
        <p>Balance: <BidiValue direction="ltr">12,500</BidiValue> Gold.</p>
        <p><BidiValue direction="ltr">+18</BidiValue> Trophies; timer <BidiValue direction="ltr">12:05</BidiValue>.</p>
      </section>
    </main>
  );
}
