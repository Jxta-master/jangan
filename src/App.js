import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously 
} from 'firebase/auth';
import { 
  ClipboardList, User, Settings, LogOut, FileSpreadsheet, CheckCircle, 
  Truck, Factory, FileText, PlusCircle, AlertCircle, Lock, Calendar, Save
} from 'lucide-react';

// --- Firebase Configuration ---
// [중요] 1단계에서 복사해 둔 '본인의 Firebase 설정값'으로 이 부분을 교체하세요.
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

const isKGM = (model) => ['J100', 'O100', 'J120'].includes(model);

const getLogTitle = (model, process) => {
  if (!model || !process) return '작업일보';
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

// --- Form Templates ---
const FORM_TEMPLATES = {
  material: {
    columns: [
      { key: 'qty', label: '작업수량', type: 'number' },
      { key: 'spec_start', label: '초물(길이)', type: 'text' },
      { key: 'spec_mid', label: '중물(길이)', type: 'text' },
      { key: 'spec_end', label: '종물(길이)', type: 'text' },
      { key: 'lot', label: 'Lot No', type: 'text' }
    ],
    rows: (model) => {
      if (['J100', 'J120', 'O100'].includes(model)) return ['J100 RR', 'J120', 'O100', '기타'];
      return ['FRT A', 'FRT B', 'RR A', 'RR B', 'RR C', 'RR D'];
    }
  },
  press: {
    columns: [
      { key: 'fmb_lot', label: 'FMB LOT', type: 'text' },
      { key: 'lot_a', label: 'A소재 LOT', type: 'text' },
      { key: 'lot_b', label: 'B소재 LOT', type: 'text' },
      { key: 'lot_c', label: 'C소재 LOT', type: 'text' },
      { key: 'lot_d', label: 'D소재 LOT', type: 'text' },
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'defect_drop', label: '떨어짐', type: 'number', isDefect: true },
      { key: 'defect_push', label: '밀림', type: 'number', isDefect: true },
      { key: 'defect_step', label: '단차', type: 'number', isDefect: true },
      { key: 'defect_short', label: '양부족', type: 'number', isDefect: true },
      { key: 'defect_bubble', label: '기포', type: 'number', isDefect: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  post: {
    columns: [
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'lot_a', label: 'A소재 LOT', type: 'text' },
      { key: 'lot_b', label: 'B소재 LOT', type: 'text' },
      { key: 'lot_c', label: 'C소재 LOT', type: 'text' },
      { key: 'lot_d', label: 'D소재 LOT', type: 'text' },
      { key: 'defect_finish', label: '사상불량', type: 'number', isDefect: true },
      { key: 'defect_trans', label: '운반파손', type: 'number', isDefect: true },
      { key: 'defect_poll', label: '외면오염', type: 'number', isDefect: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  inspection: {
    columns: [
      { key: 'check_qty', label: '검사수량', type: 'number' },
      { key: 'lot_a', label: 'A소재 LOT', type: 'text' },
      { key: 'lot_b', label: 'B소재 LOT', type: 'text' },
      { key: 'lot_c', label: 'C소재 LOT', type: 'text' },
      { key: 'lot_d', label: 'D소재 LOT', type: 'text' },
      { key: 'dim_start', label: '치수(초)', type: 'text' },
      { key: 'dim_mid', label: '치수(중)', type: 'text' },
      { key: 'dim_end', label: '치수(종)', type: 'text' },
      { key: 'defect_total', label: '불량수량', type: 'number', isDefect: true }
    ],
    rows: (model) => {
      if (isKGM(model)) return ['J100 L/R', 'J120 L/R', 'O100 L/R'];
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

const exportToCSV = (data) => {
  if (!data || data.length === 0) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }

  const allDetailKeys = new Set();
  data.forEach(row => {
    if (row.details) {
      Object.keys(row.details).forEach(rowKey => {
        Object.keys(row.details[rowKey]).forEach(colKey => {
          allDetailKeys.add(`${rowKey}_${colKey}`);
        });
      });
    }
  });
  
  const detailHeaders = Array.from(allDetailKeys).sort();
  const baseHeaders = ['날짜', '작업자', '차종', '공정', '일보명', '총생산수량', '총불량수량', '특이사항'];
  
  const csvRows = [[...baseHeaders, ...detailHeaders].join(',')];

  data.forEach(row => {
    const baseValues = [
      new Date(row.timestamp?.seconds * 1000).toLocaleDateString(),
      `"${row.workerName}"`,
      `"${row.vehicleModel}"`,
      `"${row.processType}"`,
      `"${row.logTitle}"`,
      row.productionQty || 0,
      row.defectQty || 0,
      `"${row.notes || ''}"`
    ];

    const detailValues = detailHeaders.map(header => {
      const [rowKey, colKey] = header.split(/_(.+)/);
      return row.details?.[rowKey]?.[colKey] || '';
    });

    csvRows.push([...baseValues, ...detailValues].join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `작업일보_통합_${new Date().toLocaleDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Components ---

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
      if (name.trim()) {
        onLogin({ name, role });
      } else {
        setError('이름을 입력해주세요.');
      }
    } else {
      if (adminId === 'admin' && password === ADMIN_PASSWORD) {
        onLogin({ name: '관리자', role });
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200">
        <div className="flex justify-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
            <ClipboardList className="w-12 h-12 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-center text-slate-800 mb-2">MES 시스템</h2>
        <p className="text-center text-slate-500 mb-8 font-medium">스마트 작업일보 관리 접속</p>
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-8">
          <button
            type="button"
            onClick={() => { setRole('worker'); setError(''); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition duration-200 flex items-center justify-center gap-2 ${
              role === 'worker' ? 'bg-white text-blue-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={18} /> 현장 작업자
          </button>
          <button
            type="button"
            onClick={() => { setRole('admin'); setError(''); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition duration-200 flex items-center justify-center gap-2 ${
              role === 'admin' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={18} /> 시스템 관리자
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {role === 'worker' ? (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">작업자 성명</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-medium"
                  placeholder="성명을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">관리자 아이디</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-medium"
                    placeholder="아이디 (admin)"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                  <input
                    type="password"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-medium"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-3 rounded-xl font-medium border border-red-100 flex items-center justify-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            className={`w-full font-bold py-4 rounded-xl mt-4 shadow-lg hover:shadow-xl transition transform active:scale-95 text-white flex items-center justify-center gap-2
              ${role === 'worker' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600' 
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600'}
            `}
          >
            {role === 'worker' ? '작업 시작하기' : '관리자 대시보드 접속'}
          </button>
        </form>
      </div>
    </div>
  );
};

const DynamicTableForm = ({ vehicle, processType, onChange }) => {
  const formType = getFormType(processType);
  const template = FORM_TEMPLATES[formType];
  const rowLabels = template.rows(vehicle);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData({});
    onChange({}, 0, 0); 
  }, [vehicle, processType]);

  const handleCellChange = (rowLabel, colKey, value, isDefect, colType) => {
    const newData = { ...formData };
    if (!newData[rowLabel]) newData[rowLabel] = {};
    
    const finalValue = colType === 'number' ? (Number(value) || 0) : value;
    newData[rowLabel][colKey] = finalValue;
    setFormData(newData);

    let totalQty = 0;
    let totalDefect = 0;

    Object.keys(newData).forEach(r => {
      Object.keys(newData[r]).forEach(c => {
        const val = newData[r][c];
        const colDef = template.columns.find(col => col.key === c);
        if (colDef?.key === 'qty' || colDef?.key === 'check_qty') totalQty += val;
        if (colDef?.isDefect) totalDefect += val;
      });
    });

    onChange(newData, totalQty, totalDefect);
  };

  return (
    <div className="overflow-x-auto border border-slate-300">
      <table className="w-full text-sm border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-300">
            <th className="px-3 py-3 border-r border-slate-300 text-slate-700 font-bold w-24 sticky left-0 bg-slate-100 z-10 text-center">구분</th>
            {template.columns.map(col => (
              <th key={col.key} className={`px-2 py-2 border-r border-slate-300 text-slate-700 font-bold text-center whitespace-nowrap min-w-[80px]
                ${col.isDefect ? 'text-red-600 bg-red-50' : ''}
              `}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rowLabel, idx) => (
            <tr key={rowLabel} className="bg-white border-b border-slate-300 hover:bg-blue-50 transition-colors">
              <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-300 text-center bg-slate-50 sticky left-0 z-10">
                {rowLabel}
              </td>
              {template.columns.map(col => (
                <td key={col.key} className="p-0 border-r border-slate-300 relative h-10">
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    min={col.type === 'number' ? "0" : undefined}
                    className={`w-full h-full text-center bg-transparent outline-none px-2 focus:bg-blue-100 transition-colors font-medium
                      ${col.isDefect ? 'text-red-600' : 'text-slate-700'}
                    `}
                    placeholder=""
                    onChange={(e) => handleCellChange(rowLabel, col.key, e.target.value, col.isDefect, col.type)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const WorkerDashboard = ({ user, db, appId }) => {
  const [vehicle, setVehicle] = useState('');
  const [processType, setProcessType] = useState('');
  const [notes, setNotes] = useState('');
  const [formDetails, setFormDetails] = useState({});
  const [totalQty, setTotalQty] = useState(0);
  const [totalDefect, setTotalDefect] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const logTitle = useMemo(() => getLogTitle(vehicle, processType), [vehicle, processType]);

  const handleFormChange = (details, qty, defect) => {
    setFormDetails(details);
    setTotalQty(qty);
    setTotalDefect(defect);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle || !processType) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'work_logs'), {
        appId: appId,
        workerName: user.name,
        vehicleModel: vehicle,
        processType: processType,
        logTitle: logTitle,
        details: formDetails,
        productionQty: totalQty,
        defectQty: totalDefect,
        notes: notes,
        timestamp: serverTimestamp(),
      });
      
      setSubmitSuccess(true);
      setNotes('');
      setVehicle(''); 
      setProcessType('');
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Paper UI Container */}
      <div className="bg-white rounded-none shadow-2xl border border-slate-200 min-h-[800px] relative overflow-hidden">
        {/* Top Accent Line */}
        <div className="h-2 bg-slate-800 w-full"></div>

        <div className="p-8 md:p-12">
          {/* Header Section (문서 헤더 스타일) */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-800 pb-6 mb-8">
            <div>
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <FileText className="w-10 h-10" />
                작 업 일 보
              </h1>
              <p className="text-slate-500 mt-2 font-medium">MES 생산 관리 시스템 | {new Date().toLocaleDateString()}</p>
            </div>
            
            {/* 결재란 스타일 */}
            <div className="flex mt-4 md:mt-0 border border-slate-400">
              <div className="flex flex-col w-20 text-center border-r border-slate-400">
                <div className="bg-slate-100 text-xs font-bold py-1 border-b border-slate-400">작성</div>
                <div className="h-16 flex items-center justify-center font-bold text-slate-800">{user.name}</div>
              </div>
              <div className="flex flex-col w-20 text-center border-r border-slate-400">
                <div className="bg-slate-100 text-xs font-bold py-1 border-b border-slate-400">검토</div>
                <div className="h-16"></div>
              </div>
              <div className="flex flex-col w-20 text-center">
                <div className="bg-slate-100 text-xs font-bold py-1 border-b border-slate-400">승인</div>
                <div className="h-16"></div>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="space-y-8">
            {/* Selection Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">차종 선택</label>
                <div className="relative">
                  <select
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white font-medium shadow-sm appearance-none"
                  >
                    <option value="">차종을 선택하세요</option>
                    {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <Truck className="absolute right-3 top-3.5 text-slate-400 pointer-events-none w-5 h-5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">공정 선택</label>
                <div className="relative">
                  <select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white font-medium shadow-sm appearance-none"
                  >
                    <option value="">공정을 선택하세요</option>
                    {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Factory className="absolute right-3 top-3.5 text-slate-400 pointer-events-none w-5 h-5" />
                </div>
              </div>
            </div>

            {vehicle && processType ? (
              <div className="animate-fade-in">
                {/* Summary Box */}
                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-t-lg border-t border-l border-r border-blue-100">
                  <div className="font-bold text-blue-900 text-lg flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    {logTitle}
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-500 text-xs font-bold">TOTAL QTY</span>
                      <span className="font-bold text-slate-800 text-lg">{totalQty.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-red-400 text-xs font-bold">TOTAL NG</span>
                      <span className="font-bold text-red-600 text-lg">{totalDefect.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Main Table Form */}
                <div className="mb-6">
                  <DynamicTableForm 
                    vehicle={vehicle} 
                    processType={processType} 
                    onChange={handleFormChange} 
                  />
                </div>

                {/* Notes Section */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-slate-700 mb-2">특이사항 / 메모</label>
                  <div className="relative">
                    <textarea
                      rows="3"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none resize-none bg-yellow-50/50 shadow-inner"
                      placeholder="작업 중 발생한 특이사항을 기록하세요."
                    ></textarea>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`w-full py-4 rounded-lg font-bold text-white shadow-lg transition transform active:scale-[0.99] flex items-center justify-center gap-3 text-lg
                    ${isSubmitting 
                      ? 'bg-slate-400 cursor-not-allowed' 
                      : 'bg-slate-800 hover:bg-slate-900'}
                  `}
                >
                  {isSubmitting ? (
                    '저장 중...'
                  ) : (
                    <>
                      <Save className="w-6 h-6" />
                      작업일보 등록 완료
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-400">
                <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">상단에서 차종과 공정을 선택하면<br/>작업 양식이 생성됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {submitSuccess && (
        <div className="fixed bottom-8 right-8 bg-slate-800 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce z-50">
          <div className="bg-green-500 rounded-full p-1">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-lg">등록 완료</h4>
            <p className="text-slate-300 text-sm">데이터가 안전하게 저장되었습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ db, appId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'work_logs'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const renderDetailedQty = (log) => {
    if (!log.details) return '-';
    const qtyKey = log.processType === '검사' ? 'check_qty' : 'qty';
    
    return (
      <div className="text-xs space-y-1.5">
        {Object.entries(log.details).map(([rowName, rowData]) => {
          const val = rowData[qtyKey];
          return (
            <div key={rowName} className="flex justify-between items-center gap-3 bg-white/50 px-2 py-0.5 rounded">
              <span className="font-semibold text-slate-600">{rowName}</span>
              <span className="font-bold text-slate-900 bg-slate-100 px-1.5 rounded">{val || 0}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-600" />
            관리자 대시보드
          </h2>
          <p className="text-slate-500 text-sm mt-1">전체 작업 기록 조회 및 데이터 관리</p>
        </div>
        
        <button
          onClick={() => exportToCSV(logs)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold transition shadow-md hover:shadow-lg"
        >
          <FileSpreadsheet size={18} />
          엑셀 다운로드
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold">날짜/시간</th>
                <th className="px-6 py-4 font-bold">작업자</th>
                <th className="px-6 py-4 font-bold">차종 / 공정</th>
                <th className="px-6 py-4 font-bold bg-blue-50/50">상세 생산수량</th>
                <th className="px-6 py-4 font-bold text-right text-red-600">총불량</th>
                <th className="px-6 py-4 font-bold">특이사항</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">데이터 로딩 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">등록된 데이터가 없습니다.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2 font-medium text-slate-700">
                        <Calendar size={14} className="text-slate-400" />
                        {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : '-'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 pl-6">
                        {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                          {log.workerName.charAt(0)}
                        </div>
                        {log.workerName}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-1">
                        {log.vehicleModel}
                      </span>
                      <div className="font-medium text-slate-700">{log.logTitle}</div>
                    </td>
                    <td className="px-6 py-4 align-top bg-blue-50/30 border-l border-r border-slate-100">
                      {renderDetailedQty(log)}
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      {log.defectQty > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          -{log.defectQty}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top max-w-xs truncate text-slate-500">
                      {log.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    
    const storedUser = localStorage.getItem('workLogUser');
    if (storedUser) setCurrentUser(JSON.parse(storedUser));
    setInitializing(false);
  }, []);

  const handleLogin = (userInfo) => {
    setCurrentUser(userInfo);
    localStorage.setItem('workLogUser', JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('workLogUser');
  };

  if (initializing) return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-400 font-medium">시스템 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-blue-100">
      {!currentUser ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <div className="flex flex-col min-h-screen">
          <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/50">
                  <Factory size={20} className="text-white" />
                </div>
                <h1 className="text-lg font-bold tracking-wide">MES 생산관리</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-slate-800 py-1.5 px-4 rounded-full border border-slate-700">
                  <div className={`w-2 h-2 rounded-full ${currentUser.role === 'admin' ? 'bg-indigo-400' : 'bg-green-400'}`}></div>
                  <span className="text-sm font-medium text-slate-200">
                    {currentUser.name} <span className="text-slate-500 text-xs ml-1">({currentUser.role === 'admin' ? '관리자' : '작업자'})</span>
                  </span>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="로그아웃"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 w-full">
            {currentUser.role === 'admin' ? (
              <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
                <AdminDashboard db={db} appId={appId} />
              </div>
            ) : (
              <WorkerDashboard user={currentUser} db={db} appId={appId} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}