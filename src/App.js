import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc, where 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously 
} from 'firebase/auth';
import { 
  ClipboardList, User, Settings, LogOut, FileSpreadsheet, CheckCircle, 
  Truck, Factory, FileText, AlertCircle, Lock, Calendar, Save, Trash2, Ruler, Pencil, X, Clock, Camera, Image as ImageIcon, ChevronDown, Filter, Printer, BarChart3, BookOpen, Paperclip, FileText as FileIcon, List, Layers, HelpCircle, Plus, Calculator, Wrench
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDOgzHZvBtzuCayxuEB9hMPJ4BBlvhvHtw",
  authDomain: "mes-worklog-system.firebaseapp.com",
  projectId: "mes-worklog-system",
  storageBucket: "mes-worklog-system.firebasestorage.app",
  messagingSenderId: "662704876600",
  appId: "1:662704876600:web:1a92d6e8d5c4cd99a7cacd",
  measurementId: "G-8XRXFQ7HV4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 로컬 환경용 고정 App ID
const appId = 'mes-production-v1';

// --- Constants & Helper Functions ---
const VEHICLE_MODELS = ['DN8', 'LF', 'DE', 'J100', 'J120', 'O100', 'GN7'];
const PROCESS_TYPES = ['소재준비', '프레스', '후가공', '검사'];

const HOURS = Array.from({ length: 24 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const isKGM = (model) => ['J100', 'O100', 'J120'].includes(model);

const getLogTitle = (model, process) => {
  if (!model || !process) return '';
  switch (process) {
    case '소재준비': return `${model} 소재준비`;
    case '프레스': return isKGM(model) ? 'KGM 프레스' : `${model} 프레스`;
    case '후가공': return '후가공일보';
    case '검사': return isKGM(model) ? 'KGM 검사일보' : `검사일보 ${model}`;
    default: return `${model} ${process} 일보`;
  }
};

// --- Translations ---
const TRANSLATIONS = {
  // General
  '작 업 일 보': { en: 'Work Log', ru: 'Рабочий журнал', th: 'บันทึกงาน', vn: 'Nhật ký công việc' },
  '작업일보 작성 가이드': { en: 'Guide', ru: 'Руководство', th: 'คู่มือ', vn: 'Hướng dẫn' },
  '작업 표준서': { en: 'Standard', ru: 'Стандарт', th: 'มาตรฐาน', vn: 'Tiêu chuẩn' },
  '인쇄': { en: 'Print', ru: 'Печать', th: 'พิมพ์', vn: 'In' },
  '결 재': { en: 'Approval', ru: 'Утверждение', th: 'การอนุมัติ', vn: 'Phê duyệt' },
  '작 성': { en: 'Draft', ru: 'Составил', th: 'ผู้เขียน', vn: 'Người lập' },
  '검 토': { en: 'Review', ru: 'Проверил', th: 'ตรวจสอบ', vn: 'Kiểm tra' },
  '승 인': { en: 'Approve', ru: 'Утвердил', th: 'อนุมัติ', vn: 'Phê duyệt' },
  '작업일자': { en: 'Date', ru: 'Дата', th: 'วันที่', vn: 'Ngày' },
  '작업자': { en: 'Worker', ru: 'Рабочий', th: 'คนงาน', vn: 'Công nhân' },
  '작업시간': { en: 'Time', ru: 'Время', th: 'เวลา', vn: 'Thời gian' },
  '차종': { en: 'Model', ru: 'Модель', th: 'รุ่น', vn: 'Mẫu xe' },
  '공정': { en: 'Process', ru: 'Процесс', th: 'กระบวนการ', vn: 'Công đoạn' },
  '합격': { en: 'OK', ru: 'Годно', th: 'ผ่าน', vn: 'Đạt' },
  '불량': { en: 'NG', ru: 'Брак', th: 'เสีย', vn: 'Lỗi' },
  '특이사항 및 인수인계': { en: 'Notes / Handover', ru: 'Заметки / Передача', th: 'หมายเหตุ / ส่งมอบ', vn: 'Ghi chú / Bàn giao' },
  '내용을 입력하세요.': { en: 'Enter text...', ru: 'Введите текст...', th: 'กรอกข้อมูล...', vn: 'Nhập nội dung...' },
  '파일 첨부 (성적서/도면)': { en: 'Attach File', ru: 'Прикрепить файл', th: 'แนบไฟล์', vn: 'Đính kèm tệp' },
  '파일 선택': { en: 'Select File', ru: 'Выбрать', th: 'เลือกไฟล์', vn: 'Chọn tệp' },
  '일보 저장': { en: 'Save Log', ru: 'Сохранить', th: 'บันทึก', vn: 'Lưu' },
  '저장 중...': { en: 'Saving...', ru: 'Сохранение...', th: 'กำลังบันทึก...', vn: 'Đang lưu...' },
  '자동저장됨': { en: 'Auto-saved', ru: 'Автосохранение', th: 'บันทึกอัตโนมัติ', vn: 'Đã lưu tự động' },
  '사진등록됨': { en: 'Photo Added', ru: 'Фото добавлено', th: 'เพิ่มรูปแล้ว', vn: 'Đã thêm ảnh' },
  '구분': { en: 'Div', ru: 'Раздел', th: 'ประเภท', vn: 'Phân loại' },
  '작업수량': { en: 'Work Qty', ru: 'Кол-во', th: 'จำนวนงาน', vn: 'SL Làm việc' },
  '생산수량': { en: 'Prod Qty', ru: 'Продукция', th: 'จำนวนผลิต', vn: 'SL Sản xuất' },
  '불량수량': { en: 'Defect Qty', ru: 'Брак', th: 'จำนวนเสีย', vn: 'SL Lỗi' },
  '정품수량': { en: 'Good Qty', ru: 'Годные', th: 'จำนวนดี', vn: 'SL Tốt' },
  '초물(길이)': { en: 'Initial(Len)', ru: 'Начало(Дл)', th: 'ต้น(ยาว)', vn: 'Đầu(Dài)' },
  '중물(길이)': { en: 'Middle(Len)', ru: 'Середина(Дл)', th: 'กลาง(ยาว)', vn: 'Giữa(Dài)' },
  '종물(길이)': { en: 'Final(Len)', ru: 'Конец(Дл)', th: 'ท้าย(ยาว)', vn: 'Cuối(Dài)' },
  'Lot No': { en: 'Lot No', ru: 'Партия', th: 'ล็อต', vn: 'Số Lo' },
  'FMB LOT': { en: 'FMB LOT', ru: 'FMB LOT', th: 'FMB LOT', vn: 'FMB LOT' },
  '수지 LOT (직/둔)': { en: 'Resin LOT', ru: 'Смола LOT', th: 'เรซิน LOT', vn: 'Resin LOT' },
  '기포': { en: 'Bubble', ru: 'Пузырь', th: 'ฟองอากาศ', vn: 'Bọt khí' },
  '검사수량': { en: 'Insp Qty', ru: 'Кол-во пров.', th: 'จำนวนตรวจ', vn: 'SL Kiểm tra' },
  '소재 LOT 관리': { en: 'Material LOT', ru: 'Материал LOT', th: 'จัดการล็อตวัสดุ', vn: 'Quản lý Lo vật liệu' },
  '초물(LH/RH)': { en: 'Initial', ru: 'Начало', th: 'ต้น', vn: 'Đầu' },
  '중물(LH/RH)': { en: 'Middle', ru: 'Середина', th: 'กลาง', vn: 'Giữa' },
  '종물(LH/RH)': { en: 'Final', ru: 'Конец', th: 'ท้าย', vn: 'Cuối' },
  '중요 치수(길이) 검사현황': { en: 'Dimension Check', ru: 'Проверка размеров', th: 'ตรวจสอบขนาด', vn: 'Kiểm tra kích thước' },
  '규격 (SPEC)': { en: 'SPEC', ru: 'Спец.', th: 'สเปค', vn: 'Quy cách' },
  '불량 상세 입력': { en: 'Defect Details', ru: 'Детали брака', th: 'รายละเอียดของเสีย', vn: 'Chi tiết lỗi' },
  '소재 불량': { en: 'Material Defect', ru: 'Дефект мат.', th: 'วัสดุเสีย', vn: 'Lỗi vật liệu' },
  '조인트 불량': { en: 'Joint Defect', ru: 'Дефект соед.', th: 'ข้อต่อเสีย', vn: 'Lỗi mối nối' },
  '후가공 불량': { en: 'Finish Defect', ru: 'Дефект отд.', th: 'ตกแต่งเสีย', vn: 'Lỗi gia công' },
  '총 불량 합계': { en: 'Total Defects', ru: 'Всего брака', th: 'รวมของเสีย', vn: 'Tổng lỗi' },
  '취소': { en: 'Cancel', ru: 'Отмена', th: 'ยกเลิก', vn: 'Hủy' },
  '적용': { en: 'Apply', ru: 'Применить', th: 'ใช้', vn: 'Áp dụng' },
  '금형 타수 관리 (작업자별 누적)': { en: 'Mold Count (By Worker)', ru: 'Счетчик пресс-форм (по рабочим)', th: 'นับจำนวนแม่พิมพ์ (ตามคนงาน)', vn: 'Đếm khuôn (Theo công nhân)' },
  "스코치 'A'": { en: "Scorch A", ru: "Ожог A", th: "ไหม้ A", vn: "Cháy A" },
  "스코치 'B'": { en: "Scorch B", ru: "Ожог B", th: "ไหม้ B", vn: "Cháy B" },
  "스코치 'C'": { en: "Scorch C", ru: "Ожог C", th: "ไหม้ C", vn: "Cháy C" },
  '외면흠': { en: 'Surface Flaw', ru: 'Дефект пов.', th: 'รอยผิวนอก', vn: 'Lỗi bề mặt' },
  '컷팅불량': { en: 'Cutting Bad', ru: 'Ошибка резки', th: 'ตัดเสีย', vn: 'Lỗi cắt' },
  '이색/광택': { en: 'Discolor', ru: 'Цвет/Блеск', th: 'สีเพี้ยน', vn: 'Sai màu' },
  '떨어짐': { en: 'Detach', ru: 'Отслоение', th: 'หลุด', vn: 'Bong tróc' },
  '양부족': { en: 'Shortage', ru: 'Нехватка', th: 'ขาด', vn: 'Thiếu' },
  '밀림': { en: 'Push', ru: 'Сдвиг', th: 'เลื่อน', vn: 'Đùn' },
  '넘침': { en: 'Overflow', ru: 'Перелив', th: 'ล้น', vn: 'Tràn' },
  '단차': { en: 'Step', ru: 'Ступень', th: 'ต่างระดับ', vn: 'Lệch' },
  '씹힘': { en: 'Chew', ru: 'Замятие', th: 'บิ่น', vn: 'Cấn' },
  '이물질': { en: 'Foreign', ru: 'Инородное', th: 'สิ่งแปลกปลอม', vn: 'Dị vật' },
  '미성형': { en: 'Unmolded', ru: 'Недолив', th: 'ขึ้นรูปไม่ครบ', vn: 'Chưa định hình' },
  '찍힘': { en: 'Dent', ru: 'Вмятина', th: 'รอยกด', vn: 'Vết móp' },
  '변형': { en: 'Deform', ru: 'Деформ.', th: 'ผิดรูป', vn: 'Biến dạng' },
  '길이불량': { en: 'Length Bad', ru: 'Длина', th: 'ความยาวผิด', vn: 'Sai độ dài' },
  '사상불량': { en: 'Finish Bad', ru: 'Отделка', th: 'ตกแต่งไม่ดี', vn: 'Lỗi hoàn thiện' },
  '운반파손': { en: 'Trans Damage', ru: 'Повреждение', th: 'เสียหายขนส่ง', vn: 'Hỏng vận chuyển' },
  '수지노출': { en: 'Resin Exp', ru: 'Смола', th: 'เรซินโผล่', vn: 'Lộ nhựa' },
  '외면오염': { en: 'Ext Contam', ru: 'Загрязнение', th: 'เปื้อนภายนอก', vn: 'Bẩn bên ngoài' },
  'CLIP누락': { en: 'Clip Miss', ru: 'Нет клипсы', th: 'คลิปหาย', vn: 'Thiếu Clip' },
  '홀막힘': { en: 'Hole Block', ru: 'Засор отв.', th: 'รูตัน', vn: 'Tắc lỗ' },
  'Tape불량': { en: 'Tape Bad', ru: 'Лента', th: 'เทปเสีย', vn: 'Lỗi băng keo' },
  '기타': { en: 'Other', ru: 'Прочее', th: 'อื่นๆ', vn: 'Khác' },
};

const getTranslatedText = (text, lang) => {
  if (lang === 'kr' || !text) return text;
  const translation = TRANSLATIONS[text]?.[lang];
  return translation ? `${text} (${translation})` : text;
};

// --- DATA ---
const INSPECTION_DEFECT_GROUPS = [
  {
    category: '소재 불량',
    items: [
      { key: 'scorch_a', label: "스코치 'A'" },
      { key: 'scorch_b', label: "스코치 'B'" },
      { key: 'scorch_c', label: "스코치 'C'" },
      { key: 'surface_flaw', label: '외면흠' },
      { key: 'cutting_bad', label: '컷팅불량' },
      { key: 'discolor', label: '이색/광택' },
    ]
  },
  {
    category: '조인트 불량',
    items: [
      { key: 'detach', label: '떨어짐' },
      { key: 'shortage', label: '양부족' },
      { key: 'push', label: '밀림' },
      { key: 'overflow', label: '넘침' },
      { key: 'step', label: '단차' },
      { key: 'bubble', label: '기포' },
      { key: 'chew', label: '씹힘' },
      { key: 'foreign', label: '이물질' },
      { key: 'unmolded', label: '미성형' },
      { key: 'dent', label: '찍힘' },
      { key: 'deformation', label: '변형' },
    ]
  },
  {
    category: '후가공 불량',
    items: [
      { key: 'length_bad', label: '길이불량' },
      { key: 'finish_bad', label: '사상불량' },
      { key: 'transport_dmg', label: '운반파손' },
      { key: 'resin_expose', label: '수지노출' },
      { key: 'ext_contam', label: '외면오염' },
      { key: 'clip_missing', label: 'CLIP누락' },
      { key: 'hole_block', label: '홀막힘' },
      { key: 'tape_bad', label: 'Tape불량' },
      { key: 'other', label: '기타' },
    ]
  }
];

const GUIDE_IMAGES = [
  "/images/guide_1.jpg",
  "/images/guide_2.jpg",
  "/images/guide_3.jpg"
];

const PROCESS_STANDARDS = {
  'DN8': {
    '소재준비': [
      "/images/DN8_A_SO.jpeg", "/images/DN8_FRT_SO_P.jpeg", "/images/DN8_FRT_SO_Q.jpeg",
      "/images/DN8_RR_SO_R.jpeg", "/images/DN8_RR_SO_S.jpeg", "/images/DN8_RR_SO_C.jpeg", "/images/DN8_RR_SO_D.jpeg",
    ],
    '프레스': ["/images/DN8_FRT_P.jpeg", "/images/DN8_RR_P.jpeg", "/images/DN8_RR_P_U.jpeg"],
    '후가공': ["/images/DN8_FRT_HU.jpeg", "/images/DN8_RR_HU.jpeg"],
    '검사': ["/images/DN8_G_P.jpg", "/images/DN8_G_R.jpg", "/images/DN8_O.jpg"]
  },
  'GN7': { '소재준비': ["/images/GN7_SO.jpeg"], '프레스': ["/images/GN7_P.jpeg"], '후가공': ["/images/GN7_HU.jpeg"], '검사': [] },
  'J100': { '소재준비': ["/images/J100_SO.jpg", "/images/J100_SO_B.jpg", "/images/J100_SO_C.jpg"], '프레스': ["/images/J100_P.jpg"], '후가공': ["/images/J100_HU.jpg"], '검사': ["/images/DN8_O.jpg"] },
  'J120': { '소재준비': ["/images/J120_SO.jpg"], '프레스': ["/images/J120_P.jpg"], '후가공': ["/images/J120_HU.jpg"], '검사': ["/images/DN8_O.jpg"] },
  'O100': { '소재준비': ["/images/O100_SO.jpg", "/images/O100_SO_B1.jpg"], '프레스': ["/images/O100_P.jpg"], '후가공': ["/images/O100_HU.jpg"], '검사': ["/images/O100_T.jpg"] }
};

const INSPECTION_SPECS = {
  'DN8': [{ part: 'FRT LH A', spec: '1176±5' }, { part: 'FRT RH A', spec: '1176±5' }, { part: 'RR LH A', spec: '644±5' }, { part: 'RR LH C', spec: '396±3' }, { part: 'RR LH D', spec: '293±3' }, { part: 'RR RH A', spec: '644±5' }, { part: 'RR RH C', spec: '396±3' }, { part: 'RR RH D', spec: '293±3' }],
  'J100': [{ part: 'RR A', spec: '708±5' }, { part: 'RR C', spec: '388±5' }, { part: 'RR D', spec: '273±3' }],
  'J120': [{ part: 'A', spec: '650±5' }, { part: 'E', spec: '250±3' }],
  'O100': [{ part: 'A', spec: '753±5' }, { part: 'D', spec: '270±3' }, { part: 'B1', spec: '258±3' }]
};

const FORM_TEMPLATES = {
  material: {
    columns: [
      { key: 'qty', label: '작업수량', type: 'number' },
      { key: 'defect_qty', label: '불량수량', type: 'number', isDefect: true },
      { key: 'good_qty', label: '정품수량', type: 'number', isReadOnly: true },
      { key: 'spec_start', label: '초물(길이)', type: 'text' },
      { key: 'spec_mid', label: '중물(길이)', type: 'text' },
      { key: 'spec_end', label: '종물(길이)', type: 'text' },
      { key: 'lot', label: 'Lot No', type: 'text' }
    ],
    rows: (model) => {
      if (model === 'J100') return ['J100 A소재', 'J100 C소재', 'J100 D소재'];
      if (model === 'J120') return ['J120 A소재', 'J120 D소재'];
      if (model === 'O100') return ['O100 A소재', 'O100 B1소재', 'O100 D소재'];
      return ['FRT A', 'FRT B', 'RR A', 'RR B', 'RR C', 'RR D'];
    }
  },
  press: {
    columns: [
      { key: 'fmb_lot', label: 'FMB LOT', type: 'text', isPhoto: true },
      { key: 'lot_resin', label: '수지 LOT (직/둔)', type: 'text' },
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'defect_qty', label: '불량수량', type: 'number', isDefect: true },
      { key: 'good_qty', label: '정품수량', type: 'number', isReadOnly: true },
    ],
    rows: (model) => model === 'DN8' ? ['FRT LH', 'FRT RH', 'RR LH', 'RR RH', 'RR END LH', 'RR END RH'] : ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  post: {
    columns: [
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'defect_qty', label: '불량수량', type: 'number', isDefect: true },
      { key: 'good_qty', label: '정품수량', type: 'number', isReadOnly: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  inspection: {
    columns: [
      { key: 'check_qty', label: '검사수량', type: 'number' },
      { key: 'defect_total', label: '불량수량', type: 'number', isDefect: true, isPopup: true },
      { key: 'good_qty', label: '정품수량', type: 'number', isReadOnly: true },
    ],
    rows: (model) => {
      if (model === 'J100') return ['J100 LH', 'J100 RH'];
      if (model === 'J120') return ['J120 LH', 'J120 RH'];
      if (model === 'O100') return ['O100 LH', 'O100 RH'];
      return ['FRT LH', 'FRT RH', 'RR LH', 'RR RH'];
    }
  }
};

const getFormType = (process) => {
  if (process.includes('소재')) return 'material';
  if (process.includes('프레스')) return 'press';
  if (process.includes('후가공')) return 'post';
  if (process.includes('검사')) return 'inspection';
  return 'material';
};

// --- Components ---

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; 
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        resolve(dataUrl);
      };
    };
  });
};

