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
  Truck, Factory, FileText, AlertCircle, Lock, Calendar, Save, Trash2, Ruler, Pencil, X, Clock, Camera, Image as ImageIcon, ChevronDown, Filter, Printer, BarChart3, BookOpen, Paperclip, FileText as FileIcon, Layers
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
    case '소재준비':
      if (model === 'J100' || model === 'GN7') return `${model} 소재준비`;
      return `소재준비 ${model}`;
    case '프레스':
      if (isKGM(model)) return 'KGM 프레스';
      return `${model} 프레스`;
    case '후가공':
      return '후가공일보';
    case '검사':
      if (isKGM(model)) return 'KGM 검사일보';
      return `검사일보 ${model}`;
    default:
      return `${model} ${process} 일보`;
  }
};

// --- 작업 표준서 데이터 ---
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
  'GN7': {
    '소재준비': ["/images/GN7_SO.jpeg"], '프레스': ["/images/GN7_P.jpeg"], '후가공': ["/images/GN7_HU.jpeg"], '검사': [], 
  },
  'J100': {
    '소재준비': ["/images/J100_SO.jpg", "/images/J100_SO_B.jpg", "/images/J100_SO_C.jpg"],
    '프레스': ["/images/J100_P.jpg"], '후가공': ["/images/J100_HU.jpg"], '검사': ["/images/DN8_O.jpg"], 
  },
  'J120': {
    '소재준비': ["/images/J120_SO.jpg"], '프레스': ["/images/J120_P.jpg"], '후가공': ["/images/J120_HU.jpg"], '검사': ["/images/DN8_O.jpg"],
  },
  'O100': {
    '소재준비': ["/images/O100_SO.jpg", "/images/O100_SO_B1.jpg"],
    '프레스': ["/images/O100_P.jpg"], '후가공': ["/images/O100_HU.jpg"], '검사': ["/images/O100_T.jpg"],
  }
};

// --- Inspection Specs ---
const INSPECTION_SPECS = {
  'DN8': [
    { part: 'FRT LH A', spec: '1176±5' }, { part: 'FRT RH A', spec: '1176±5' },
    { part: 'RR LH A', spec: '644±5' }, { part: 'RR LH C', spec: '396±3' },
    { part: 'RR LH D', spec: '293±3' }, { part: 'RR RH A', spec: '644±5' },
    { part: 'RR RH C', spec: '396±3' }, { part: 'RR RH D', spec: '293±3' },
  ],
  'J100': [
    { part: 'RR A', spec: '708±5' }, { part: 'RR C', spec: '388±5' }, { part: 'RR D', spec: '273±3' },
  ],
  'J120': [
    { part: 'A', spec: '650±5' }, { part: 'E', spec: '250±3' },
  ],
  'O100': [
    { part: 'A', spec: '753±5' }, { part: 'D', spec: '270±3' }, { part: 'B1', spec: '258±3' },
  ]
};

