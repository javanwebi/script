import img1 from './moshtari/63bbd73ce5ff4fde8de2cde28151b8ec.w_250h_250r_k.jpg';
import img2 from './moshtari/718a16d3b0ee4cbb9aef05cdcf42fdf2.w_250h_250r_k.jpg';
import img3 from './moshtari/7401712e725842d9b7867c997e2c4524.w_225h_225r_k.png';
import img4 from './moshtari/78109156913b4619b2eb68411388f503.w_228h_233r_k.jpg';
import img5 from './moshtari/b848ca4510344a218c4b0c0a0d62b4b8.w_250h_250r_k.jpg';
import img6 from './moshtari/download.png';
import img7 from './moshtari/e7e6cf2d04dd45d084b51b67b877eab5.w_250h_250r_k.jpg';
import img8 from './moshtari/e931fc644e00c472bb722af3258d63fa14145f74.jpeg';
import img9 from './moshtari/images-1-1.jpg';
import img10 from './moshtari/images-1.jpg';
import img11 from './moshtari/images-1.png';
import img12 from './moshtari/images-2.jpg';
import img13 from './moshtari/images-2.png';
import img14 from './moshtari/images-3.jpg';
import img15 from './moshtari/images-3.png';
import img16 from './moshtari/images-4.jpg';
import img17 from './moshtari/images-4.png';
import img18 from './moshtari/images-5.jpg';
import img19 from './moshtari/images-5.png';
import img20 from './moshtari/images-6.jpg';
import img21 from './moshtari/images.jpg';
import img22 from './moshtari/images.png';
import img23 from './moshtari/meybodtile-1897765651.jpg';

export interface MoshtariClient {
  id: string;
  name: string;
  logo: string;
  industry?: string;
}

export const MOSHTARI_CLIENTS: MoshtariClient[] = [
  { id: 'm1', name: 'مجتمع صنایع کاشی میبد', logo: img23, industry: 'کاشی و سرامیک' },
  { id: 'm2', name: 'کاشی و سرامیک پرسپولیس', logo: img1, industry: 'کاشی و سرامیک' },
  { id: 'm3', name: 'صنایع کاشی و سرامیک یزد', logo: img2, industry: 'کاشی و سرامیک' },
  { id: 'm4', name: 'فولاد مبارکه اصفهان', logo: img3, industry: 'فولاد و متالورژی' },
  { id: 'm5', name: 'گروه صنعتی زر', logo: img4, industry: 'صنایع غذایی' },
  { id: 'm6', name: 'کاشی تکسرام', logo: img5, industry: 'کاشی و سرامیک' },
  { id: 'm7', name: 'صنایع سیمان', logo: img6, industry: 'سیمان و مصالح' },
  { id: 'm8', name: 'کاشی مرجان', logo: img7, industry: 'کاشی و سرامیک' },
  { id: 'm9', name: 'پتروشیمی جم', logo: img8, industry: 'پتروشیمی' },
  { id: 'm10', name: 'صنایع نساجی', logo: img9, industry: 'نساجی' },
  { id: 'm11', name: 'داروسازی عبیدی', logo: img10, industry: 'دارویی' },
  { id: 'm12', name: 'کاشی عقیق', logo: img11, industry: 'کاشی و سرامیک' },
  { id: 'm13', name: 'کاشی تبریز', logo: img12, industry: 'کاشی و سرامیک' },
  { id: 'm14', name: 'صنایع مس ایران', logo: img13, industry: 'معادن و فلزات' },
  { id: 'm15', name: 'فولاد خوزستان', logo: img14, industry: 'فولاد و متالورژی' },
  { id: 'm16', name: 'پتروشیمی مارون', logo: img15, industry: 'پتروشیمی' },
  { id: 'm17', name: 'کاشی نائین', logo: img16, industry: 'کاشی و سرامیک' },
  { id: 'm18', name: 'صنایع غذایی بهروز', logo: img17, industry: 'صنایع غذایی' },
  { id: 'm19', name: 'شیشه صنعتی', logo: img18, industry: 'شیشه و بلور' },
  { id: 'm20', name: 'لوله و اتصالات صنعتی', logo: img19, industry: 'پلیمر و لوله' },
  { id: 'm21', name: 'تراکتورسازی ایران', logo: img20, industry: 'خودروسازی و ماشین‌آلات' },
  { id: 'm22', name: 'آلومینیوم اراک', logo: img21, industry: 'فلزات غیرآهنی' },
  { id: 'm23', name: 'ذوب آهن اصفهان', logo: img22, industry: 'فولاد و متالورژی' },
];