const ImageViewerModal = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <img src={imageUrl} alt="확대 이미지" className="max-w-full max-h-[80vh] rounded-lg shadow-lg" />
      <button onClick={onClose} className="absolute -top-10 right-0 text-white p-2"><X size={32} /></button>
    </div>
  );
};

const InspectionDefectModal = ({ rowLabel, currentData, onClose, onApply, lang }) => {
  const [defects, setDefects] = useState(currentData || {});

  const handleDefectChange = (key, value) => {
    setDefects(prev => ({
      ...prev,
      [key]: Number(value) || 0
    }));
  };

  const totalDefects = Object.values(defects).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-0 max-w-sm w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b bg-red-50 rounded-t-lg">
          <h3 className="font-bold text-lg text-red-800 flex items-center gap-2"><AlertCircle size={20} /> {getTranslatedText('불량 상세 입력', lang)} ({rowLabel})</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          {INSPECTION_DEFECT_GROUPS.map((group) => (
            <div key={group.category} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <h4 className="font-bold text-sm text-gray-700 mb-2 border-b border-gray-200 pb-1">{getTranslatedText(group.category, lang)}</h4>
              <div className="space-y-2">
                {group.items.map(type => (
                  <div key={type.key} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">{getTranslatedText(type.label, lang)}</span>
                    <input 
                      type="number" 
                      className="w-16 border border-gray-300 rounded p-1 text-right font-bold focus:ring-2 focus:ring-red-500 outline-none"
                      value={defects[type.key] || ''}
                      placeholder="0"
                      onChange={(e) => handleDefectChange(type.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold text-red-600 pt-2 border-t border-gray-300 text-lg">
            <span>{getTranslatedText('총 불량 합계', lang)}</span>
            <span>{totalDefects}</span>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-white rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm font-bold hover:bg-gray-300 transition">{getTranslatedText('취소', lang)}</button>
          <button onClick={() => onApply(totalDefects, defects)} className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 transition">{getTranslatedText('적용', lang)}</button>
        </div>
      </div>
    </div>
  );
};

const GuideModal = ({ onClose, lang }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-0 max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><HelpCircle className="text-orange-500" /> {getTranslatedText('작업일보 작성 가이드', lang)}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div className="space-y-6">
            {GUIDE_IMAGES.map((imgUrl, idx) => (
              <div key={idx} className="bg-white p-2 rounded shadow-md border border-slate-200">
                <div className="text-sm font-bold text-gray-500 mb-2 px-2">Step {idx + 1}</div>
                <img src={imgUrl} alt={`Guide ${idx + 1}`} className="w-full h-auto rounded" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/600x400/eee/999?text=Guide+Image+Not+Found"; }} />
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t bg-white flex justify-center"><button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-bold shadow">{getTranslatedText('취소', lang)}</button></div>
      </div>
    </div>
  );
};

const StandardModal = ({ vehicle, process, onClose, lang }) => {
  const standardImages = PROCESS_STANDARDS[vehicle]?.[process] || [];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-0 max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><BookOpen className="text-blue-600" /> {getTranslatedText('작업 표준서', lang)} ({vehicle} - {process})</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {standardImages.length > 0 ? (
            <div className="space-y-6">
              {standardImages.map((imgUrl, idx) => (
                <div key={idx} className="bg-white p-2 rounded shadow-md border border-slate-200">
                  <div className="text-sm font-bold text-gray-500 mb-2 px-2">Page {idx + 1}</div>
                  <img src={imgUrl} alt={`Standard ${idx + 1}`} className="w-full h-auto rounded" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/600x400/eee/999?text=Image+Not+Found"; }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <BookOpen size={48} className="mb-2 opacity-20" />
              <p>등록된 표준서 이미지가 없습니다.</p>
              <p className="text-xs mt-2 text-gray-400">public/images 폴더에 파일을 넣어주세요.</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-white flex justify-center"><button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-bold shadow">{getTranslatedText('취소', lang)}</button></div>
      </div>
    </div>
  );
};

const MoldManagement = ({ logs, lang }) => {
  const moldData = useMemo(() => {
    const summary = {}; 
    
    logs.forEach(log => {
      if (log.processType === '프레스' && log.details) {
        const model = log.vehicleModel;
        const worker = log.workerName;
        
        if (!summary[model]) summary[model] = {};
        if (!summary[model][worker]) summary[model][worker] = {};
        
        Object.entries(log.details).forEach(([part, data]) => {
          const qty = Number(data.qty) || 0;
          if (qty > 0) {
             summary[model][worker][part] = (summary[model][worker][part] || 0) + qty;
          }
        });
      }
    });
    return summary;
  }, [logs]);

  const getPartsForModel = (model) => {
      if (model === 'DN8') return ['FRT LH', 'FRT RH', 'RR LH', 'RR RH', 'RR END LH', 'RR END RH'];
      return ['FRT LH', 'FRT RH', 'RR LH', 'RR RH'];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <Wrench className="text-blue-600" /> 
          {getTranslatedText('금형 타수 관리 (작업자별 누적)', lang)}
        </h2>
        
        {Object.keys(moldData).length === 0 ? (
          <div className="text-center py-12 text-gray-400">{getTranslatedText('데이터가 없습니다.', lang)}</div>
        ) : (
          Object.entries(moldData).map(([model, workersData]) => {
             const parts = getPartsForModel(model);
             return (
               <div key={model} className="mb-8 last:mb-0">
                 <h3 className="bg-gray-100 px-4 py-2 font-bold text-lg border rounded-t-lg border-gray-300 text-gray-800">
                   {model}
                 </h3>
                 <div className="overflow-x-auto border border-t-0 border-gray-300 rounded-b-lg">
                   <table className="w-full text-sm text-left whitespace-nowrap">
                     <thead className="bg-blue-50 text-blue-900 font-bold uppercase text-xs">
                       <tr>
                         <th className="px-4 py-3 border-r border-gray-200">작업자</th>
                         {parts.map(part => (
                           <th key={part} className="px-4 py-3 text-right border-r border-gray-200">{part}</th>
                         ))}
                         <th className="px-4 py-3 text-right">합계</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                       {Object.entries(workersData).map(([worker, partsData]) => {
                         const workerTotal = parts.reduce((sum, part) => sum + (partsData[part] || 0), 0);
                         return (
                           <tr key={worker} className="hover:bg-gray-50">
                             <td className="px-4 py-2 font-bold border-r border-gray-100">{worker}</td>
                             {parts.map(part => (
                               <td key={part} className="px-4 py-2 text-right border-r border-gray-100 font-mono">
                                 {(partsData[part] || 0).toLocaleString()}
                               </td>
                             ))}
                             <td className="px-4 py-2 text-right font-bold text-blue-600 font-mono">
                               {workerTotal.toLocaleString()}
                             </td>
                           </tr>
                         );
                       })}
                       <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                         <td className="px-4 py-2 text-center border-r border-gray-300">총계</td>
                         {parts.map(part => {
                           const partTotal = Object.values(workersData).reduce((sum, wData) => sum + (wData[part] || 0), 0);
                           return (
                             <td key={part} className="px-4 py-2 text-right border-r border-gray-300 font-mono">
                               {partTotal.toLocaleString()}
                             </td>
                           );
                         })}
                         <td className="px-4 py-2 text-right text-blue-800 font-mono">
                           {Object.values(workersData).reduce((totalSum, wData) => totalSum + Object.values(wData).reduce((a,b)=>a+b,0), 0).toLocaleString()}
                         </td>
                       </tr>
                     </tbody>
                   </table>
                 </div>
               </div>
             );
          })
        )}
      </div>
    </div>
  );
};

// --- [UPDATED v3] Advanced Analytics Component (X축 날짜 표시 & 막대 내부 수치 표시) ---
const AdvancedAnalytics = ({ logs, currentYearMonth }) => {
  const [selectedModel, setSelectedModel] = useState('DN8'); 
  const [hoveredDay, setHoveredDay] = useState(null); 

  // 1. 데이터 필터링
  const filteredLogs = useMemo(() => {
    return logs.filter(log => log.vehicleModel === selectedModel);
  }, [logs, selectedModel]);

  // 2. KPI 계산
  const kpi = useMemo(() => {
    let totalProd = 0;
    let totalDefect = 0;
    filteredLogs.forEach(log => {
      totalProd += (Number(log.productionQty) || 0);
      totalDefect += (Number(log.defectQty) || 0);
    });
    const rate = totalProd > 0 ? ((totalDefect / totalProd) * 100).toFixed(2) : '0.00';
    return { totalProd, totalDefect, rate };
  }, [filteredLogs]);

  // 3. 차트 데이터 가공
  const chartData = useMemo(() => {
    const daysInMonth = new Date(currentYearMonth.split('-')[0], currentYearMonth.split('-')[1], 0).getDate();
    
    const stats = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      'FRT LH': 0, 'FRT RH': 0, 'RR LH': 0, 'RR RH': 0,
      total: 0
    }));

    filteredLogs.forEach(log => {
      const date = new Date(log.timestamp.seconds * 1000);
      const day = date.getDate();
      const target = stats[day - 1];

      if (log.details && target) {
        let dayTotal = 0;
        ['FRT LH', 'FRT RH', 'RR LH', 'RR RH'].forEach(part => {
          if (log.details[part]) {
            const qty = Number(log.details[part].qty || log.details[part].check_qty || 0);
            target[part] += qty;
            dayTotal += qty;
          }
        });
        target.total = dayTotal;
      }
    });

    return stats;
  }, [filteredLogs, currentYearMonth]);

  // 4. 불량 유형 집계
  const defectTypeRanking = useMemo(() => {
    const counts = {};
    filteredLogs.forEach(log => {
      if (log.details) {
        Object.values(log.details).forEach(row => {
          if (row.defect_details) {
            Object.entries(row.defect_details).forEach(([key, val]) => {
              counts[key] = (counts[key] || 0) + (Number(val) || 0);
            });
          }
        });
      }
    });
    
    const getLabel = (key) => {
       const flatItems = INSPECTION_DEFECT_GROUPS.flatMap(g => g.items);
       const found = flatItems.find(i => i.key === key);
       return found ? found.label : key;
    };

    return Object.entries(counts)
      .map(([key, val]) => ({ label: getLabel(key), value: val }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredLogs]);

  const maxDailyTotal = Math.max(...chartData.map(d => d.total), 10);

  return (
    <div className="space-y-6 mb-8 animate-fade-in">
      {/* 1. 상단 컨트롤 & KPI */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="text-blue-600" /> 월간 생산 분석 ({currentYearMonth})
          </h2>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <Truck size={18} className="text-gray-500" />
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)} 
              className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
            >
              {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
             <div><p className="text-sm text-blue-600 font-bold mb-1">총 생산수량</p><h3 className="text-2xl font-extrabold text-blue-900">{kpi.totalProd.toLocaleString()}</h3></div>
             <Factory className="text-blue-300 w-10 h-10" />
          </div>
          <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
             <div><p className="text-sm text-red-600 font-bold mb-1">총 불량수량</p><h3 className="text-2xl font-extrabold text-red-700">{kpi.totalDefect.toLocaleString()}</h3></div>
             <AlertCircle className="text-red-300 w-10 h-10" />
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex justify-between items-center">
             <div><p className="text-sm text-purple-600 font-bold mb-1">종합 불량률</p><h3 className="text-2xl font-extrabold text-purple-800">{kpi.rate}%</h3></div>
             <Calculator className="text-purple-300 w-10 h-10" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. 일별 생산 추이 (Stacked Bar Chart) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-gray-700 flex items-center gap-2"><Calendar size={18} /> 일별 생산 추이 ({selectedModel})</h3>
             <div className="flex flex-wrap gap-2 text-[10px] md:text-xs font-bold">
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-600"></div> FRT LH</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-400"></div> FRT RH</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-orange-400"></div> RR LH</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-400"></div> RR RH</span>
             </div>
          </div>
          
          <div className="relative flex-1 min-h-[300px] w-full flex items-end justify-between gap-1 pt-8 pb-8 px-2">
            {/* 그리드 라인 */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-2 pb-8 pt-8">
               {[100, 75, 50, 25, 0].map((pct) => (
                 <div key={pct} className="border-t border-gray-100 w-full relative h-0">
                    <span className="absolute -top-2 -left-0 text-[10px] text-gray-300">
                      {Math.round(maxDailyTotal * (pct / 100))}
                    </span>
                 </div>
               ))}
            </div>

            {/* 차트 렌더링 */}
            {chartData.map((d, idx) => {
               // 높이 비율 계산
               const h1 = (d['FRT LH'] / maxDailyTotal) * 100;
               const h2 = (d['FRT RH'] / maxDailyTotal) * 100;
               const h3 = (d['RR LH'] / maxDailyTotal) * 100;
               const h4 = (d['RR RH'] / maxDailyTotal) * 100;
               
               // 숫자를 표시할 최소 높이 (8%)
               const showLabel = (pct) => pct > 8;

               return (
                 <div 
                   key={idx} 
                   className="relative flex-1 flex flex-col justify-end h-full group"
                 >
                   {/* Stacked Bars */}
                   {d.total > 0 && (
                     <div className="w-full flex flex-col justify-end relative h-full rounded-t-sm overflow-hidden hover:opacity-90 transition-opacity cursor-pointer">
                        {/* 툴팁 */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-slate-800 text-white text-[10px] p-2 rounded z-20 hidden group-hover:block shadow-lg pointer-events-none">
                          <div className="font-bold border-b border-gray-600 pb-1 mb-1 text-center">{d.day}일 생산합계: {d.total}</div>
                          <div className="flex justify-between"><span className="text-red-300">RR RH</span> <span>{d['RR RH']}</span></div>
                          <div className="flex justify-between"><span className="text-orange-300">RR LH</span> <span>{d['RR LH']}</span></div>
                          <div className="flex justify-between"><span className="text-blue-200">FRT RH</span> <span>{d['FRT RH']}</span></div>
                          <div className="flex justify-between"><span className="text-blue-300">FRT LH</span> <span>{d['FRT LH']}</span></div>
                        </div>

                        {/* 막대 세그먼트 (위 -> 아래 순서로 렌더링되지만 flex-col justify-end로 인해 아래 -> 위로 쌓임) 
                            주의: 코드 상 먼저 나오는게 DOM 상위에 위치하므로 flex-col justify-end에서는 '맨 위'에 위치함.
                        */}
                        
                        {/* 4. RR RH (빨강 - 맨 위) */}
                        <div style={{ height: `${h4}%` }} className="w-full bg-red-400 relative border-b border-white/20">
                          {showLabel(h4) && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold">{d['RR RH']}</span>}
                        </div>
                        {/* 3. RR LH (주황) */}
                        <div style={{ height: `${h3}%` }} className="w-full bg-orange-400 relative border-b border-white/20">
                           {showLabel(h3) && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold">{d['RR LH']}</span>}
                        </div>
                        {/* 2. FRT RH (하늘) */}
                        <div style={{ height: `${h2}%` }} className="w-full bg-blue-400 relative border-b border-white/20">
                           {showLabel(h2) && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold">{d['FRT RH']}</span>}
                        </div>
                        {/* 1. FRT LH (파랑 - 맨 아래) */}
                        <div style={{ height: `${h1}%` }} className="w-full bg-blue-600 relative">
                           {showLabel(h1) && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold">{d['FRT LH']}</span>}
                        </div>
                     </div>
                   )}
                   
                   {/* X축 날짜 (개선됨: 위치 조정 및 가독성 확보) */}
                   <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-medium whitespace-nowrap">
                     {d.day}일
                   </div>
                 </div>
               );
            })}
          </div>
        </div>

        {/* 3. 불량 유형 TOP 5 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><List size={18} /> 불량 유형 TOP 5 ({selectedModel})</h3>
          <div className="space-y-4">
            {defectTypeRanking.length > 0 ? defectTypeRanking.map((item, idx) => (
              <div key={idx} className="relative group">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold text-gray-700 flex items-center gap-2">
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs text-white ${idx === 0 ? 'bg-red-500' : 'bg-gray-400'}`}>{idx + 1}</span>
                    {item.label}
                  </span>
                  <span className="text-red-600 font-bold">{item.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-1000" 
                    style={{ width: `${(item.value / defectTypeRanking[0].value) * 100}%` }}
                  ></div>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <CheckCircle className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-gray-400 text-sm">해당 차종의 불량 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
const PressSummaryTable = ({ logs }) => {
  const summaryData = useMemo(() => {
    const summary = {};
    VEHICLE_MODELS.forEach(model => { summary[model] = { 'FRT LH': { prod: 0, def: 0 }, 'FRT RH': { prod: 0, def: 0 }, 'RR LH': { prod: 0, def: 0 }, 'RR RH': { prod: 0, def: 0 }, 'RR END LH': { prod: 0, def: 0 }, 'RR END RH': { prod: 0, def: 0 } }; });
    logs.forEach(log => {
      if (log.processType === '프레스' && log.details) {
        const model = log.vehicleModel;
        if (!summary[model]) return;
        Object.entries(log.details).forEach(([part, data]) => {
          if (summary[model][part]) {
            summary[model][part].prod += (Number(data.qty) || 0);
            summary[model][part].def += (Number(data.defect_qty) || 0);
          }
        });
      }
    });
    return summary;
  }, [logs]);

  const grandTotal = useMemo(() => {
    let totalProd = 0;
    let totalDef = 0;
    Object.values(summaryData).forEach(parts => { Object.values(parts).forEach(val => { totalProd += val.prod; totalDef += val.def; }); });
    return { totalProd, totalDef };
  }, [summaryData]);

  const hasData = (parts) => Object.values(parts).some(v => v.prod > 0 || v.def > 0);

  return (
    <div className="mt-4 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden animate-fade-in mb-6">
      <div className="bg-gray-800 text-white px-4 py-3 font-bold flex items-center justify-between">
        <span>프레스 생산현황 상세 요약 (차종/부위별)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
            <tr><th className="px-4 py-3 border-r bg-gray-200">차종</th><th className="px-4 py-3 border-r">부위</th><th className="px-4 py-3 border-r text-right">생산수량</th><th className="px-4 py-3 text-right text-red-600">불량수량</th></tr>
          </thead>
          <tbody>
            {Object.entries(summaryData).map(([model, parts]) => {
              if (!hasData(parts)) return null;
              return (
                <React.Fragment key={model}>
                  {Object.entries(parts).map(([part, vals], idx) => (
                    <tr key={model + part} className="border-b hover:bg-gray-50">
                      {idx === 0 && <td className="px-4 py-3 font-bold border-r bg-gray-50 align-middle" rowSpan={Object.keys(parts).length + 1}>{model}</td>}
                      <td className="px-4 py-2 border-r text-gray-600">{part}</td>
                      <td className="px-4 py-2 text-right border-r font-medium">{vals.prod.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-600">{vals.def.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 border-b font-semibold">
                    <td colSpan="1" className="px-4 py-2 text-center border-r text-blue-800">소계</td>
                    <td className="px-4 py-2 text-right border-r text-blue-800">{Object.values(parts).reduce((a, b) => a + b.prod, 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-600">{Object.values(parts).reduce((a, b) => a + b.def, 0).toLocaleString()}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            {Object.values(summaryData).every(parts => !hasData(parts)) && <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>}
            <tr className="bg-slate-800 text-white font-bold border-t-2 border-black">
              <td colSpan="2" className="px-4 py-3 text-center border-r border-slate-600">총 합계</td>
              <td className="px-4 py-3 text-right border-r border-slate-600">{grandTotal.totalProd.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">{grandTotal.totalDef.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
// --- [FIXED] Monthly Report Modal (인쇄 시 배경 숨김 기능 추가) ---
const MonthlyReportModal = ({ logs, date, onClose }) => {
  // 데이터 가공 로직 (기존과 동일)
  const reportData = useMemo(() => {
    const data = {}; 
    logs.forEach(log => {
      const model = log.vehicleModel;
      if (!data[model]) data[model] = { totalProd: 0, totalDefect: 0, processes: {}, defectCounts: {} };

      const prod = Number(log.productionQty) || 0;
      const def = Number(log.defectQty) || 0;
      data[model].totalProd += prod;
      data[model].totalDefect += def;

      const proc = log.processType;
      if (!data[model].processes[proc]) data[model].processes[proc] = { prod: 0, def: 0 };
      data[model].processes[proc].prod += prod;
      data[model].processes[proc].def += def;

      if (log.details) {
        Object.values(log.details).forEach(row => {
          if (row.defect_details) {
            Object.entries(row.defect_details).forEach(([k, v]) => {
              data[model].defectCounts[k] = (data[model].defectCounts[k] || 0) + (Number(v) || 0);
            });
          }
        });
      }
    });
    return data;
  }, [logs]);

  const getDefectLabel = (key) => {
    const flatItems = INSPECTION_DEFECT_GROUPS.flatMap(g => g.items);
    const found = flatItems.find(i => i.key === key);
    return found ? found.label : key;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center z-[9999] overflow-y-auto pt-10 pb-10 print:p-0 print:m-0 print:overflow-visible print:bg-white print:inset-auto print:static">
      
      {/* [핵심 수정] 인쇄 전용 스타일 추가 
        - body * { visibility: hidden } : 화면의 모든 요소를 숨깁니다.
        - #print-section * { visibility: visible } : 오직 보고서 영역만 다시 보이게 합니다.
        - position: absolute : 보고서를 종이의 맨 위(0,0)로 강제 이동시킵니다.
      */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 0;
            background-color: white;
            z-index: 99999;
          }
          /* 불필요한 스크롤바 숨김 */
          html, body {
            height: auto;
            overflow: visible;
          }
        }
      `}</style>

      {/* 모달 컨테이너 */}
      <div 
        id="print-section" // 👈 여기가 인쇄될 영역입니다
        className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl md:rounded-lg flex flex-col relative print:shadow-none print:rounded-none"
      >
        
        {/* 상단 헤더 (인쇄 시 숨김 처리됨 - print:hidden) */}
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center print:hidden rounded-t-lg sticky top-0 z-50">
          <h3 className="font-bold flex items-center gap-2"><FileText /> 월간 생산분석 보고서 미리보기</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold flex items-center gap-2"><Printer size={16}/> 인쇄</button>
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold"><X size={16}/></button>
          </div>
        </div>

        {/* 실제 보고서 내용 */}
        <div className="p-8 text-black h-full">
          {/* 제목 및 결재란 */}
          <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
            <div className="text-left">
              <h1 className="text-3xl font-extrabold tracking-widest mb-2">월간 생산분석 보고서</h1>
              <p className="text-lg font-bold text-gray-600">기간: {date}</p>
            </div>
            <div className="flex border border-black text-center">
              <div className="w-20">
                <div className="bg-gray-100 border-b border-black py-1 text-xs font-bold">작 성</div>
                <div className="h-16 flex items-center justify-center text-sm">관리자</div>
              </div>
              <div className="w-20 border-l border-black">
                <div className="bg-gray-100 border-b border-black py-1 text-xs font-bold">검 토</div>
                <div className="h-16"></div>
              </div>
              <div className="w-20 border-l border-black">
                <div className="bg-gray-100 border-b border-black py-1 text-xs font-bold">승 인</div>
                <div className="h-16"></div>
              </div>
            </div>
          </div>

          {/* 데이터 루프 */}
          <div className="space-y-10">
            {Object.keys(reportData).length === 0 ? (
              <div className="text-center py-20 text-gray-400">데이터가 없습니다.</div>
            ) : (
              Object.entries(reportData).map(([model, data]) => {
                const defectRate = data.totalProd > 0 ? ((data.totalDefect / data.totalProd) * 100).toFixed(2) : "0.00";
                const top5Defects = Object.entries(data.defectCounts)
                  .map(([k, v]) => ({ label: getDefectLabel(k), value: v }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5);

                return (
                  <div key={model} className="break-inside-avoid page-break-after-always mb-8">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-black text-white px-4 py-1 font-bold text-lg rounded-sm">{model}</div>
                      <div className="flex-1 h-px bg-black"></div>
                    </div>

                    <div className="flex border border-black mb-4 bg-gray-50">
                      <div className="flex-1 p-3 text-center border-r border-black">
                        <div className="text-xs text-gray-500 font-bold mb-1">총 생산수량</div>
                        <div className="text-xl font-extrabold">{data.totalProd.toLocaleString()}</div>
                      </div>
                      <div className="flex-1 p-3 text-center border-r border-black">
                        <div className="text-xs text-gray-500 font-bold mb-1">총 불량수량</div>
                        <div className="text-xl font-extrabold text-red-600">{data.totalDefect.toLocaleString()}</div>
                      </div>
                      <div className="flex-1 p-3 text-center">
                        <div className="text-xs text-gray-500 font-bold mb-1">종합 불량률</div>
                        <div className="text-xl font-extrabold text-blue-800">{defectRate}%</div>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm mb-2 border-l-4 border-blue-600 pl-2">공정별 상세 실적</h4>
                        <table className="w-full text-sm border-collapse border border-black">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-black py-1 px-2">공정명</th>
                              <th className="border border-black py-1 px-2 text-right">생산</th>
                              <th className="border border-black py-1 px-2 text-right">불량</th>
                              <th className="border border-black py-1 px-2 text-center">불량률</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(data.processes).map(([proc, pData]) => (
                              <tr key={proc}>
                                <td className="border border-black py-1 px-2 font-bold text-center">{proc}</td>
                                <td className="border border-black py-1 px-2 text-right">{pData.prod.toLocaleString()}</td>
                                <td className="border border-black py-1 px-2 text-right text-red-600">{pData.def.toLocaleString()}</td>
                                <td className="border border-black py-1 px-2 text-center text-xs">
                                  {pData.prod > 0 ? ((pData.def / pData.prod) * 100).toFixed(2) : '0.00'}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="w-[40%]">
                        <h4 className="font-bold text-sm mb-2 border-l-4 border-red-600 pl-2">불량 유형 TOP 5</h4>
                        <table className="w-full text-sm border-collapse border border-black">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-black py-1 px-2 w-10">순위</th>
                              <th className="border border-black py-1 px-2">유형</th>
                              <th className="border border-black py-1 px-2 text-right">수량</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...Array(5)].map((_, idx) => {
                              const item = top5Defects[idx];
                              return (
                                <tr key={idx}>
                                  <td className="border border-black py-1 px-2 text-center bg-gray-50">{idx + 1}</td>
                                  <td className="border border-black py-1 px-2">{item ? item.label : '-'}</td>
                                  <td className="border border-black py-1 px-2 text-right font-bold">{item ? item.value : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="mt-12 text-center text-xs text-gray-400 border-t border-gray-300 pt-2">
            MES Production Management System - Printed on {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
const LoginScreen = ({ onLogin }) => {
  const ADMIN_PASSWORD = 'jangan123'; 
  const [role, setRole] = useState('worker');
  const [name, setName] = useState('');
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState('kr');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (role === 'worker') {
      if (name.trim()) onLogin({ name, role, lang }); else setError(getTranslatedText('이름을 입력해주세요.', lang));
    } else {
      if (adminId === 'admin' && password === ADMIN_PASSWORD) onLogin({ name: '관리자', role, lang }); else setError(getTranslatedText('아이디 또는 비밀번호가 올바르지 않습니다.', lang));
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded shadow-xl max-w-sm w-full border border-slate-300">
        <div className="flex justify-center mb-6"><div className="bg-blue-700 p-4 rounded-2xl shadow-lg"><ClipboardList className="w-10 h-10 text-white" /></div></div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">장안산업 작업관리</h2>
        
        <div className="flex justify-center mb-6">
           <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
             {['kr', 'en', 'ru', 'th', 'vn'].map(l => (
               <button 
                 key={l} 
                 type="button" 
                 onClick={() => setLang(l)} 
                 className={`px-3 py-1 rounded text-lg ${lang === l ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 {l === 'kr' ? '🇰🇷' : l === 'en' ? '🇺🇸' : l === 'ru' ? '🇷🇺' : l === 'th' ? '🇹🇭' : '🇻🇳'}
               </button>
             ))}
           </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg mb-6 border border-slate-200">
          <button type="button" onClick={() => { setRole('worker'); setError(''); }} className={`flex-1 py-3 px-4 rounded-md text-sm font-bold transition ${role === 'worker' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500'}`}>{getTranslatedText('작업자', lang)}</button>
          <button type="button" onClick={() => { setRole('admin'); setError(''); }} className={`flex-1 py-3 px-4 rounded-md text-sm font-bold transition ${role === 'admin' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500'}`}>관리자</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {role === 'worker' ? (
            <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Name</label><input type="text" required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-base" placeholder={getTranslatedText('성명 입력', lang)} value={name} onChange={(e) => setName(e.target.value)} /></div>
          ) : (
            <>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">ID</label><input type="text" required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition text-base" placeholder="admin" value={adminId} onChange={(e) => setAdminId(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Password</label><input type="password" required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition text-base" placeholder="****" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            </>
          )}
          {error && <div className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-lg border border-red-100 flex items-center justify-center gap-1"><AlertCircle size={14} /> {error}</div>}
          <button type="submit" className={`w-full font-bold py-4 rounded-xl mt-2 shadow-lg transition text-white text-base ${role === 'worker' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>로그인</button>
        </form>
      </div>
    </div>
  );
};

const DynamicTableForm = ({ vehicle, processType, onChange, initialData, lang }) => {
  const formType = getFormType(processType);
  const template = FORM_TEMPLATES[formType];
  const rowLabels = template.rows(vehicle);
  const [formData, setFormData] = useState({});
  const fileInputRef = useRef(null);
  const [activeCell, setActiveCell] = useState({ row: null, col: null });
  
  // Defect Modal State (Integrated)
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectRowLabel, setDefectRowLabel] = useState('');
  const [currentDefectData, setCurrentDefectData] = useState({});

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) { setFormData(initialData); }
  }, [vehicle, processType]);

  useEffect(() => {
    let totalQty = 0;
    let totalDefect = 0;
    Object.keys(formData).forEach(r => {
      const qty = Number(formData[r]['qty'] || formData[r]['check_qty'] || 0);
      const defect = Number(formData[r]['defect_qty'] || formData[r]['defect_total'] || 0);
      
      if (template.columns.find(c => c.key === 'good_qty')) {
        const good = Math.max(0, qty - defect);
        if (formData[r]['good_qty'] !== good) {
             formData[r]['good_qty'] = good;
        }
      }

      Object.keys(formData[r]).forEach(c => {
        const val = formData[r][c];
        const colDef = template.columns.find(col => col.key === c);
        if (colDef?.key === 'qty' || colDef?.key === 'check_qty') totalQty += (Number(val) || 0);
        if (colDef?.isDefect) totalDefect += (Number(val) || 0);
      });
    });
    onChange(formData, totalQty, totalDefect);
  }, [formData, onChange, template.columns]);

  const handleCellChange = (rowLabel, colKey, value) => {
    const newData = { ...formData };
    if (!newData[rowLabel]) newData[rowLabel] = {};
    const colDef = template.columns.find(c => c.key === colKey);
    const finalValue = colDef.type === 'number' ? (Number(value) || 0) : value;
    newData[rowLabel][colKey] = finalValue;
    
    // Calculate good_qty immediately
    const qty = colKey === 'qty' || colKey === 'check_qty' ? finalValue : (newData[rowLabel]['qty'] || newData[rowLabel]['check_qty'] || 0);
    const defect = colKey === 'defect_qty' || colKey === 'defect_total' ? finalValue : (newData[rowLabel]['defect_qty'] || newData[rowLabel]['defect_total'] || 0);
    if(template.columns.find(c=>c.key==='good_qty')) {
        newData[rowLabel]['good_qty'] = Math.max(0, qty - defect);
    }
    
    setFormData(newData);
  };

  const handleCameraClick = (rowLabel, colKey) => {
    setActiveCell({ row: rowLabel, col: colKey });
    if (fileInputRef.current) fileInputRef.current.click();
  };
  
  const handleDefectPopup = (rowLabel) => {
    setDefectRowLabel(rowLabel);
    setCurrentDefectData(formData[rowLabel]?.defect_details || {});
    setShowDefectModal(true);
  };

  const handleDefectApply = (total, detailData) => {
     const newData = { ...formData };
     if (!newData[defectRowLabel]) newData[defectRowLabel] = {};
     newData[defectRowLabel]['defect_total'] = total;
     newData[defectRowLabel]['defect_qty'] = total;
     newData[defectRowLabel]['defect_details'] = detailData;
     
     const qty = newData[defectRowLabel]['qty'] || newData[defectRowLabel]['check_qty'] || 0;
     if(template.columns.find(c=>c.key==='good_qty')) {
        newData[defectRowLabel]['good_qty'] = Math.max(0, qty - total);
     }
     
     setFormData(newData);
     setShowDefectModal(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && activeCell.row) {
      try {
        const compressedDataUrl = await compressImage(file);
        handleCellChange(activeCell.row, activeCell.col, compressedDataUrl);
      } catch (err) { console.error(err); alert("이미지 처리 오류"); }
    }
    e.target.value = '';
  };

  const isImage = (value) => typeof value === 'string' && value.startsWith('data:image');

  return (
    <>
      <div className="overflow-x-auto border border-black bg-white shadow-sm">
        <table className="w-full text-sm border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-3 text-center w-24 font-bold text-gray-800">{getTranslatedText('구분', lang)}</th>
              {template.columns.map(col => (
                <th key={col.key} className={`border border-black px-1 py-3 text-center font-bold text-xs whitespace-nowrap ${col.isDefect ? 'text-red-700' : 'text-gray-800'}`}>{getTranslatedText(col.label, lang)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rowLabel) => (
              <tr key={rowLabel}>
                <td className="border border-black px-2 py-3 font-bold text-center bg-gray-50 text-xs">{rowLabel}</td>
                {template.columns.map(col => {
                  const cellValue = formData[rowLabel]?.[col.key] || '';
                  const hasImage = isImage(cellValue);
                  
                  if (col.isPopup) {
                    return (
                       <td key={col.key} className="border border-black p-0 h-12 relative bg-white">
                         <button onClick={() => handleDefectPopup(rowLabel)} className="w-full h-full text-center text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-1">{cellValue || 0} <ChevronDown size={14}/></button>
                       </td>
                    );
                  }

                  if (col.isReadOnly) {
                    return (
                       <td key={col.key} className="border border-black p-0 h-12 bg-gray-100">
                         <div className="w-full h-full flex items-center justify-center font-bold text-blue-800">{cellValue || 0}</div>
                       </td>
                    );
                  }

                  return (
                    <td key={col.key} className="border border-black p-0 h-12 relative group bg-white">
                      {hasImage ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <button onClick={() => handleCellChange(rowLabel, col.key, '')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-red-100 hover:text-red-600" title="클릭하여 삭제"><Camera size={14} /> <span>{getTranslatedText('사진등록됨', lang)}</span></button>
                        </div>
                      ) : (
                        <input type={col.type === 'number' ? 'number' : 'text'} min={col.type === 'number' ? "0" : undefined} value={cellValue} className={`w-full h-full text-center outline-none bg-transparent text-base ${col.isDefect ? 'text-red-600 font-semibold' : 'text-gray-900'}`} onChange={(e) => handleCellChange(rowLabel, col.key, e.target.value)} />
                      )}
                      {col.isPhoto && !hasImage && <button onClick={() => handleCameraClick(rowLabel, col.key)} className="absolute right-0 top-0 h-full px-2 text-gray-400 hover:text-blue-600 opacity-50 hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm" title="사진 촬영"><Camera size={18} /></button>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      
      {showDefectModal && (
        <InspectionDefectModal 
          rowLabel={defectRowLabel} 
          currentData={currentDefectData}
          onClose={() => setShowDefectModal(false)}
          onApply={handleDefectApply}
          lang={lang}
        />
      )}
    </>
  );
};

const MaterialLotForm = ({ onChange, initialData, lang }) => {
  const [data, setData] = useState(initialData || {});
  const materials = ['A소재', 'B소재', 'C소재', 'D소재'];
  const columns = [
    { key: 'cho', label: '초물(LH/RH)' },
    { key: 'jung', label: '중물(LH/RH)' },
    { key: 'jong', label: '종물(LH/RH)' },
  ];

  useEffect(() => {
    if (initialData) setData(initialData);
  }, [initialData]);

  const handleChange = (material, colKey, value) => {
    const newData = { ...data };
    if (!newData[material]) newData[material] = {};
    newData[material][colKey] = value;
    setData(newData);
    onChange(newData);
  };

  return (
    <div className="mt-6 border border-black bg-white shadow-sm">
      <div className="bg-gray-800 text-white px-4 py-3 border-b border-black font-bold text-sm flex items-center gap-2">
        <Layers size={16} />
        {getTranslatedText('소재 LOT 관리', lang)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-3 text-center font-bold w-24">{getTranslatedText('구분', lang)}</th>
              {columns.map(col => (
                <th key={col.key} className="border border-black px-2 py-3 text-center font-bold">{getTranslatedText(col.label, lang)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materials.map((mat) => (
              <tr key={mat}>
                <td className="border border-black px-2 py-3 text-center font-bold bg-gray-50 text-xs">{mat}</td>
                {columns.map(col => (
                  <td key={col.key} className="border border-black p-0 h-12">
                    <input
                      type="text"
                      value={data[mat]?.[col.key] || ''}
                      className="w-full h-full text-center outline-none bg-transparent text-base"
                      onChange={(e) => handleChange(mat, col.key, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DimensionTableForm = ({ vehicle, onChange, initialData, lang }) => {
  const [measureData, setMeasureData] = useState(initialData || {});
  // Determine if it's a KGM model (J100, J120, O100) or standard (DN8, etc.)
  const isKgmModel = isKGM(vehicle);
  const specs = INSPECTION_SPECS[vehicle] || [];

  // Define columns based on vehicle type
  const dimensionColumns = isKgmModel 
    ? ['초', '중', '종'] 
    : ['x1', 'x2', 'x3', 'x4', 'x5'];

  useEffect(() => { if (initialData) setMeasureData(initialData); }, [initialData]);

  const handleMeasureChange = (part, colKey, value) => {
    const newData = { ...measureData };
    if (!newData[part]) newData[part] = {};
    newData[part][colKey] = value;
    setMeasureData(newData);
    onChange(newData);
  };

  if (specs.length === 0) return null;

  return (
    <div className="mt-6 border border-black bg-white shadow-sm">
      <div className="bg-gray-800 text-white px-4 py-3 border-b border-black font-bold text-sm flex items-center gap-2"><Ruler size={16} />{getTranslatedText('중요 치수(길이) 검사현황', lang)} ({vehicle})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-3 text-center font-bold">{getTranslatedText('구분', lang)}</th>
              <th className="border border-black px-2 py-3 text-center font-bold">{getTranslatedText('규격 (SPEC)', lang)}</th>
              {dimensionColumns.map(col => <th key={col} className="border border-black px-2 py-3 text-center font-bold w-16">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {specs.map((item) => (
              <tr key={item.part}>
                <td className="border border-black px-2 py-3 text-center font-bold bg-gray-50 text-xs">{item.part}</td>
                <td className="border border-black px-2 py-3 text-center font-medium">{item.spec}</td>
                {dimensionColumns.map((col) => (
                  <td key={col} className="border border-black p-0 h-12">
                    <input type="text" value={measureData[item.part]?.[col] || ''} className="w-full h-full text-center outline-none bg-transparent text-base" onChange={(e) => handleMeasureChange(item.part, col, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminAddLogModal = ({ db, appId, onClose, lang }) => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [workerName, setWorkerName] = useState('');
    const [vehicle, setVehicle] = useState('');
    const [processType, setProcessType] = useState('');
    const [notes, setNotes] = useState('');
    const [formDetails, setFormDetails] = useState({});
    const [measurements, setMeasurements] = useState({});
    const [materialLots, setMaterialLots] = useState({});
    const [totalQty, setTotalQty] = useState(0);
    const [totalDefect, setTotalDefect] = useState(0);
    const [endHour, setEndHour] = useState('17');
    const [endMinute, setEndMinute] = useState('30');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFormChange = (details, qty, defect) => {
        setFormDetails(details);
        setTotalQty(qty);
        setTotalDefect(defect);
    };

    const handleSubmit = async () => {
        if (!vehicle || !processType || !workerName) return alert("필수 항목을 입력해주세요.");
        setIsSubmitting(true);
        try {
            const submitDate = new Date(date);
            submitDate.setHours(new Date().getHours()); 
            
            const workTime = `08:30 ~ ${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

            await addDoc(collection(db, 'work_logs'), {
                appId,
                workerName,
                vehicleModel: vehicle,
                processType,
                logTitle: getLogTitle(vehicle, processType),
                details: formDetails,
                measurements,
                materialLots,
                productionQty: totalQty,
                defectQty: totalDefect,
                notes,
                workTime,
                attachment: null,
                timestamp: submitDate
            });
            alert("추가되었습니다.");
            onClose();
        } catch (err) {
            console.error(err);
            alert("오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-blue-50 rounded-t-lg">
                    <h3 className="font-bold text-lg text-blue-800 flex items-center gap-2"><Plus size={20} /> 작업일보 추가 (관리자)</h3>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">날짜 선택</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">작업자명</label>
                            <input type="text" value={workerName} onChange={e => setWorkerName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="작업자 이름 입력" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">차종</label>
                            <select value={vehicle} onChange={e => setVehicle(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="">차종 선택</option>
                                {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">공정</label>
                            <select value={processType} onChange={e => setProcessType(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="">공정 선택</option>
                                {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {vehicle && processType ? (
                        <>
                            <div className="bg-blue-50 p-3 rounded text-center font-bold text-blue-800 border border-blue-100">
                                {getLogTitle(vehicle, processType)} 작성 중...
                            </div>
                            <DynamicTableForm 
                               vehicle={vehicle} 
                               processType={processType} 
                               onChange={handleFormChange} 
                               lang={lang} 
                            />
                            
                            {['프레스', '후가공', '검사'].includes(processType) && (
                                <MaterialLotForm onChange={setMaterialLots} lang={lang} />
                            )}
                            
                            {processType === '검사' && INSPECTION_SPECS[vehicle] && (
                                <DimensionTableForm vehicle={vehicle} onChange={setMeasurements} lang={lang} />
                            )}
                            
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700">특이사항</label>
                                <textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="특이사항 입력"></textarea>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                            <FileText size={48} className="mx-auto mb-2 opacity-20" />
                            <p>차종과 공정을 선택하면 입력 양식이 나타납니다.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <button onClick={onClose} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 rounded hover:bg-gray-50 font-bold transition">취소</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow transition flex items-center gap-2">
                        {isSubmitting ? '저장 중...' : <><Save size={18} /> 저장</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditLogModal = ({ log, onClose, onUpdate, lang }) => {
  const [notes, setNotes] = useState(log.notes || '');
  const [formDetails, setFormDetails] = useState(log.details || {});
  const [measurements, setMeasurements] = useState(log.measurements || {});
  const [materialLots, setMaterialLots] = useState(log.materialLots || {});
  const [totalQty, setTotalQty] = useState(log.productionQty || 0);
  const [totalDefect, setTotalDefect] = useState(log.defectQty || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormChange = (details, qty, defect) => {
    setFormDetails(details);
    setTotalQty(qty);
    setTotalDefect(defect);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate(log.id, {
        details: formDetails,
        measurements: measurements,
        materialLots: materialLots,
        productionQty: totalQty,
        defectQty: totalDefect,
        notes: notes,
      });
      onClose();
    } catch (error) { console.error(error); alert('수정 중 오류가 발생했습니다.'); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4 overflow-y-auto">
      <div className="bg-white md:rounded-lg shadow-2xl w-full max-w-4xl h-full md:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 md:rounded-t-lg sticky top-0 z-20">
          <h3 className="font-bold text-lg flex items-center gap-2"><Pencil size={18} className="text-blue-600" />작업일보 수정</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24} className="text-gray-500" /></button>
        </div>
        <div className="p-4 md:p-6 space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">{log.vehicleModel} / {log.processType}</div>
          <DynamicTableForm 
             vehicle={log.vehicleModel} 
             processType={log.processType} 
             onChange={handleFormChange} 
             initialData={formDetails} 
             lang={lang}
          />
          {['프레스', '후가공', '검사'].includes(log.processType) && (
            <MaterialLotForm onChange={setMaterialLots} initialData={log.materialLots} lang={lang} />
          )}
          {log.processType === '검사' && INSPECTION_SPECS[log.vehicleModel] && (
            <DimensionTableForm vehicle={log.vehicleModel} onChange={setMeasurements} initialData={log.measurements} lang={lang} />
          )}
          <div><label className="block text-sm font-bold text-gray-700 mb-2">특이사항</label><textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea></div>
        </div>
        <div className="p-4 border-t bg-gray-50 md:rounded-b-lg flex justify-end gap-3 sticky bottom-0 z-20">
          <button onClick={onClose} className="px-6 py-3 md:py-2 text-gray-600 font-medium hover:bg-gray-200 rounded transition bg-white border border-gray-300">취소</button>
          <button onClick={handleSave} disabled={isSubmitting} className="px-8 py-3 md:py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition flex items-center gap-2">{isSubmitting ? '저장 중...' : <><Save size={18} /> 저장</>}</button>
        </div>
      </div>
    </div>
  );
};

const WorkerDashboard = ({ user, db, appId, lang }) => {
  const [vehicle, setVehicle] = useState('');
  const [processType, setProcessType] = useState('');
  const [notes, setNotes] = useState('');
  const [formDetails, setFormDetails] = useState({});
  const [measurements, setMeasurements] = useState({});
  const [materialLots, setMaterialLots] = useState({});
  const [totalQty, setTotalQty] = useState(0);
  const [totalDefect, setTotalDefect] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveTimerRef = useRef(null);
  const [showStandard, setShowStandard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const [endHour, setEndHour] = useState('17');
  const [endMinute, setEndMinute] = useState('30');
  
  const logTitle = useMemo(() => getLogTitle(vehicle, processType), [vehicle, processType]);

  useEffect(() => {
    const savedData = localStorage.getItem('mes_autosave_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (new Date().getTime() - parsed.savedAt < 24 * 60 * 60 * 1000) {
          setVehicle(parsed.vehicle || '');
          setProcessType(parsed.processType || '');
          setNotes(parsed.notes || '');
          setEndHour(parsed.endHour || '17');
          setEndMinute(parsed.endMinute || '30');
          if (parsed.formDetails) setFormDetails(parsed.formDetails);
          if (parsed.measurements) setMeasurements(parsed.measurements);
          if (parsed.materialLots) setMaterialLots(parsed.materialLots);
        }
      } catch (e) { console.error("Auto-load failed", e); }
    }
  }, []);

  useEffect(() => {
    if (!vehicle || !processType) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const dataToSave = {
        vehicle, processType, notes, formDetails, measurements, materialLots, endHour, endMinute,
        savedAt: new Date().getTime()
      };
      localStorage.setItem('mes_autosave_data', JSON.stringify(dataToSave));
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 1000);
  }, [vehicle, processType, notes, formDetails, measurements, materialLots, endHour, endMinute]);

  const handleFormChange = (details, qty, defect) => {
    setFormDetails(details);
    setTotalQty(qty);
    setTotalDefect(defect);
  };

  const handlePrint = () => { window.print(); };

  const handleAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("파일 크기는 500KB 이하여야 합니다."); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setAttachment({ name: file.name, type: file.type, data: event.target.result }); };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => { setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = ""; };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle || !processType) return;
    const workTime = `08:30 ~ ${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'work_logs'), {
        appId: appId,
        workerName: user.name,
        vehicleModel: vehicle,
        processType: processType,
        logTitle: logTitle,
        details: formDetails,
        measurements: measurements,
        materialLots: materialLots,
        productionQty: totalQty,
        defectQty: totalDefect,
        notes: notes,
        workTime: workTime,
        attachment: attachment,
        timestamp: serverTimestamp(),
      });
      setSubmitSuccess(true);
      setNotes('');
      setVehicle(''); 
      setProcessType('');
      setMeasurements({});
      setFormDetails({});
      setMaterialLots({});
      setAttachment(null);
      localStorage.removeItem('mes_autosave_data');
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full md:max-w-[210mm] mx-auto my-0 md:my-8 bg-white shadow-none md:shadow-2xl min-h-screen md:min-h-[297mm] relative text-black print:shadow-none print:m-0">
      <div className="p-4 md:p-8 pb-20 md:pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-2 mb-6 gap-4">
          <div className="flex items-center gap-3">
             <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-black flex items-center gap-3"><FileText className="w-6 h-6 md:w-8 md:h-8" /> {getTranslatedText('작 업 일 보', lang)}</h1>
             {autoSaved && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded animate-fade-in print:hidden">{getTranslatedText('자동저장됨', lang)}</span>}
          </div>
          <div className="text-right w-full md:w-auto">
            <div className="flex justify-end gap-2 mb-2 print:hidden">
               <button onClick={() => setShowGuide(true)} className="text-xs flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200 transition font-bold"><HelpCircle size={14} /> {getTranslatedText('작업일보 작성 가이드', lang)}</button>
               <button onClick={() => setShowStandard(true)} className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition font-bold"><BookOpen size={14} /> {getTranslatedText('작업 표준서', lang)}</button>
               <button onClick={handlePrint} className="text-xs flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition font-bold"><Printer size={14} /> {getTranslatedText('인쇄', lang)}</button>
            </div>
            <p className="text-xs font-bold text-gray-600 mb-1 hidden md:block">{getTranslatedText('결 재', lang)}</p>
            <div className="flex border border-black w-full md:w-auto">
              <div className="flex-1 md:w-16 border-r border-black"><div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">{getTranslatedText('작 성', lang)}</div><div className="h-10 md:h-12 flex items-center justify-center text-sm font-bold">{user.name}</div></div>
              <div className="flex-1 md:w-16 border-r border-black"><div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">{getTranslatedText('검 토', lang)}</div><div className="h-10 md:h-12"></div></div>
              <div className="flex-1 md:w-16"><div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">{getTranslatedText('승 인', lang)}</div><div className="h-10 md:h-12"></div></div>
            </div>
          </div>
        </div>

        <div className="border border-black mb-6">
          <div className="flex flex-col md:flex-row border-b border-black">
            <div className="flex flex-1 border-b md:border-b-0 border-black md:border-r">
               <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">{getTranslatedText('작업일자', lang)}</div>
               <div className="flex-1 flex items-center justify-center font-medium text-sm">{new Date().toLocaleDateString()}</div>
            </div>
            <div className="flex flex-1">
               <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">{getTranslatedText('작업자', lang)}</div>
               <div className="flex-1 flex items-center justify-center font-medium text-sm">{user.name}</div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row border-b border-black">
             <div className="flex flex-1 border-b md:border-b-0 border-black md:border-r">
                <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">{getTranslatedText('작업시간', lang)}</div>
                <div className="flex-1 flex items-center justify-center py-2 px-2 bg-blue-50/50">
                   <div className="flex items-center gap-1 text-sm">
                      <span className="font-bold text-gray-700">08:30</span><span className="text-gray-400">~</span>
                      <select value={endHour} onChange={(e) => setEndHour(e.target.value)} className="bg-transparent font-bold text-blue-900 outline-none text-center appearance-none cursor-pointer border-b border-blue-200 py-1">{HOURS.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}</select>
                      <span>:</span>
                      <select value={endMinute} onChange={(e) => setEndMinute(e.target.value)} className="bg-transparent font-bold text-blue-900 outline-none text-center appearance-none cursor-pointer border-b border-blue-200 py-1">{MINUTES.map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}</select>
                   </div>
                </div>
             </div>
          </div>
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-1 border-b md:border-b-0 border-black md:border-r h-12">
              <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm">{getTranslatedText('차종', lang)}</div>
              <div className="flex-1 relative">
                <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="w-full h-full p-2 outline-none appearance-none bg-transparent font-bold text-blue-900 text-center cursor-pointer">
                  <option value="">{getTranslatedText('차종', lang)} 선택</option>
                  {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <Truck className="absolute right-2 top-4 text-gray-400 pointer-events-none w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-1 h-12">
              <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm">{getTranslatedText('공정', lang)}</div>
              <div className="flex-1 relative">
                <select value={processType} onChange={(e) => setProcessType(e.target.value)} className="w-full h-full p-2 outline-none appearance-none bg-transparent font-bold text-blue-900 text-center cursor-pointer">
                  <option value="">{getTranslatedText('공정', lang)} 선택</option>
                  {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <Factory className="absolute right-2 top-4 text-gray-400 pointer-events-none w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {vehicle && processType ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-800 text-white px-4 py-3 border border-black">
              <span className="font-bold text-sm flex items-center gap-2"><ClipboardList size={16} />{logTitle}</span>
              <div className="text-xs space-x-3 font-mono flex"><span>{getTranslatedText('합격', lang)}: {totalQty.toLocaleString()}</span><span className="text-red-300">{getTranslatedText('불량', lang)}: {totalDefect.toLocaleString()}</span></div>
            </div>

            <DynamicTableForm 
               vehicle={vehicle} 
               processType={processType} 
               onChange={handleFormChange} 
               initialData={formDetails}
               lang={lang}
            />
            
            {['프레스', '후가공', '검사'].includes(processType) && (
              <MaterialLotForm onChange={setMaterialLots} initialData={materialLots} lang={lang} />
            )}

            {processType === '검사' && INSPECTION_SPECS[vehicle] && (
              <DimensionTableForm vehicle={vehicle} onChange={setMeasurements} initialData={measurements} lang={lang} />
            )}

            <div className="border border-black">
              <div className="bg-gray-100 border-b border-black px-3 py-2 font-bold text-xs text-gray-700">{getTranslatedText('특이사항 및 인수인계', lang)}</div>
              <textarea rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 text-base outline-none resize-none" placeholder={getTranslatedText('내용을 입력하세요.', lang)}></textarea>
            </div>

            <div className="border border-black p-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2"><Paperclip size={18} className="text-gray-600" /><span className="text-sm font-bold text-gray-700">{getTranslatedText('파일 첨부 (성적서/도면)', lang)}</span><span className="text-xs text-gray-400">(PDF, 이미지 / 500KB 이하)</span></div>
              <div className="flex items-center gap-2">
                {attachment ? (
                   <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold"><FileIcon size={14} /><span className="max-w-[100px] truncate">{attachment.name}</span><button onClick={removeAttachment} className="hover:text-red-500"><X size={14}/></button></div>
                ) : (
                  <label className="cursor-pointer bg-white border border-gray-300 px-3 py-1 rounded text-xs font-bold hover:bg-gray-50 flex items-center gap-1"><span>{getTranslatedText('파일 선택', lang)}</span><input type="file" accept="image/*, application/pdf" ref={fileInputRef} onChange={handleAttachmentChange} className="hidden" /></label>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-300 md:static md:p-0 md:bg-transparent md:border-0 md:flex md:justify-end md:pt-4 z-40 print:hidden">
              <button onClick={handleSubmit} disabled={isSubmitting} className={`w-full md:w-auto px-8 py-4 md:py-3 font-bold text-white shadow-lg flex items-center justify-center gap-2 border border-black transition active:translate-y-1 rounded-lg md:rounded-none ${isSubmitting ? 'bg-gray-400' : 'bg-blue-800 hover:bg-blue-900'}`}>{isSubmitting ? getTranslatedText('저장 중...', lang) : <><Save size={20} />{getTranslatedText('일보 저장', lang)}</>}</button>
            </div>
          </div>
        ) : (
          <div className="h-64 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg"><FileText className="w-12 h-12 mb-2 opacity-20" /><p className="text-sm">상단에서 차종과 공정을 선택하면<br/>입력 양식이 표시됩니다.</p></div>
        )}
      </div>

      {showStandard && <StandardModal vehicle={vehicle} process={processType} onClose={() => setShowStandard(false)} lang={lang} />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} lang={lang} />}
      {submitSuccess && <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-3 shadow-2xl flex items-center gap-2 z-50 rounded-full print:hidden"><CheckCircle size={18} className="text-green-400" /><span className="font-bold text-sm">저장 완료</span></div>}
    </div>
  );
};

const AdminDashboard = ({ db, appId, lang }) => {
  const [logs, setLogs] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterProcess, setFilterProcess] = useState('All');
  const [filterWorker, setFilterWorker] = useState('All');
  const [showPressSummary, setShowPressSummary] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('logs'); // logs | mold
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    let q;
    if (activeTab === 'mold') {
       q = query(collection(db, 'work_logs'), orderBy('timestamp', 'desc'));
    } else {
       const [year, month] = filterDate.split('-');
       const startOfMonth = new Date(year, month - 1, 1);
       const endOfMonth = new Date(year, month, 1);
       q = query(
         collection(db, 'work_logs'),
         where('timestamp', '>=', startOfMonth),
         where('timestamp', '<', endOfMonth),
         orderBy('timestamp', 'desc')
       );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
      setLoading(false);
    });

    setVisibleCount(20);
    return () => unsubscribe();
  }, [db, filterDate, activeTab]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchVehicle = filterVehicle === 'All' || log.vehicleModel === filterVehicle;
      const matchProcess = filterProcess === 'All' || log.processType === filterProcess;
      const matchWorker = filterWorker === 'All' || log.workerName === filterWorker;
      return matchVehicle && matchProcess && matchWorker;
    });
  }, [logs, filterVehicle, filterProcess, filterWorker]);

  const uniqueWorkers = useMemo(() => {
    return ['All', ...new Set(logs.map(log => log.workerName))].sort();
  }, [logs]);

  const handleDelete = async (id) => {
    if (window.confirm('정말 이 작업일보를 삭제하시겠습니까?')) {
      try { await deleteDoc(doc(db, 'work_logs', id)); alert('삭제되었습니다.'); } catch (error) { console.error(error); alert('삭제 중 오류가 발생했습니다.'); }
    }
  };

  const handleUpdate = async (id, updatedData) => {
    await updateDoc(doc(db, 'work_logs', id), updatedData);
    alert('수정되었습니다.');
  };

  const handleLoadMore = () => { setVisibleCount(prev => prev + 20); };

  const exportToCSV = (data) => {
    if (!data || data.length === 0) return alert("데이터가 없습니다.");
    
    const allDetailKeys = new Set();
    data.forEach(row => {
      if (row.details) Object.keys(row.details).forEach(rowKey => Object.keys(row.details[rowKey]).forEach(colKey => allDetailKeys.add(`${rowKey}_${colKey}`)));
      if (row.measurements) Object.keys(row.measurements).forEach(pk => ['x1','x2','x3','x4','x5'].forEach(x => allDetailKeys.add(`MEASURE_${pk}_${x}`)));
      if (row.materialLots) Object.keys(row.materialLots).forEach(mat => ['cho','jung','jong'].forEach(col => allDetailKeys.add(`MAT_${mat}_${col}`)));
    });
    
    const detailHeaders = Array.from(allDetailKeys).sort();
    const headers = ['날짜', '작업자', '차종', '공정', '일보명', '작업시간', '총생산', '총불량', '특이사항', '첨부파일', ...detailHeaders];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const attachmentInfo = row.attachment ? `(첨부: ${row.attachment.name})` : '';
      const vals = [
        new Date(row.timestamp?.seconds * 1000).toLocaleDateString(),
        `"${row.workerName}"`,
        `"${row.vehicleModel}"`,
        `"${row.processType}"`,
        `"${row.logTitle}"`,
        `"${row.workTime || ''}"`,
        row.productionQty || 0,
        row.defectQty || 0,
        `"${row.notes || ''}"`,
        `"${attachmentInfo}"`
      ];
      const details = detailHeaders.map(h => {
        if (h.startsWith('MEASURE_')) { const p = h.split('_'); const x = p.pop(); const k = p.slice(1).join('_'); return row.measurements?.[k]?.[x] || ''; }
        if (h.startsWith('MAT_')) { const p = h.split('_'); const c = p.pop(); const m = p.slice(1).join('_'); return row.materialLots?.[m]?.[c] || ''; }
        const [r, c] = h.split(/_(.+)/);
        const cellData = row.details?.[r]?.[c] || '';
        return (typeof cellData === 'string' && cellData.startsWith('data:image')) ? '(사진첨부됨)' : cellData;
      });
      csvRows.push([...vals, ...details].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `작업일보_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderDetailedQty = (log) => {
    if (!log.details) return '-';
    const qtyKey = log.processType === '검사' ? 'check_qty' : 'qty';
    return (
      <div className="text-xs space-y-1">
        {Object.entries(log.details).map(([rowName, rowData]) => {
          const val = rowData[qtyKey];
          if(!val) return null;
          return <div key={rowName} className="flex justify-between border-b border-gray-100 last:border-0 pb-0.5"><span className="text-gray-500">{rowName}</span><span className="font-bold text-gray-900">{val}</span></div>;
        })}
        {log.measurements && Object.keys(log.measurements).length > 0 && <div className="mt-2 pt-2 border-t border-gray-200"><span className="font-bold text-blue-600 block mb-1">치수 검사 데이터 있음</span></div>}
        {log.materialLots && Object.keys(log.materialLots).length > 0 && <div className="mt-2 pt-2 border-t border-gray-200"><span className="font-bold text-green-600 block mb-1">소재 LOT 입력됨</span></div>}
        {Object.values(log.details).some(row => Object.values(row).some(v => typeof v === 'string' && v.startsWith('data:image'))) && (
           <div className="mt-2 pt-2 border-t border-gray-200 text-purple-600 font-bold flex items-center gap-1 cursor-pointer hover:text-purple-800" onClick={() => {
              const firstImg = Object.values(log.details).flatMap(row => Object.values(row)).find(v => typeof v === 'string' && v.startsWith('data:image'));
              if(firstImg) setViewImage(firstImg);
           }}><ImageIcon size={14} /> FMB LOT 사진 있음 (클릭)</div>
        )}
        {log.attachment && <div className="mt-2 pt-2 border-t border-gray-200"><a href={log.attachment.data} download={log.attachment.name} className="text-blue-600 font-bold flex items-center gap-1 hover:text-blue-800 text-xs"><Paperclip size={14} /> {log.attachment.name} 다운로드</a></div>}
      </div>
    );
  };
  
  const visibleLogs = filteredLogs.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {/* [NEW] 고도화된 월별 통계 차트 및 KPI */}
      <AdvancedAnalytics logs={filteredLogs} currentYearMonth={filterDate} />

      {/* Admin Tabs */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-300 flex justify-center gap-4">
         <button 
           onClick={() => setActiveTab('logs')}
           className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'logs' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
         >
           작업일보 관리
         </button>
         <button 
           onClick={() => setActiveTab('mold')}
           className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'mold' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
         >
           금형 타수 관리
         </button>
      </div>

      {activeTab === 'logs' ? (
        <>
          <div className="bg-white p-4 md:p-6 border-b md:border border-gray-300 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-auto"><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5" /> 관리자 모드</h2><p className="text-gray-500 text-xs mt-1">데이터 조회 및 엑셀 다운로드</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg"><Filter size={16} className="text-gray-500" /><input type="month" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer" /></div>
              <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="All">전체 차종</option>{VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select>
              <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="All">전체 공정</option>{PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="All">전체 작업자</option>{uniqueWorkers.map(w => w !== 'All' && <option key={w} value={w}>{w}</option>)}</select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 md:py-2 font-bold text-sm shadow transition rounded"><Plus size={16} /> 누락분 추가</button>
              <button onClick={() => setShowPressSummary(!showPressSummary)} className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 md:py-2 font-bold text-sm shadow transition rounded ${showPressSummary ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 border border-slate-300'}`}><List size={16} /> 프레스 요약</button>
              <button onClick={() => exportToCSV(filteredLogs)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-3 md:py-2 font-bold text-sm shadow transition rounded"><FileSpreadsheet size={16} /> Excel 다운로드</button>
              <button 
                onClick={() => setShowReportModal(true)} 
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-3 md:py-2 font-bold text-sm shadow transition rounded"
              >
                <Printer size={16} /> 월간 보고서
              </button>
            </div>
          </div>
          
          {showPressSummary && <PressSummaryTable logs={logs} />}

          <div className="bg-white border-t md:border border-gray-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 border-r whitespace-nowrap">일시</th><th className="px-4 py-3 border-r whitespace-nowrap">작업자</th><th className="px-4 py-3 border-r whitespace-nowrap">내역</th><th className="px-4 py-3 border-r whitespace-nowrap">작업시간</th><th className="px-4 py-3 border-r min-w-[150px]">상세 수량</th><th className="px-4 py-3 border-r text-right text-red-600 whitespace-nowrap">불량</th><th className="px-4 py-3 border-r min-w-[150px]">특이사항</th><th className="px-4 py-3 text-center whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="px-6 py-12 text-center text-gray-400">로딩 중...</td></tr>
                  ) : visibleLogs.length === 0 ? (
                    <tr><td colSpan="8" className="px-6 py-12 text-center text-gray-400">조건에 맞는 데이터가 없습니다.</td></tr>
                  ) : (
                    visibleLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 border-r align-top whitespace-nowrap">{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3 border-r font-bold align-top whitespace-nowrap">{log.workerName}</td>
                        <td className="px-4 py-3 border-r align-top"><span className="font-bold text-blue-800">[{log.vehicleModel}]</span> {log.logTitle}</td>
                        <td className="px-4 py-3 border-r align-top whitespace-nowrap text-xs text-gray-600 bg-gray-50">{log.workTime || '-'}</td>
                        <td className="px-4 py-3 border-r align-top bg-gray-50">{renderDetailedQty(log)}</td>
                        <td className="px-4 py-3 border-r text-right text-red-600 font-bold align-top">{log.defectQty > 0 ? log.defectQty : '-'}</td>
                        <td className="px-4 py-3 border-r align-top max-w-xs truncate text-gray-500">{log.notes}</td>
                        <td className="px-4 py-3 align-top text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정"><Pencil size={18} /></button>
                            <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition" title="삭제"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredLogs.length > visibleCount && (
              <div className="p-4 text-center border-t border-gray-200">
                <button onClick={handleLoadMore} className="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-full hover:bg-gray-200 transition flex items-center gap-2 mx-auto"><ChevronDown size={18} /> 더 보기 ({filteredLogs.length - visibleCount}개 남음)</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <MoldManagement logs={logs} lang={lang} />
      )}

      {showReportModal && (
        <MonthlyReportModal 
          logs={filteredLogs} 
          date={filterDate}   
          onClose={() => setShowReportModal(false)} 
        />
      )}
      
      {showAddModal && <AdminAddLogModal db={db} appId={appId} onClose={() => setShowAddModal(false)} lang={lang} />}
      {editingLog && <EditLogModal log={editingLog} onClose={() => setEditingLog(null)} onUpdate={handleUpdate} lang={lang} />}
      {viewImage && <ImageViewerModal imageUrl={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [lang, setLang] = useState('kr');

  useEffect(() => { const initAuth = async () => { await signInAnonymously(auth); }; initAuth(); const storedUser = localStorage.getItem('workLogUser'); if (storedUser) setCurrentUser(JSON.parse(storedUser)); setInitializing(false); }, []);

  const handleLogin = (userInfo) => { 
    setCurrentUser(userInfo); 
    setLang(userInfo.lang); 
    localStorage.setItem('workLogUser', JSON.stringify(userInfo)); 
  };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('workLogUser'); };

  if (initializing) return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-500 text-sm font-bold">LOADING...</div>;

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-gray-900">
      {!currentUser ? <LoginScreen onLogin={handleLogin} /> : (
        <div className="flex flex-col min-h-screen">
          <header className="bg-gray-800 text-white sticky top-0 z-30 shadow h-14 md:h-12 flex items-center justify-between px-4 print:hidden">
            <div className="flex items-center gap-2"><Factory size={18} className="text-blue-400" /><span className="font-bold text-base md:text-sm tracking-wide">MES SYSTEM</span></div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-300 hidden md:inline">{currentUser.name} ({currentUser.role === 'admin' ? '관리자' : '작업자'})</span>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white transition flex items-center gap-1"><LogOut size={16} /><span className="hidden md:inline">로그아웃</span></button>
            </div>
          </header>
          <main className="flex-1 w-full p-0 md:p-4 print:p-0">
            {currentUser.role === 'admin' ? <AdminDashboard db={db} appId={appId} lang={lang} /> : <WorkerDashboard user={currentUser} db={db} appId={appId} lang={lang} />}
          </main>
        </div>
      )}
    </div>
  );
}