// --- Form Templates ---
const FORM_TEMPLATES = {
  material: {
    columns: [
      { key: 'qty', label: '작업수량', type: 'number' },
      { key: 'defect_qty', label: '불량수량', type: 'number', isDefect: true },
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
      // FMB LOT만 유지 (나머지는 별도 테이블로 이동)
      { key: 'fmb_lot', label: 'FMB LOT', type: 'text', isPhoto: true },
      { key: 'lot_resin', label: '수지 LOT (직/둔)', type: 'text' },
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'defect_qty', label: '불량수량', type: 'number', isDefect: true },
      { key: 'defect_bubble', label: '기포', type: 'number', isDefect: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  post: {
    columns: [
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'defect_qty', label: '불량수량', type: 'number', isDefect: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  inspection: {
    columns: [
      { key: 'check_qty', label: '검사수량', type: 'number' },
      { key: 'defect_total', label: '불량수량', type: 'number', isDefect: true }
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
      <div className="relative max-w-full max-h-full">
        <img src={imageUrl} alt="확대 이미지" className="max-w-full max-h-[80vh] rounded-lg shadow-lg" />
        <button onClick={onClose} className="absolute -top-10 right-0 text-white p-2"><X size={32} /></button>
      </div>
    </div>
  );
};

const StandardModal = ({ vehicle, process, onClose }) => {
  const standardImages = PROCESS_STANDARDS[vehicle]?.[process] || [];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-0 max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><BookOpen className="text-blue-600" /> 작업 표준서 ({vehicle} - {process})</h3>
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
        <div className="p-4 border-t bg-white flex justify-center"><button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-bold shadow">닫기</button></div>
      </div>
    </div>
  );
};

const SimpleBarChart = ({ data, color = "bg-blue-500" }) => {
  if (!data || data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end h-32 gap-2 mt-4">
      {data.map((d, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center group relative">
          <div className="absolute bottom-full mb-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">{d.value}</div>
          <div className={`w-full max-w-[40px] rounded-t-sm transition-all duration-500 ${color}`} style={{ height: `${(d.value / maxVal) * 100}%` }}></div>
          <div className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{d.label}</div>
        </div>
      ))}
    </div>
  );
};

const DashboardStats = ({ logs }) => {
  const pressProductionData = useMemo(() => {
    const counts = { 'FRT LH': 0, 'FRT RH': 0, 'RR LH': 0, 'RR RH': 0 };
    logs.filter(l => l.processType === '프레스').forEach(log => {
      if (log.details) {
        Object.keys(counts).forEach(key => { if (log.details[key]) counts[key] += (Number(log.details[key].qty) || 0); });
      }
    });
    return Object.entries(counts).map(([k, v]) => ({ label: k, value: v }));
  }, [logs]);

  const inspectionDefectData = useMemo(() => {
    const counts = { 'FRT LH': 0, 'FRT RH': 0, 'RR LH': 0, 'RR RH': 0 };
    logs.filter(l => l.processType === '검사').forEach(log => {
      if (log.details) {
        Object.keys(counts).forEach(key => { if (log.details[key]) counts[key] += (Number(log.details[key].defect_total) || 0); });
      }
    });
    return Object.entries(counts).map(([k, v]) => ({ label: k, value: v }));
  }, [logs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-slate-500 font-bold text-sm">프레스 생산량 (부위별)</h3>
          <div className="p-2 bg-blue-50 rounded-full text-blue-600"><Factory size={20} /></div>
        </div>
        <SimpleBarChart data={pressProductionData} color="bg-blue-500" />
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-slate-500 font-bold text-sm">검사 불량수량 (부위별)</h3>
          <div className="p-2 bg-red-50 rounded-full text-red-600"><AlertCircle size={20} /></div>
        </div>
        <SimpleBarChart data={inspectionDefectData} color="bg-red-500" />
      </div>
    </div>
  );
};

const PressSummaryTable = ({ logs }) => {
  const summaryData = useMemo(() => {
    const summary = {};
    VEHICLE_MODELS.forEach(model => { summary[model] = { 'FRT LH': { prod: 0, def: 0 }, 'FRT RH': { prod: 0, def: 0 }, 'RR LH': { prod: 0, def: 0 }, 'RR RH': { prod: 0, def: 0 } }; });
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
                      {idx === 0 && <td className="px-4 py-3 font-bold border-r bg-gray-50 align-middle" rowSpan={4}>{model}</td>}
                      <td className="px-4 py-2 border-r text-gray-600">{part}</td>
                      <td className="px-4 py-2 text-right border-r font-medium">{vals.prod.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-600">{vals.def.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 border-b font-semibold">
                    <td colSpan="2" className="px-4 py-2 text-center border-r text-blue-800">소계</td>
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

const LoginScreen = ({ onLogin }) => {
  const ADMIN_PASSWORD = '1234abc'; 
  const [role, setRole] = useState('worker');
  const [name, setName] = useState('');
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (role === 'worker') {
      if (name.trim()) onLogin({ name, role }); else setError('이름을 입력해주세요.');
    } else {
      if (adminId === 'admin' && password === ADMIN_PASSWORD) onLogin({ name: '관리자', role }); else setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded shadow-xl max-w-sm w-full border border-slate-300">
        <div className="flex justify-center mb-6"><div className="bg-blue-700 p-4 rounded-2xl shadow-lg"><ClipboardList className="w-10 h-10 text-white" /></div></div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">장안산업 작업관리</h2>
        <p className="text-center text-slate-500 mb-6 text-sm">작업자 이름을 넣고 로그인을 눌러주세요</p>
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6 border border-slate-200">
          <button type="button" onClick={() => { setRole('worker'); setError(''); }} className={`flex-1 py-3 px-4 rounded-md text-sm font-bold transition ${role === 'worker' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500'}`}>작업자</button>
          <button type="button" onClick={() => { setRole('admin'); setError(''); }} className={`flex-1 py-3 px-4 rounded-md text-sm font-bold transition ${role === 'admin' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500'}`}>관리자</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {role === 'worker' ? (
            <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Name</label><input type="text" required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-base" placeholder="성명 입력" value={name} onChange={(e) => setName(e.target.value)} /></div>
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

const DynamicTableForm = ({ vehicle, processType, onChange, initialData }) => {
  const formType = getFormType(processType);
  const template = FORM_TEMPLATES[formType];
  const rowLabels = template.rows(vehicle);
  const [formData, setFormData] = useState({});
  const fileInputRef = useRef(null);
  const [activeCell, setActiveCell] = useState({ row: null, col: null });

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) { setFormData(initialData); }
  }, [vehicle, processType]);

  useEffect(() => {
    let totalQty = 0;
    let totalDefect = 0;
    Object.keys(formData).forEach(r => {
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
    setFormData(newData);
  };

  const handleCameraClick = (rowLabel, colKey) => {
    setActiveCell({ row: rowLabel, col: colKey });
    if (fileInputRef.current) fileInputRef.current.click();
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
              <th className="border border-black px-2 py-3 text-center w-24 font-bold text-gray-800">구분</th>
              {template.columns.map(col => (
                <th key={col.key} className={`border border-black px-1 py-3 text-center font-bold text-xs whitespace-nowrap ${col.isDefect ? 'text-red-700' : 'text-gray-800'}`}>{col.label}</th>
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
                  return (
                    <td key={col.key} className="border border-black p-0 h-12 relative group bg-white">
                      {hasImage ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <button onClick={() => handleCellChange(rowLabel, col.key, '')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-red-100 hover:text-red-600" title="클릭하여 삭제"><Camera size={14} /> <span>사진등록됨</span></button>
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
    </>
  );
};

// [NEW] Material LOT Form (A,B,C,D - Initial/Middle/Final)
const MaterialLotForm = ({ onChange, initialData }) => {
  const [data, setData] = useState(initialData || {});
  const materials = ['A소재', 'B소재', 'C소재', 'D소재'];
  const columns = [
    { key: 'cho', label: '초물' },
    { key: 'jung', label: '중물' },
    { key: 'jong', label: '종물' },
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
        소재 LOT 관리
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-3 text-center font-bold w-24">구분</th>
              {columns.map(col => (
                <th key={col.key} className="border border-black px-2 py-3 text-center font-bold">{col.label}</th>
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

const DimensionTableForm = ({ vehicle, onChange, initialData }) => {
  const [measureData, setMeasureData] = useState(initialData || {});
  const specs = INSPECTION_SPECS[vehicle] || [];

  useEffect(() => { if (initialData) setMeasureData(initialData); }, [initialData]);

  const handleMeasureChange = (part, xKey, value) => {
    const newData = { ...measureData };
    if (!newData[part]) newData[part] = {};
    newData[part][xKey] = value;
    setMeasureData(newData);
    onChange(newData);
  };

  if (specs.length === 0) return null;

  return (
    <div className="mt-6 border border-black bg-white shadow-sm">
      <div className="bg-gray-800 text-white px-4 py-3 border-b border-black font-bold text-sm flex items-center gap-2"><Ruler size={16} />중요 치수(길이) 검사현황 ({vehicle})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-3 text-center font-bold">구분</th>
              <th className="border border-black px-2 py-3 text-center font-bold">규격 (SPEC)</th>
              {['x1', 'x2', 'x3', 'x4', 'x5'].map(x => <th key={x} className="border border-black px-2 py-3 text-center font-bold w-16">{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {specs.map((item) => (
              <tr key={item.part}>
                <td className="border border-black px-2 py-3 text-center font-bold bg-gray-50 text-xs">{item.part}</td>
                <td className="border border-black px-2 py-3 text-center font-medium">{item.spec}</td>
                {['x1', 'x2', 'x3', 'x4', 'x5'].map((x) => (
                  <td key={x} className="border border-black p-0 h-12">
                    <input type="text" value={measureData[item.part]?.[x] || ''} className="w-full h-full text-center outline-none bg-transparent text-base" onChange={(e) => handleMeasureChange(item.part, x, e.target.value)} />
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

const EditLogModal = ({ log, onClose, onUpdate }) => {
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
          <DynamicTableForm vehicle={log.vehicleModel} processType={log.processType} onChange={handleFormChange} initialData={log.details} />
          {['프레스', '후가공', '검사'].includes(log.processType) && (
            <MaterialLotForm onChange={setMaterialLots} initialData={log.materialLots} />
          )}
          {log.processType === '검사' && INSPECTION_SPECS[log.vehicleModel] && (
            <DimensionTableForm vehicle={log.vehicleModel} onChange={setMeasurements} initialData={log.measurements} />
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

const WorkerDashboard = ({ user, db, appId }) => {
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
             <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-black flex items-center gap-3"><FileText className="w-6 h-6 md:w-8 md:h-8" /> 작 업 일 보</h1>
             {autoSaved && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded animate-fade-in print:hidden">자동저장됨</span>}
          </div>
          <div className="text-right w-full md:w-auto">
            <div className="flex justify-end gap-2 mb-2 print:hidden">
               <button onClick={() => setShowStandard(true)} className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition font-bold"><BookOpen size={14} /> 작업 표준서</button>
               <button onClick={handlePrint} className="text-xs flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition font-bold"><Printer size={14} /> 인쇄</button>
            </div>
            <p className="text-xs font-bold text-gray-600 mb-1 hidden md:block">결 재</p>
            <div className="flex border border-black w-full md:w-auto">
              <div className="flex-1 md:w-16 border-r border-black"><div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">작 성</div><div className="h-10 md:h-12 flex items-center justify-center text-sm font-bold">{user.name}</div></div>
              <div className="flex-1 md:w-16 border-r border-black"><div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">검 토</div><div className="h-10 md:h-12"></div></div>
              <div className="flex-1 md:w-16"><div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">승 인</div><div className="h-10 md:h-12"></div></div>
            </div>
          </div>
        </div>

        <div className="border border-black mb-6">
          <div className="flex flex-col md:flex-row border-b border-black">
            <div className="flex flex-1 border-b md:border-b-0 border-black md:border-r">
               <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">작업일자</div>
               <div className="flex-1 flex items-center justify-center font-medium text-sm">{new Date().toLocaleDateString()}</div>
            </div>
            <div className="flex flex-1">
               <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">작업자</div>
               <div className="flex-1 flex items-center justify-center font-medium text-sm">{user.name}</div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row border-b border-black">
             <div className="flex flex-1 border-b md:border-b-0 border-black md:border-r">
                <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">작업시간</div>
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
              <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm">차종</div>
              <div className="flex-1 relative">
                <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="w-full h-full p-2 outline-none appearance-none bg-transparent font-bold text-blue-900 text-center cursor-pointer">
                  <option value="">[ 선택 ]</option>
                  {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <Truck className="absolute right-2 top-4 text-gray-400 pointer-events-none w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-1 h-12">
              <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm">공정</div>
              <div className="flex-1 relative">
                <select value={processType} onChange={(e) => setProcessType(e.target.value)} className="w-full h-full p-2 outline-none appearance-none bg-transparent font-bold text-blue-900 text-center cursor-pointer">
                  <option value="">[ 선택 ]</option>
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
              <div className="text-xs space-x-3 font-mono flex"><span>합격: {totalQty.toLocaleString()}</span><span className="text-red-300">불량: {totalDefect.toLocaleString()}</span></div>
            </div>

            <DynamicTableForm vehicle={vehicle} processType={processType} onChange={handleFormChange} initialData={formDetails} />
            
            {['프레스', '후가공', '검사'].includes(processType) && (
              <MaterialLotForm onChange={setMaterialLots} initialData={materialLots} />
            )}

            {processType === '검사' && INSPECTION_SPECS[vehicle] && (
              <DimensionTableForm vehicle={vehicle} onChange={setMeasurements} initialData={measurements} />
            )}

            <div className="border border-black">
              <div className="bg-gray-100 border-b border-black px-3 py-2 font-bold text-xs text-gray-700">특이사항 및 인수인계</div>
              <textarea rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 text-base outline-none resize-none" placeholder="내용을 입력하세요."></textarea>
            </div>

            <div className="border border-black p-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2"><Paperclip size={18} className="text-gray-600" /><span className="text-sm font-bold text-gray-700">파일 첨부 (성적서/도면)</span><span className="text-xs text-gray-400">(PDF, 이미지 / 500KB 이하)</span></div>
              <div className="flex items-center gap-2">
                {attachment ? (
                   <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold"><FileIcon size={14} /><span className="max-w-[100px] truncate">{attachment.name}</span><button onClick={removeAttachment} className="hover:text-red-500"><X size={14}/></button></div>
                ) : (
                  <label className="cursor-pointer bg-white border border-gray-300 px-3 py-1 rounded text-xs font-bold hover:bg-gray-50 flex items-center gap-1"><span>파일 선택</span><input type="file" accept="image/*, application/pdf" ref={fileInputRef} onChange={handleAttachmentChange} className="hidden" /></label>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-300 md:static md:p-0 md:bg-transparent md:border-0 md:flex md:justify-end md:pt-4 z-40 print:hidden">
              <button onClick={handleSubmit} disabled={isSubmitting} className={`w-full md:w-auto px-8 py-4 md:py-3 font-bold text-white shadow-lg flex items-center justify-center gap-2 border border-black transition active:translate-y-1 rounded-lg md:rounded-none ${isSubmitting ? 'bg-gray-400' : 'bg-blue-800 hover:bg-blue-900'}`}>{isSubmitting ? '저장 중...' : <><Save size={20} />일보 저장</>}</button>
            </div>
          </div>
        ) : (
          <div className="h-64 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg"><FileText className="w-12 h-12 mb-2 opacity-20" /><p className="text-sm">상단에서 차종과 공정을 선택하면<br/>입력 양식이 표시됩니다.</p></div>
        )}
      </div>

      {showStandard && <StandardModal vehicle={vehicle} process={processType} onClose={() => setShowStandard(false)} />}
      {submitSuccess && <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-3 shadow-2xl flex items-center gap-2 z-50 rounded-full print:hidden"><CheckCircle size={18} className="text-green-400" /><span className="font-bold text-sm">저장 완료</span></div>}
    </div>
  );
};

const AdminDashboard = ({ db, appId }) => {
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

  useEffect(() => {
    const [year, month] = filterDate.split('-');
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    const q = query(
      collection(db, 'work_logs'),
      where('timestamp', '>=', startOfMonth),
      where('timestamp', '<', endOfMonth),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
      setLoading(false);
    });

    setVisibleCount(20);
    return () => unsubscribe();
  }, [db, filterDate]);

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

  const pressSummary = useMemo(() => {
    const summary = {};
    VEHICLE_MODELS.forEach(model => {
      summary[model] = { 'FRT LH': { prod: 0, def: 0 }, 'FRT RH': { prod: 0, def: 0 }, 'RR LH': { prod: 0, def: 0 }, 'RR RH': { prod: 0, def: 0 } };
    });
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
      <DashboardStats logs={filteredLogs} />
      <div className="bg-white p-4 md:p-6 border-b md:border border-gray-300 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="w-full md:w-auto"><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5" /> 관리자 모드</h2><p className="text-gray-500 text-xs mt-1">데이터 조회 및 엑셀 다운로드</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg"><Filter size={16} className="text-gray-500" /><input type="month" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer" /></div>
          <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="All">전체 차종</option>{VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="All">전체 공정</option>{PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="All">전체 작업자</option>{uniqueWorkers.map(w => w !== 'All' && <option key={w} value={w}>{w}</option>)}</select>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowPressSummary(!showPressSummary)} className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 md:py-2 font-bold text-sm shadow transition rounded ${showPressSummary ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 border border-slate-300'}`}><List size={16} /> 프레스 요약</button>
           <button onClick={() => exportToCSV(filteredLogs)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-3 md:py-2 font-bold text-sm shadow transition rounded"><FileSpreadsheet size={16} /> Excel 다운로드</button>
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

      {editingLog && <EditLogModal log={editingLog} onClose={() => setEditingLog(null)} onUpdate={handleUpdate} />}
      {viewImage && <ImageViewerModal imageUrl={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => { const initAuth = async () => { await signInAnonymously(auth); }; initAuth(); const storedUser = localStorage.getItem('workLogUser'); if (storedUser) setCurrentUser(JSON.parse(storedUser)); setInitializing(false); }, []);

  const handleLogin = (userInfo) => { setCurrentUser(userInfo); localStorage.setItem('workLogUser', JSON.stringify(userInfo)); };
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
            {currentUser.role === 'admin' ? <AdminDashboard db={db} appId={appId} /> : <WorkerDashboard user={currentUser} db={db} appId={appId} />}
          </main>
        </div>
      )}
    </div>
  );
}