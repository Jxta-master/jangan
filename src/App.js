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
  Truck, Factory, FileText, AlertCircle, Lock, Calendar, Save
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
      // KGM 차종 제외하고는 상세 구분 적용
      if (['J100', 'J120', 'O100'].includes(model)) return ['J100 RR', 'J120', 'O100', '기타'];
      return ['FRT A', 'FRT B', 'RR A', 'RR B', 'RR C', 'RR D'];
    }
  },
  press: {
    columns: [
      { key: 'fmb_lot', label: 'FMB LOT', type: 'text' }, // 금형No 대신 FMB LOT
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
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded shadow-xl max-w-sm w-full border border-slate-300">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-700 p-3 rounded-lg">
            <ClipboardList className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">MES 작업관리</h2>
        <p className="text-center text-slate-500 mb-6 text-sm">시스템 접속을 위해 로그인해주세요</p>
        
        <div className="flex bg-slate-100 p-1 rounded mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => { setRole('worker'); setError(''); }}
            className={`flex-1 py-2 px-4 rounded text-sm font-bold transition ${
              role === 'worker' ? 'bg-white text-blue-700 shadow border border-slate-200' : 'text-slate-500'
            }`}
          >
            작업자
          </button>
          <button
            type="button"
            onClick={() => { setRole('admin'); setError(''); }}
            className={`flex-1 py-2 px-4 rounded text-sm font-bold transition ${
              role === 'admin' ? 'bg-white text-indigo-700 shadow border border-slate-200' : 'text-slate-500'
            }`}
          >
            관리자
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {role === 'worker' ? (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="성명 입력"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">ID</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  placeholder="admin"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  placeholder="****"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-red-500 text-xs text-center bg-red-50 py-2 rounded border border-red-100 flex items-center justify-center gap-1">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            className={`w-full font-bold py-3 rounded mt-2 shadow transition text-white text-sm
              ${role === 'worker' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}
            `}
          >
            로그인
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="overflow-x-auto border border-black bg-white">
      <table className="w-full text-sm border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-2 py-2 text-center w-24 font-bold text-gray-800">구분</th>
            {template.columns.map(col => (
              <th key={col.key} className={`border border-black px-1 py-2 text-center font-bold text-xs whitespace-nowrap
                ${col.isDefect ? 'text-red-700' : 'text-gray-800'}
              `}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rowLabel) => (
            <tr key={rowLabel}>
              <td className="border border-black px-2 py-1 font-bold text-center bg-gray-50 text-xs">
                {rowLabel}
              </td>
              {template.columns.map(col => (
                <td key={col.key} className="border border-black p-0 h-8">
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    min={col.type === 'number' ? "0" : undefined}
                    className={`w-full h-full text-center outline-none bg-transparent text-sm
                      ${col.isDefect ? 'text-red-600 font-semibold' : 'text-gray-900'}
                    `}
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
    <div className="max-w-[210mm] mx-auto my-8 bg-white shadow-2xl min-h-[297mm] relative text-black print:shadow-none print:m-0">
      <div className="p-8 pb-4">
        <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-6">
          <h1 className="text-3xl font-extrabold tracking-widest text-black flex items-center gap-3">
            <FileText className="w-8 h-8" />
            작 업 일 보
          </h1>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-600 mb-1">결 재</p>
            <div className="flex border border-black">
              <div className="w-16 border-r border-black">
                <div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">작 성</div>
                <div className="h-12 flex items-center justify-center text-sm font-bold">{user.name}</div>
              </div>
              <div className="w-16 border-r border-black">
                <div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">검 토</div>
                <div className="h-12"></div>
              </div>
              <div className="w-16">
                <div className="bg-gray-100 border-b border-black text-xs text-center py-1 font-bold">승 인</div>
                <div className="h-12"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-black mb-6">
          <div className="flex border-b border-black">
            <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">
              작업일자
            </div>
            <div className="flex-1 flex items-center px-3 text-sm font-medium">
              {new Date().toLocaleDateString()}
            </div>
            <div className="w-24 bg-gray-100 border-l border-r border-black flex items-center justify-center font-bold text-sm py-2">
              작업자
            </div>
            <div className="flex-1 flex items-center px-3 text-sm font-medium">
              {user.name}
            </div>
          </div>
          <div className="flex">
            <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">
              차종
            </div>
            <div className="flex-1 border-r border-black relative">
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full h-full p-2 outline-none appearance-none bg-transparent font-bold text-blue-900 text-center cursor-pointer hover:bg-blue-50"
              >
                <option value="">[ 선 택 ]</option>
                {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <Truck className="absolute right-2 top-3 text-gray-400 pointer-events-none w-4 h-4" />
            </div>
            <div className="w-24 bg-gray-100 border-r border-black flex items-center justify-center font-bold text-sm py-2">
              공정
            </div>
            <div className="flex-1 relative">
              <select
                value={processType}
                onChange={(e) => setProcessType(e.target.value)}
                className="w-full h-full p-2 outline-none appearance-none bg-transparent font-bold text-blue-900 text-center cursor-pointer hover:bg-blue-50"
              >
                <option value="">[ 선 택 ]</option>
                {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Factory className="absolute right-2 top-3 text-gray-400 pointer-events-none w-4 h-4" />
            </div>
          </div>
        </div>

        {vehicle && processType ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-800 text-white px-4 py-2 border border-black">
              <span className="font-bold text-sm flex items-center gap-2">
                <ClipboardList size={16} />
                {logTitle}
              </span>
              <div className="text-xs space-x-4 font-mono">
                <span>합격: {totalQty.toLocaleString()}</span>
                <span className="text-red-300">불량: {totalDefect.toLocaleString()}</span>
              </div>
            </div>

            <DynamicTableForm 
              vehicle={vehicle} 
              processType={processType} 
              onChange={handleFormChange} 
            />

            <div className="border border-black">
              <div className="bg-gray-100 border-b border-black px-3 py-1 font-bold text-xs text-gray-700">
                특이사항 및 인수인계
              </div>
              <textarea
                rows="4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 text-sm outline-none resize-none"
                placeholder="내용을 입력하세요."
              ></textarea>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-8 py-3 font-bold text-white shadow-lg flex items-center gap-2 border border-black transition active:translate-y-1
                  ${isSubmitting ? 'bg-gray-400' : 'bg-blue-800 hover:bg-blue-900'}
                `}
              >
                {isSubmitting ? '저장 중...' : (
                  <>
                    <Save size={18} />
                    일보 저장
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-64 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">상단에서 차종과 공정을 선택하면<br/>입력 양식이 표시됩니다.</p>
          </div>
        )}
      </div>

      {submitSuccess && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-3 shadow-2xl flex items-center gap-2 z-50 rounded-full">
          <CheckCircle size={18} className="text-green-400" />
          <span className="font-bold text-sm">저장 완료</span>
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
      <div className="text-xs space-y-1">
        {Object.entries(log.details).map(([rowName, rowData]) => {
          const val = rowData[qtyKey];
          if(!val) return null;
          return (
            <div key={rowName} className="flex justify-between border-b border-gray-100 last:border-0 pb-0.5">
              <span className="text-gray-500">{rowName}</span>
              <span className="font-bold text-gray-900">{val}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 border border-gray-300 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            관리자 모드
          </h2>
          <p className="text-gray-500 text-xs mt-1">데이터 조회 및 엑셀 다운로드</p>
        </div>
        
        <button
          onClick={() => exportToCSV(logs)}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 font-bold text-sm shadow transition rounded"
        >
          <FileSpreadsheet size={16} />
          Excel 다운로드
        </button>
      </div>

      <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-4 py-3 border-r border-gray-300">일시</th>
                <th className="px-4 py-3 border-r border-gray-300">작업자</th>
                <th className="px-4 py-3 border-r border-gray-300">내역</th>
                <th className="px-4 py-3 border-r border-gray-300 w-48">상세 수량</th>
                <th className="px-4 py-3 border-r border-gray-300 text-right text-red-600">불량</th>
                <th className="px-4 py-3">특이사항</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400">데이터가 없습니다.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 border-r border-gray-200 align-top whitespace-nowrap">
                      {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : '-'}
                      <div className="text-xs text-gray-400">
                        {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 font-bold align-top">
                      {log.workerName}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 align-top">
                      <span className="font-bold text-blue-800">[{log.vehicleModel}]</span> {log.logTitle}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 align-top bg-gray-50">
                      {renderDetailedQty(log)}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right text-red-600 font-bold align-top">
                      {log.defectQty > 0 ? log.defectQty : '-'}
                    </td>
                    <td className="px-4 py-3 align-top max-w-xs truncate text-gray-500">
                      {log.notes}
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

  if (initializing) return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-500 text-sm font-bold">LOADING...</div>;

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-gray-900">
      {!currentUser ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <div className="flex flex-col min-h-screen">
          <header className="bg-gray-800 text-white sticky top-0 z-30 shadow h-12 flex items-center justify-between px-4 print:hidden">
            <div className="flex items-center gap-2">
              <Factory size={16} className="text-blue-400" />
              <span className="font-bold text-sm tracking-wide">MES SYSTEM</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-300">
                {currentUser.name} ({currentUser.role === 'admin' ? '관리자' : '작업자'})
              </span>
              <button 
                onClick={handleLogout} 
                className="text-gray-400 hover:text-white transition"
              >
                로그아웃
              </button>
            </div>
          </header>
          <main className="flex-1 w-full p-4 print:p-0">
            {currentUser.role === 'admin' ? (
              <div className="max-w-7xl mx-auto">
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