const baseUrl=(process.env.CLUEFY_API_BASE_URL||'http://localhost:3107').replace(/\/$/,'');
const rules=[
  ['URL','balipost.com','Media Lokal · Indonesia','Bali · Indonesia','Pantau berita Bali Post tentang Badung sejak 1 Oktober 2026'],
  ['URL','bali.tribunnews.com','Media Lokal · Indonesia','Bali · Indonesia','Pantau berita Tribun Bali tentang Badung sejak 1 Oktober 2026'],
  ['URL','detik.com/bali','Media Lokal · Indonesia','Bali · Indonesia','Pantau berita detikBali tentang Badung sejak 1 Oktober 2026'],
  ['URL','bali.antaranews.com','Media Lokal · Indonesia','Bali · Indonesia','Pantau berita ANTARA Bali tentang Badung sejak 1 Oktober 2026'],
  ['URL','kompas.com','Media Lokal · Indonesia','Jakarta · Indonesia','Pantau berita Kompas.com tentang Badung sejak 1 Oktober 2026'],
  ['URL','mongabay.co.id','Media Lokal · Indonesia','Jakarta · Indonesia','Pantau berita Mongabay Indonesia tentang Badung sejak 1 Oktober 2026'],
  ['Penulis','Ayu Lestari','Penulis · Lintas Media','Denpasar, Bali · Indonesia','Pantau byline Ayu Lestari sejak 1 Oktober 2026'],
  ['Penulis','I Made Surya Wijaya','Penulis · Lintas Media','Badung, Bali · Indonesia','Pantau byline I Made Surya Wijaya sejak 1 Oktober 2026'],
  ['Penulis','Raka Putra','Penulis · Lintas Media','Bali · Indonesia','Pantau byline Raka Putra sejak 1 Oktober 2026'],
  ['Penulis','Ni Luh Diah Prameswari','Penulis · Lintas Media','Badung, Bali · Indonesia','Pantau byline Ni Luh Diah Prameswari sejak 1 Oktober 2026'],
  ['Penulis','Kadek Mahendra','Penulis · Lintas Media','Denpasar, Bali · Indonesia','Pantau byline Kadek Mahendra sejak 1 Oktober 2026'],
  ['Keyword','Бали (Кута OR Чангу OR Бадунг)','Media Asing · Русский · Rusia','Rusia · Русский','Berita Rusia tentang Badung sejak 1 Oktober 2026'],
  ['URL','aif.ru','Media Asing · Русский · Rusia','Rusia · Русский','Pantau AIF sejak 1 Oktober 2026'],
  ['URL','osnmedia.ru','Media Asing · Русский · Rusia','Rusia · Русский','Pantau OSN Media sejak 1 Oktober 2026'],
  ['Keyword','Балі (Кута OR Чангу OR Бадунг)','Media Asing · Українська · Ukraina','Ukraina · Українська','Berita Ukraina tentang Badung sejak 1 Oktober 2026'],
  ['URL','unn.ua','Media Asing · Українська · Ukraina','Ukraina · Українська','Pantau UNN sejak 1 Oktober 2026'],
  ['URL','focus.ua','Media Asing · Українська · Ukraina','Ukraina · Українська','Pantau Focus sejak 1 Oktober 2026'],
  ['Keyword','Bali (Kuta OR Canggu OR Badung)','Media Asing · English · USA','Amerika Serikat · English','Google News Amerika tentang Badung sejak 1 Oktober 2026'],
  ['URL','apnews.com','Media Asing · English · USA','Amerika Serikat · English','Pantau AP News sejak 1 Oktober 2026'],
  ['URL','cnn.com','Media Asing · English · USA','Amerika Serikat · English','Pantau CNN sejak 1 Oktober 2026'],
  ['URL','usatoday.com','Media Asing · English · USA','Amerika Serikat · English','Pantau USA Today sejak 1 Oktober 2026'],
];

const response=await fetch(`${baseUrl}/api/crawler-config`,{cache:'no-store'});
if(!response.ok)throw new Error(`Gagal membaca konfigurasi crawler: ${response.status}`);
const payload=await response.json();
const existing=new Set((payload.rules||[]).map(rule=>`${rule.type}\u0000${rule.value}\u0000${rule.source}`.toLowerCase()));
let inserted=0,skipped=0;
for(const [type,value,source,scope,note] of rules){
  const identity=`${type}\u0000${value}\u0000${source}`.toLowerCase();
  if(existing.has(identity)){skipped++;continue;}
  const result=await fetch(`${baseUrl}/api/crawler-config`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,value,source,scope,intervalMinutes:10,note,status:'Aktif'})});
  if(!result.ok){const error=await result.json().catch(()=>({}));throw new Error(`${type} ${value}: ${error.error||result.status}`);}
  existing.add(identity);inserted++;
}
console.log(JSON.stringify({inserted,skipped,total:rules.length},null,2));
